import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { KrakenTradeService } from '../../kraken/services/trade.sevice';
import { TradeLifecycleService } from './tradeLifecycle.service';
import { ValidOpportunityDetectedEvent } from '../../thorchain/events/thorchain.events';
import { StreamSwapOpportunity } from '../../thorchain/interfaces/thorchain.interface';
import { TradeDirection } from '../interfaces/trade.interface';
import { TRADE_CONFIG_CONSTANTS } from 'src/common/constants/tradeConfig.constants';

@Injectable()
export class TradePlannerService implements OnApplicationBootstrap {
    private readonly logger = new Logger(TradePlannerService.name);

    constructor(
        private readonly krakenTradeService: KrakenTradeService,
        private readonly tradeLifecycleService: TradeLifecycleService,
    ) { }

    onApplicationBootstrap() {
        this.logger.log('TradePlanner service initialized and ready');
    }

    /**
     * Listen for valid opportunity detected events and orchestrate entry trade
     */
    @OnEvent('validopportunity.detected')
    async handleValidOpportunityDetected(event: ValidOpportunityDetectedEvent): Promise<void> {
        const { opportunity } = event;

        try {
            this.logger.log(`Processing opportunity: ${opportunity.txHash} - ${opportunity.tradeDirection}`);

            // 1. Determine Kraken trade side (same direction as streamswap)
            const krakenSide = this.determineKrakenSide(opportunity.tradeDirection);

            // 2. Calculate trade size in RUJI qty
            const tradeQty = await this.calculateTradeSize(opportunity);

            // 3. Check Kraken orderbook depth
            const orderbook = await this.krakenTradeService.getOrderBook(TRADE_CONFIG_CONSTANTS.KRAKEN_PAIR);

            // 4. Validate sufficient liquidity
            const simulation = this.krakenTradeService.simulateMarketTrade(orderbook, krakenSide, tradeQty);

            if (!simulation.executed) {
                this.logger.warn(`Insufficient liquidity for trade: ${opportunity.txHash}`);
                return;
            }

            if (Math.abs(simulation.slippagePct) > TRADE_CONFIG_CONSTANTS.MAX_SLIPPAGE_PCT) {
                this.logger.warn(`Slippage too high (${simulation.slippagePct.toFixed(2)}%): ${opportunity.txHash}`);
                return;
            }

            // 5. Execute entry trade
            this.logger.log(`Executing ${krakenSide} order for ${tradeQty} RUJI (estimated price: $${simulation.avgPrice.toFixed(4)})`);

            const entryResult = await this.krakenTradeService.placeMarketOrder(
                krakenSide,
                tradeQty,
                TRADE_CONFIG_CONSTANTS.DRY_RUN_MODE
            );

            // 6. Store order details
            const orderDetails = {
                orderId: 'orderId' in entryResult ? entryResult.orderId : `sim_${Date.now()}`,
                side: krakenSide,
                qty: tradeQty,
                price: simulation.avgPrice,
                timestamp: new Date(),
                status: 'executed',
            };

            // 7. Delegate to TradeLifecycleService for exit scheduling
            await this.tradeLifecycleService.scheduleExit(opportunity, orderDetails);

            this.logger.log(`Entry trade executed successfully: ${orderDetails.orderId}`);

        } catch (error) {
            this.logger.error(`Failed to process opportunity ${opportunity.txHash}: ${error.message}`);
        }
    }

    /**
     * Determine Kraken trade side based on streamswap direction
     */
    private determineKrakenSide(tradeDirection: TradeDirection): 'buy' | 'sell' {
        // Same direction as streamswap:
        // - short (RUJI→X streamswap) = SELL RUJI on Kraken
        // - long (X→RUJI streamswap) = BUY RUJI on Kraken
        return tradeDirection === TradeDirection.long ? 'buy' : 'sell';
    }

    /**
     * Calculate trade size in RUJI quantity
     */
    private async calculateTradeSize(opportunity: StreamSwapOpportunity): Promise<number> {
        try {
            // Get current RUJI price from orderbook
            const orderbook = await this.krakenTradeService.getOrderBook(TRADE_CONFIG_CONSTANTS.KRAKEN_PAIR);
            const midPrice = (parseFloat(orderbook.bids[0][0]) + parseFloat(orderbook.asks[0][0])) / 2;

            // Calculate RUJI quantity based on dollar amount
            const tradeQty = TRADE_CONFIG_CONSTANTS.TADE_SIZE_$ / midPrice;

            this.logger.debug(`Trade size calculation: $${TRADE_CONFIG_CONSTANTS.TADE_SIZE_$} / $${midPrice.toFixed(4)} = ${tradeQty.toFixed(6)} RUJI`);

            return tradeQty;
        } catch (error) {
            this.logger.error(`Failed to calculate trade size: ${error.message}`);
            // Fallback to a small fixed amount
            return 0.001;
        }
    }
}
