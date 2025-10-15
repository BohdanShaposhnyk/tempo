import {
    Injectable,
    Logger,
    OnApplicationBootstrap,
    OnModuleDestroy,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MidgardService } from './midgard.service';

/**
 * Alternative to WebSocket: Poll Midgard API for new actions
 * This is more reliable than WebSocket and works consistently
 */
@Injectable()
export class PollerService implements OnApplicationBootstrap, OnModuleDestroy {
    private readonly logger = new Logger(PollerService.name);
    private pollingInterval: NodeJS.Timeout | null = null;
    private processedTxIds: Set<string> = new Set();
    private readonly maxProcessedTxIds = 1000; // Keep last 1000 txIDs to prevent memory bloat
    private lastProcessedHeight: number = 0; // Still track for health monitoring
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
            // Get recent RUJI actions from Midgard
            // Since we're filtering by asset at API level, we need fewer results
            // 20 RUJI actions should cover extended periods reliably
            const actions = await this.midgardService.getRecentActions(20);

            if (!actions || actions.length === 0) {
                return;
            }

            // Process actions in order (oldest first)
            const sortedActions = actions.sort((a, b) => {
                const heightA = parseInt(a.height);
                const heightB = parseInt(b.height);
                return heightA - heightB;
            });

            let maxHeightSeen = this.lastProcessedHeight;

            for (const action of sortedActions) {
                const height = parseInt(action.height);
                const txId = action.in?.[0]?.txID;

                // Skip if no txID (shouldn't happen but be safe)
                if (!txId) {
                    this.logger.warn(`Action at height ${height} has no txID, skipping`);
                    continue;
                }

                // Skip if we've already processed this transaction
                if (this.processedTxIds.has(txId)) {
                    // this.logger.debug(`Already processed txID ${txId}, skipping`);
                    continue;
                }

                // All actions returned are already RUJI-related (filtered by API)
                this.logger.debug(`Found RUJI action at height ${height}, txID: ${txId}`);

                // Emit action detected event
                this.eventEmitter.emit(
                    'action.detected',
                    {
                        action,
                        height: action.height,
                    },
                );

                // Mark this transaction as processed
                this.processedTxIds.add(txId);

                // Track the maximum height we've seen (for health monitoring)
                if (height > maxHeightSeen) {
                    maxHeightSeen = height;
                }
            }

            // Update last processed height for health monitoring
            this.lastProcessedHeight = maxHeightSeen;

            // Prevent memory bloat: keep only the most recent txIDs
            if (this.processedTxIds.size > this.maxProcessedTxIds) {
                const txIdsArray = Array.from(this.processedTxIds);
                const toKeep = txIdsArray.slice(-this.maxProcessedTxIds);
                this.processedTxIds = new Set(toKeep);
                this.logger.debug(`Trimmed processedTxIds to ${this.maxProcessedTxIds} entries`);
            }
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

