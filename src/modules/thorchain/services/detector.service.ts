import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MidgardService } from './midgard.service';
import { ThornodeService } from './thornode.service';
import { THORCHAIN_CONSTANTS } from 'src/common/constants/thorchain.constants';
import { TradeConfigService } from 'src/modules/config/trade-config.service';
import { StreamSwapDetectedEvent, ValidOpportunityDetectedEvent } from '../events/thorchain.events';
import { MidgardAction, StreamSwapOpportunity, ThornodeTxStatus } from '../interfaces/thorchain.interface';
import { TradeDirection } from '../interfaces/trade.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { formatAmount, getStreamSwapSizeInUSD, calculateSizeFromThornodeTx } from 'src/common/utils/format.utils';

@Injectable()
export class DetectorService implements OnApplicationBootstrap {
    private readonly logger = new Logger(DetectorService.name);

    constructor(
        private readonly midgardService: MidgardService,
        private readonly thornodeService: ThornodeService,
        private readonly tradeConfigService: TradeConfigService,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    onApplicationBootstrap() {
        this.logger.log('Stream Swap Detector initialized and ready');
    }

    private getInputAmountAndSizeInUSD(action: MidgardAction, txStatus: ThornodeTxStatus | null): { $size: number, inputAmount: string } {
        if (txStatus && txStatus.tx?.coins && txStatus.tx.coins.length > 0) {
            const $size = calculateSizeFromThornodeTx(txStatus, parseFloat(action.metadata?.swap?.inPriceUSD || '0'));
            const inputAmount = txStatus.tx.coins[0].amount;
            return { $size, inputAmount };
        }
        return { $size: getStreamSwapSizeInUSD(action), inputAmount: action.in[0]?.coins[0]?.amount ?? '0' };
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
            // Fetch transaction status from THORNode for reliable data
            // This is used to get the input amount and size in USD
            const txStatus = await this.thornodeService.getTransactionStatus(txHash);

            const swapAssets = this.midgardService.getSwapAssets(action);

            const streamingMeta = action.metadata?.swap?.streamingSwapMeta;
            if (!streamingMeta) {
                this.logger.warn(`No streamingSwapMeta found for tx: ${txHash}`);
            }

            // Parse string values to numbers
            const count = parseInt(streamingMeta?.count ?? '1');
            const interval = parseInt(streamingMeta?.interval ?? '1'); // default to 1 block interval
            const quantity = parseInt(streamingMeta?.quantity ?? '1');
            // Calculate estimated duration
            // interval is in blocks, THORChain blocks are ~6 seconds
            const estimatedDurationSeconds = quantity * interval * 6;

            const { $size, inputAmount } = this.getInputAmountAndSizeInUSD(action, txStatus);
            const opportunity: StreamSwapOpportunity = {
                txHash,
                timestamp: new Date(parseInt(action.date) / 1000000), // Convert from nanoseconds to milliseconds
                inputAsset: swapAssets.from,
                outputAsset: swapAssets.to,
                inputAmount,
                outputAmount: streamingMeta?.outEstimation ?? '0',
                $size,
                tradeDirection: swapAssets.direction,
                streamingConfig: {
                    count,
                    quantity,
                    interval,
                },
                estimatedDurationSeconds,
                pools: action.pools ?? [],
                height,
                status: action.status,
                address: action.in[0]?.address ?? '',
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
        const { inputAsset, outputAsset, $size } = opportunity;
        const duration = opportunity.estimatedDurationSeconds.toFixed(0);
        const txHash = opportunity.txHash;

        this.logger.log(
            `[OPPORTUNITY] ${timestamp} | ${inputAsset} -> ${outputAsset} | Size: $${$size} | Duration: ${duration}s | TxHash: ${txHash}`,
        );

        // Additional detailed logging
        this.logger.debug(
            `Stream config: ${opportunity.streamingConfig.count} swaps, ` +
            `${opportunity.streamingConfig.quantity} quantity, ` +
            `${opportunity.streamingConfig.interval} blocks interval`,
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

        const { $size, estimatedDurationSeconds, status } = opportunity;

        if (status !== "pending") {
            this.logger.debug(`Stream swap is over, skipping: ${status}`);
            return;
        }

        const minSize = this.tradeConfigService.getMinOpportunitySize$();
        const minDuration = this.tradeConfigService.getMinOpportunityDurationS();

        if ($size < minSize) {
            this.logger.debug(`Size too small: ${$size}$ (min: $${minSize})`,
            );
            return;
        }

        if (estimatedDurationSeconds < minDuration) {
            this.logger.debug(`Too fast: ${estimatedDurationSeconds}s (min: ${minDuration}s)`,
            );
            return;
        }

        this.logger.log(`Valid opportunity spotted: size=${formatAmount($size)}$, duration=${estimatedDurationSeconds}s, direction=${opportunity.tradeDirection}, txHash=${opportunity.txHash}`);

        this.eventEmitter.emit(
            'validopportunity.detected',
            new ValidOpportunityDetectedEvent(opportunity, opportunity.address),
        );

    }
}

