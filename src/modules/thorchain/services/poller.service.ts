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
            // Get recent swap actions from Midgard (filtered by configured assets)
            // Since we're filtering by asset at API level, we need fewer results
            // 20 actions should cover extended periods reliably
            // Fetch only actions newer than (last seen height - 1). Subtracting 1 helps
            // in case Midgard/its indexer delivers late data for the most recently seen height.
            const fromHeight =
                this.lastProcessedHeight > 0
                    ? this.lastProcessedHeight - 1
                    : undefined;
            const actions = await this.midgardService.getRecentActions(20, fromHeight);

            const actionsList = actions ?? [];
            if (actionsList.length === 0) {
                this.logger.log(
                    `[PollerService] poll actions=0 (asset filter matched nothing) lastProcessedHeight=${this.lastProcessedHeight}`,
                );
                return;
            }

            const heights = actionsList
                .map((a) => parseInt(a.height))
                .filter((h) => !isNaN(h));
            const minHeight = heights.length > 0 ? Math.min(...heights) : NaN;
            const maxHeight = heights.length > 0 ? Math.max(...heights) : NaN;
            const heightRange =
                !isNaN(minHeight) && !isNaN(maxHeight)
                    ? `${minHeight}..${maxHeight}`
                    : 'n/a';

            let skippedMissingTxId = 0;

            // Process actions in order (oldest first)
            const sortedActions = actionsList.sort((a, b) => {
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
                    skippedMissingTxId++;
                    this.logger.warn(`Action at height ${height} has no txID, skipping`);
                    continue;
                }

                // Skip if we've already processed this transaction
                if (this.processedTxIds.has(txId)) {
                    // this.logger.debug(`Already processed txID ${txId}, skipping`);
                    continue;
                }

                // Actions match Midgard asset filter (OR of configured assets)
                this.logger.debug(`Found monitored-asset action at height ${height}, txID: ${txId}`);

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

            // Per-poll summary log (kept low cardinality)
            this.logger.log(
                `[PollerService] poll actions=${actionsList.length} heights=${heightRange} skippedMissingTxId=${skippedMissingTxId} lastProcessedHeight=${this.lastProcessedHeight}`,
            );

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

