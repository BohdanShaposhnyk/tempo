import {
    Injectable,
    Logger,
    OnModuleInit,
    OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import WebSocket from 'ws';
import {
    ThorchainEvent,
    TxEvent,
} from '../interfaces/thorchain.interface';
import { THORCHAIN_CONSTANTS } from '../../../common/constants/thorchain.constants';
import {
    TransactionDetectedEvent,
    WebSocketConnectionEvent,
} from '../events/thorchain.events';

@Injectable()
export class WebSocketService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(WebSocketService.name);
    private ws: WebSocket | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private reconnectDelay: number = THORCHAIN_CONSTANTS.WS_RECONNECT_DELAY_MS;
    private isConnected = false;
    private shouldReconnect = true;
    private readonly websocketUrl: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly eventEmitter: EventEmitter2,
    ) {
        this.websocketUrl =
            this.configService.get<string>('THORNODE_WEBSOCKET_URL') ||
            THORCHAIN_CONSTANTS.THORNODE_WEBSOCKET;
    }

    async onModuleInit() {
        this.logger.log('Initializing WebSocket connection to THORNode...');
        await this.connect();
    }

    async onModuleDestroy() {
        this.logger.log('Shutting down WebSocket connection...');
        this.shouldReconnect = false;
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }
        if (this.ws) {
            this.ws.close();
        }
    }

    private async connect(): Promise<void> {
        try {
            this.logger.log(`Connecting to WebSocket: ${this.websocketUrl}`);
            this.ws = new WebSocket(this.websocketUrl);

            this.ws.on('open', () => this.handleOpen());
            this.ws.on('message', (data: WebSocket.Data) => this.handleMessage(data));
            this.ws.on('error', (error: Error) => this.handleError(error));
            this.ws.on('close', () => this.handleClose());
        } catch (error) {
            this.logger.error(`Failed to create WebSocket connection: ${error.message}`);
            this.scheduleReconnect();
        }
    }

    private handleOpen(): void {
        this.logger.log('WebSocket connection established');
        this.isConnected = true;
        this.reconnectDelay = THORCHAIN_CONSTANTS.WS_RECONNECT_DELAY_MS;

        // Emit connection event
        this.eventEmitter.emit(
            'websocket.connection',
            new WebSocketConnectionEvent(true),
        );

        // Subscribe to new transaction events
        this.subscribe();
    }

    private subscribe(): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.logger.warn('Cannot subscribe: WebSocket not open');
            return;
        }

        try {
            // Subscribe to new transactions
            const subscribeMessage = {
                jsonrpc: '2.0',
                method: 'subscribe',
                id: 1,
                params: {
                    query: "tm.event='Tx'",
                },
            };

            this.ws.send(JSON.stringify(subscribeMessage));
            this.logger.log('Subscribed to transaction events');
        } catch (error) {
            this.logger.error(`Failed to subscribe: ${error.message}`);
        }
    }

    private handleMessage(data: WebSocket.Data): void {
        try {
            const message = JSON.parse(data.toString());

            // Handle subscription confirmation
            if (message.id === 1 && message.result) {
                this.logger.debug('Subscription confirmed');
                return;
            }

            // Handle event messages
            if (message.result && message.result.data) {
                const event: ThorchainEvent = message.result.data;
                this.processEvent(event);
            }
        } catch (error) {
            this.logger.error(`Failed to parse WebSocket message: ${error.message}`);
        }
    }

    private processEvent(event: ThorchainEvent): void {
        if (event.type === 'Tx') {
            this.processTxEvent(event as TxEvent);
        }
    }

    private processTxEvent(event: TxEvent): void {
        try {
            const txResult = event.value.TxResult;
            const height = txResult.height;
            const events = txResult.result.events || [];

            // Extract transaction hash from events
            let txHash: string | null = null;
            for (const evt of events) {
                if (evt.type === 'tx') {
                    const hashAttr = evt.attributes.find((attr) =>
                        Buffer.from(attr.key, 'base64').toString() === 'hash'
                    );
                    if (hashAttr) {
                        txHash = Buffer.from(hashAttr.value, 'base64').toString();
                        break;
                    }
                }
            }

            if (!txHash) {
                // Try to decode from tx field if hash not found in events
                this.logger.debug('Transaction hash not found in events, skipping...');
                return;
            }

            this.logger.debug(`Transaction detected: ${txHash} at height ${height}`);

            // Emit transaction detected event
            this.eventEmitter.emit(
                'transaction.detected',
                new TransactionDetectedEvent(txHash, height, events),
            );
        } catch (error) {
            this.logger.error(`Failed to process Tx event: ${error.message}`);
        }
    }

    private handleError(error: Error): void {
        this.logger.error(`WebSocket error: ${error.message}`);
    }

    private handleClose(): void {
        this.logger.warn('WebSocket connection closed');
        this.isConnected = false;

        // Emit disconnection event
        this.eventEmitter.emit(
            'websocket.connection',
            new WebSocketConnectionEvent(false),
        );

        if (this.shouldReconnect) {
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }

        this.logger.log(
            `Scheduling reconnect in ${this.reconnectDelay}ms...`,
        );

        this.reconnectTimeout = setTimeout(() => {
            this.connect();
        }, this.reconnectDelay);

        // Exponential backoff
        this.reconnectDelay = Math.min(
            this.reconnectDelay * THORCHAIN_CONSTANTS.WS_RECONNECT_BACKOFF_MULTIPLIER,
            THORCHAIN_CONSTANTS.WS_MAX_RECONNECT_DELAY_MS,
        );
    }

    /**
     * Check if WebSocket is currently connected
     */
    isHealthy(): boolean {
        return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
    }
}

