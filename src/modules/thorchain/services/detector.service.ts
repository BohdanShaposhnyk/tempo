import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MidgardService } from './midgard.service';
import {
    TransactionDetectedEvent,
    StreamSwapDetectedEvent,
} from '../events/thorchain.events';
import { StreamSwapOpportunity } from '../interfaces/thorchain.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class DetectorService implements OnApplicationBootstrap {
    private readonly logger = new Logger(DetectorService.name);

    constructor(
        private readonly midgardService: MidgardService,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    onApplicationBootstrap() {
        this.logger.log('Stream Swap Detector initialized and ready');
    }

    /**
     * Listen for action detected events from Poller (primary method)
     */
    @OnEvent('action.detected', { async: true })
    async handleActionDetected(event: {
        action: any;
        height: string;
    }): Promise<void> {
        try {
            const action = event.action;

            // Check if this is a stream swap involving RUJI
            if (
                this.midgardService.isStreamSwap(action) &&
                this.midgardService.involvesRuji(action)
            ) {
                // Extract transaction ID from inbound transaction
                const txHash = action.in?.[0]?.txID || 'unknown';
                await this.handleStreamSwap(txHash, action, event.height);
            }
        } catch (error) {
            this.logger.error(
                `Error processing action at height ${event.height}: ${error.message}`,
            );
        }
    }

    /**
     * Listen for transaction detected events from WebSocket (fallback)
     */
    @OnEvent('transaction.detected', { async: true })
    async handleTransactionDetected(
        event: TransactionDetectedEvent,
    ): Promise<void> {
        try {
            this.logger.debug(`Processing transaction: ${event.txHash}`);

            // Fetch detailed transaction information from Midgard
            const actions = await this.midgardService.getActionsByTxId(event.txHash);

            if (!actions || actions.length === 0) {
                this.logger.debug(`No actions found for tx: ${event.txHash}`);
                return;
            }

            // Process each action
            for (const action of actions) {
                // Check if this is a stream swap involving RUJI
                if (
                    this.midgardService.isStreamSwap(action) &&
                    this.midgardService.involvesRuji(action)
                ) {
                    await this.handleStreamSwap(event.txHash, action, event.height);
                }
            }
        } catch (error) {
            this.logger.error(
                `Error processing transaction ${event.txHash}: ${error.message}`,
            );
        }
    }

    /**
     * Process a detected stream swap
     */
    private async handleStreamSwap(
        txHash: string,
        action: any,
        height: string,
    ): Promise<void> {
        try {
            const direction = this.midgardService.getSwapDirection(action);
            if (!direction) {
                this.logger.warn(`Could not determine swap direction for tx: ${txHash}`);
                return;
            }

            const streamingMeta = action.metadata.swap.streamingSwapMeta;
            if (!streamingMeta) {
                this.logger.warn(`No streamingSwapMeta found for tx: ${txHash}`);
                return;
            }

            // Parse string values to numbers
            const count = parseInt(streamingMeta.count);
            const interval = parseInt(streamingMeta.interval);
            const quantity = parseInt(streamingMeta.quantity);

            // Calculate estimated duration
            // interval is in blocks, THORChain blocks are ~6 seconds
            const estimatedDurationSeconds = count * interval * 6;

            const opportunity: StreamSwapOpportunity = {
                txHash,
                timestamp: new Date(parseInt(action.date) / 1000000), // Convert from nanoseconds to milliseconds
                direction: `${direction.from} -> ${direction.to}`,
                inputAsset: direction.from,
                outputAsset: direction.to,
                inputAmount: action.in[0]?.coins[0]?.amount || '0',
                streamingConfig: {
                    count,
                    quantity,
                    interval,
                },
                estimatedDurationSeconds,
                pools: action.pools || [],
                height,
            };

            // Emit stream swap detected event
            this.eventEmitter.emit(
                'streamswap.detected',
                new StreamSwapDetectedEvent(opportunity),
            );

            // Log the opportunity
            this.logOpportunity(opportunity);
        } catch (error) {
            this.logger.error(`Error handling stream swap: ${error.message}`);
        }
    }

    /**
     * Log detected opportunity to console
     */
    private logOpportunity(opportunity: StreamSwapOpportunity): void {
        const timestamp = opportunity.timestamp.toISOString();
        const direction = opportunity.direction;
        const amount = this.formatAmount(opportunity.inputAmount);
        const duration = opportunity.estimatedDurationSeconds.toFixed(0);
        const txHash = opportunity.txHash;

        this.logger.log(
            `[OPPORTUNITY] ${timestamp} | ${direction} | Amount: ${amount} | Duration: ${duration}s | TxHash: ${txHash}`,
        );

        // Additional detailed logging
        this.logger.debug(
            `Stream config: ${opportunity.streamingConfig.count} swaps, ` +
            `${opportunity.streamingConfig.quantity} quantity, ` +
            `${opportunity.streamingConfig.interval}ns interval`,
        );
        this.logger.debug(`Pools involved: ${opportunity.pools.join(', ')}`);
    }

    /**
     * Format amount for display (convert from base units)
     */
    private formatAmount(amount: string): string {
        try {
            const num = BigInt(amount);
            const divisor = BigInt(100000000); // 8 decimals for THORChain
            const whole = num / divisor;
            const fraction = num % divisor;
            return `${whole}.${fraction.toString().padStart(8, '0')}`;
        } catch (error) {
            return amount;
        }
    }

    /**
     * Listen for stream swap detected events (for potential future processing)
     */
    @OnEvent('streamswap.detected')
    handleStreamSwapDetected(event: StreamSwapDetectedEvent): void {
        // This can be extended in the future for additional processing
        // such as triggering trading strategies, storing in database, etc.
        this.logger.debug(
            `Stream swap opportunity detected and logged: ${event.opportunity.txHash}`,
        );
    }
}

