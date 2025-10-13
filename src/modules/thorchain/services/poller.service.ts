import {
    Injectable,
    Logger,
    OnApplicationBootstrap,
    OnModuleDestroy,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MidgardService } from './midgard.service';
import { TransactionDetectedEvent } from '../events/thorchain.events';

/**
 * Alternative to WebSocket: Poll Midgard API for new actions
 * This is more reliable than WebSocket and works consistently
 */
@Injectable()
export class PollerService implements OnApplicationBootstrap, OnModuleDestroy {
    private readonly logger = new Logger(PollerService.name);
    private pollingInterval: NodeJS.Timeout | null = null;
    private lastProcessedHeight: number = 0;
    private isRunning = false;
    private readonly pollIntervalMs = 6000; // Poll every 6 seconds (THORChain block time is ~6s)

    constructor(
        private readonly midgardService: MidgardService,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    async onApplicationBootstrap() {
        this.logger.log('Starting Midgard polling service...');
        await this.startPolling();
    }

    async onModuleDestroy() {
        this.logger.log('Stopping polling service...');
        this.stopPolling();
    }

    private async startPolling(): Promise<void> {
        if (this.isRunning) {
            this.logger.warn('Polling already running');
            return;
        }

        this.isRunning = true;
        this.logger.log(`Polling Midgard every ${this.pollIntervalMs}ms for new actions`);

        // Do initial poll
        await this.poll();

        // Set up interval
        this.pollingInterval = setInterval(async () => {
            await this.poll();
        }, this.pollIntervalMs);
    }

    private stopPolling(): void {
        this.isRunning = false;
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    private async poll(): Promise<void> {
        try {
            // Get recent actions from Midgard
            // Fetch enough to cover multiple blocks with high activity
            // At ~10 actions/block and 6s polling, 50 actions should be safe
            const actions = await this.midgardService.getRecentActions(50);

            if (!actions || actions.length === 0) {
                return;
            }

            // Process actions in order (oldest first)
            const sortedActions = actions.sort((a, b) => {
                const heightA = parseInt(a.height);
                const heightB = parseInt(b.height);
                return heightA - heightB;
            });

            let maxHeightProcessed = this.lastProcessedHeight;

            for (const action of sortedActions) {
                const height = parseInt(action.height);

                // Skip if we've already processed this height
                if (height <= this.lastProcessedHeight) {
                    continue;
                }

                // Check if this action involves RUJI
                if (this.midgardService.involvesRuji(action)) {
                    this.logger.debug(`Found RUJI action at height ${height}`);

                    // Emit transaction detected event
                    // We'll pass the action data directly since we already have it
                    this.eventEmitter.emit(
                        'action.detected',
                        {
                            action,
                            height: action.height,
                        },
                    );
                }

                // Track the maximum height we've seen
                if (height > maxHeightProcessed) {
                    maxHeightProcessed = height;
                }
            }

            // Update last processed height after all actions are processed
            this.lastProcessedHeight = maxHeightProcessed;
        } catch (error) {
            this.logger.error(`Error polling Midgard: ${error.message}`);
        }
    }

    /**
     * Check if the poller is running
     */
    isHealthy(): boolean {
        return this.isRunning && this.pollingInterval !== null;
    }

    /**
     * Get the last processed block height
     */
    getLastHeight(): number {
        return this.lastProcessedHeight;
    }
}

