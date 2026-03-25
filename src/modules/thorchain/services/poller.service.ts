import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MidgardService } from './midgard.service';
import { MidgardAction } from '../interfaces/thorchain.interface';

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
  private pollInProgress = false;
  private readonly pollIntervalMs = 6000; // Poll every 6 seconds (THORChain block time is ~6s)

  constructor(
    private readonly midgardService: MidgardService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onApplicationBootstrap() {
    this.logger.log('Starting Midgard polling service...');
    await this.startPolling();
  }

  onModuleDestroy() {
    this.logger.log('Stopping polling service...');
    this.stopPolling();
  }

  private async startPolling(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Polling already running');
      return;
    }

    this.isRunning = true;
    this.logger.log(
      `Polling Midgard every ${this.pollIntervalMs}ms for new actions`,
    );

    // Do initial poll
    await this.poll();

    // Set up interval
    this.pollingInterval = setInterval(() => {
      // Intentionally fire-and-forget; `poll()` already has its own error handling.
      void this.poll();
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
    if (this.pollInProgress) {
      this.logger.warn('Poll already in progress; skipping this interval tick');
      return;
    }

    this.pollInProgress = true;
    try {
      // 20 actions should cover extended periods reliably
      const actionsList = await this.fetchRecentActions(20);
      if (actionsList.length === 0) {
        this.logNoActions();
        return;
      }

      const { maxHeightSeen } =
        this.processActions(actionsList);

      // Update last processed height for health monitoring
      this.lastProcessedHeight = maxHeightSeen;

      // Per-poll summary log (kept low cardinality)
      this.logger.log(
        `[PollerService] lastProcessedHeight=${this.lastProcessedHeight}`,
      );

      this.trimProcessedTxIdsIfNeeded();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error polling Midgard: ${message}`);
    } finally {
      this.pollInProgress = false;
    }
  }

  private async fetchRecentActions(limit: number): Promise<MidgardAction[]> {
    // MidgardService handles asset filtering/merging; Poller only cares about emitting new actions.
    const actions = await this.midgardService.getRecentActions(limit);
    return actions ?? [];
  }

  private logNoActions(): void {
    this.logger.log(
      `[PollerService] poll actions=0 (asset filter matched nothing) lastProcessedHeight=${this.lastProcessedHeight}`,
    );
  }

  private processActions(actionsList: MidgardAction[]): {
    maxHeightSeen: number;
  } {
    type ParsedAction = {
      action: MidgardAction;
      height: number;
      txId: string;
    };

    const parsedActions: ParsedAction[] = actionsList.map((action) => ({
      action,
      height: Number(action.height),
      txId: action.in[0].txID,
    }));

    // Process actions in order (oldest first).
    // Keep comparator behavior close to the original (if height is NaN, order becomes effectively stable).
    const sortedActions = [...parsedActions].sort(
      (a, b) => a.height - b.height,
    );

    let maxHeightSeen = this.lastProcessedHeight;

    for (const { action, height, txId } of sortedActions) {
      // Skip if we've already processed this transaction
      if (this.processedTxIds.has(txId)) {
        continue;
      }

      this.logger.debug(
        `Found monitored-asset action at height ${height}, txID: ${txId}`,
      );

      // Emit action detected event
      this.eventEmitter.emit('action.detected', {
        action,
        height: action.height,
      });

      // Mark this transaction as processed
      this.processedTxIds.add(txId);

      // Track the maximum height we've seen (for health monitoring)
      if (height > maxHeightSeen) {
        maxHeightSeen = height;
      }
    }

    return { maxHeightSeen };
  }

  private trimProcessedTxIdsIfNeeded(): void {
    // Prevent memory bloat: keep only the most recent txIDs
    if (this.processedTxIds.size <= this.maxProcessedTxIds) return;

    const txIdsArray = Array.from(this.processedTxIds);
    const toKeep = txIdsArray.slice(-this.maxProcessedTxIds);
    this.processedTxIds = new Set(toKeep);
    this.logger.debug(
      `Trimmed processedTxIds to ${this.maxProcessedTxIds} entries`,
    );
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
