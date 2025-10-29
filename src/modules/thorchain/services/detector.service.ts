import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MidgardService } from './midgard.service';
import { THORCHAIN_CONSTANTS } from 'src/common/constants/thorchain.constants';
import { TRADE_CONFIG_CONSTANTS } from 'src/common/constants/tradeConfig.constants';
import { StreamSwapDetectedEvent, ValidOpportunityDetectedEvent } from '../events/thorchain.events';
import { MidgardAction, StreamSwapOpportunity } from '../interfaces/thorchain.interface';
import { TradeDirection } from '../interfaces/trade.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { formatAmount, getStreamSwapSizeInUSD } from 'src/common/utils/format.utils';

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
        action: MidgardAction;
        height: string;
    }): Promise<void> {
        try {
            const action = event.action;

            // Check if this is a stream swap involving RUJI
            if (
                this.midgardService.isStreamSwap(action)
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
     * Process a detected stream swap
     */
    private async handleStreamSwap(
        txHash: string,
        action: MidgardAction,
        height: string,
    ): Promise<void> {
        try {
            const direction = this.midgardService.getSwapDirection(action);
            if (!direction) {
                this.logger.warn(`Could not determine swap direction for tx: ${txHash}`);
                return;
            }

            const streamingMeta = action.metadata?.swap?.streamingSwapMeta;
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
            const tradeDirection = direction.from === THORCHAIN_CONSTANTS.RUJI_TOKEN ? TradeDirection.long : TradeDirection.short;
            const $size = getStreamSwapSizeInUSD(action);

            const opportunity: StreamSwapOpportunity = {
                txHash,
                timestamp: new Date(parseInt(action.date) / 1000000), // Convert from nanoseconds to milliseconds
                inputAsset: direction.from,
                outputAsset: direction.to,
                inputAmount: action.in[0]?.coins[0]?.amount ?? '0',
                outputAmount: streamingMeta.outEstimation ?? '0',
                $size,
                tradeDirection,
                streamingConfig: {
                    count,
                    quantity,
                    interval,
                },
                estimatedDurationSeconds,
                pools: action.pools ?? [],
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
        const { inputAsset, outputAsset } = opportunity;
        const amount = formatAmount(opportunity.inputAmount);
        const duration = opportunity.estimatedDurationSeconds.toFixed(0);
        const txHash = opportunity.txHash;

        this.logger.log(
            `[OPPORTUNITY] ${timestamp} | ${inputAsset} -> ${outputAsset} | Amount: ${amount} | Duration: ${duration}s | TxHash: ${txHash}`,
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
     * Listen for stream swap detected events (for potential future processing)
     */
    @OnEvent('streamswap.detected')
    handleStreamSwapDetected(event: StreamSwapDetectedEvent): void {
        // This can be extended in the future for additional processing
        // such as triggering trading strategies, storing in database, etc.
        const { opportunity } = event;

        this.logger.debug(
            `Stream swap opportunity detected and logged: ${opportunity.txHash}`,
        );

        const { $size, estimatedDurationSeconds } = opportunity;

        if ($size < TRADE_CONFIG_CONSTANTS.MIN_OPPORTUNITY_SIZE_$) {
            this.logger.debug(`Size too small: ${$size}$`,
            );
            return;
        }

        if (estimatedDurationSeconds < TRADE_CONFIG_CONSTANTS.MIN_OPPORTUNITY_DURATION_S) {
            this.logger.debug(`Too fast: ${estimatedDurationSeconds}s`,
            );
            return;
        }

        this.logger.log(`Valid opportunity spotted: size=${formatAmount($size)}$, duration=${estimatedDurationSeconds}s, direction=${opportunity.tradeDirection}, txHash=${opportunity.txHash}`);

        this.eventEmitter.emit(
            'validopportunity.detected',
            new ValidOpportunityDetectedEvent(opportunity),
        );

    }
}

