import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { KrakenTradeService } from '../../kraken/services/trade.sevice';
import { StreamSwapOpportunity } from '../../thorchain/interfaces/thorchain.interface';
import { KrakenTradeDetails, TradeExecution } from '../interfaces/trade.interface';
import { TRADE_CONFIG_CONSTANTS } from 'src/common/constants/tradeConfig.constants';

interface ActiveTrade {
    timer: NodeJS.Timeout;
    opportunity: StreamSwapOpportunity;
    entryOrder: KrakenTradeDetails;
    execution: TradeExecution;
}

@Injectable()
export class TradeLifecycleService implements OnModuleDestroy {
    private readonly logger = new Logger(TradeLifecycleService.name);
    private readonly activeTrades = new Map<string, ActiveTrade>();

    constructor(
        private readonly krakenTradeService: KrakenTradeService,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    /**
     * Schedule exit trade based on stream swap duration
     */
    async scheduleExit(opportunity: StreamSwapOpportunity, entryOrder: KrakenTradeDetails): Promise<void> {
        try {
            const tradeId = opportunity.txHash;

            // Calculate exit time (exit before stream swap ends)
            const exitDelayMs = (opportunity.estimatedDurationSeconds - TRADE_CONFIG_CONSTANTS.EXIT_BUFFER_SECONDS) * 1000;

            if (exitDelayMs <= 0) {
                this.logger.warn(`Stream swap duration too short for trade: ${tradeId}`);
                return;
            }

            // Create trade execution record
            const execution: TradeExecution = {
                tradeId,
                entryOrder,
                status: 'active',
                createdAt: new Date(),
            };

            // Set up exit timer
            const timer = setTimeout(async () => {
                await this.executeExit(tradeId);
            }, exitDelayMs);

            // Store active trade
            this.activeTrades.set(tradeId, {
                timer,
                opportunity,
                entryOrder,
                execution,
            });

            this.logger.log(`Exit scheduled for trade ${tradeId} in ${(exitDelayMs / 1000).toFixed(0)}s`);

            // Emit event
            this.eventEmitter.emit('trade.exit.scheduled', {
                tradeId,
                exitTime: new Date(Date.now() + exitDelayMs),
                duration: opportunity.estimatedDurationSeconds,
            });

        } catch (error) {
            this.logger.error(`Failed to schedule exit for trade ${opportunity.txHash}: ${error.message}`);
        }
    }

    /**
     * Execute exit trade
     */
    private async executeExit(tradeId: string): Promise<void> {
        const activeTrade = this.activeTrades.get(tradeId);
        if (!activeTrade) {
            this.logger.warn(`Active trade not found for exit: ${tradeId}`);
            return;
        }

        try {
            const { opportunity, entryOrder, execution } = activeTrade;

            // Determine exit side (opposite of entry)
            const exitSide = entryOrder.side === 'buy' ? 'sell' : 'buy';

            this.logger.log(`Executing exit trade: ${exitSide} ${entryOrder.qty} RUJI`);

            // Execute exit order
            const exitResult = await this.krakenTradeService.placeMarketOrder(
                exitSide,
                entryOrder.qty,
                TRADE_CONFIG_CONSTANTS.DRY_RUN_MODE
            );

            // Create exit order details
            const exitOrder: KrakenTradeDetails = {
                orderId: 'orderId' in exitResult ? exitResult.orderId : `sim_exit_${Date.now()}`,
                side: exitSide,
                qty: entryOrder.qty,
                price: 'avgPrice' in exitResult ? (typeof exitResult.avgPrice === 'number' ? exitResult.avgPrice : entryOrder.price) : entryOrder.price,
                timestamp: new Date(),
                status: 'executed',
            };

            // Calculate PnL
            const pnl = this.calculatePnL(entryOrder, exitOrder);

            // Update execution record
            execution.exitOrder = exitOrder;
            execution.pnl = pnl;
            execution.status = 'completed';
            execution.completedAt = new Date();

            this.logger.log(`Exit trade completed: ${exitOrder.orderId} - PnL: $${pnl.toFixed(4)}`);

            // Emit completion event
            this.eventEmitter.emit('trade.exit.completed', {
                tradeId,
                execution,
                pnl,
            });

            // Clean up
            this.activeTrades.delete(tradeId);

        } catch (error) {
            this.logger.error(`Failed to execute exit for trade ${tradeId}: ${error.message}`);

            // Mark as failed
            const activeTrade = this.activeTrades.get(tradeId);
            if (activeTrade) {
                activeTrade.execution.status = 'failed';
                activeTrade.execution.completedAt = new Date();
                this.activeTrades.delete(tradeId);
            }
        }
    }

    /**
     * Calculate PnL for a completed trade
     */
    private calculatePnL(entryOrder: KrakenTradeDetails, exitOrder: KrakenTradeDetails): number {
        const qty = entryOrder.qty;
        const entryPrice = entryOrder.price;
        const exitPrice = exitOrder.price;

        if (entryOrder.side === 'buy') {
            // Long trade: profit = (exit_price - entry_price) * qty
            return (exitPrice - entryPrice) * qty;
        } else {
            // Short trade: profit = (entry_price - exit_price) * qty
            return (entryPrice - exitPrice) * qty;
        }
    }

    /**
     * Get all active trades
     */
    getActiveTrades(): TradeExecution[] {
        return Array.from(this.activeTrades.values()).map(trade => trade.execution);
    }

    /**
     * Cancel a scheduled exit (if needed)
     */
    cancelExit(tradeId: string): boolean {
        const activeTrade = this.activeTrades.get(tradeId);
        if (activeTrade) {
            clearTimeout(activeTrade.timer);
            this.activeTrades.delete(tradeId);
            this.logger.log(`Exit cancelled for trade: ${tradeId}`);
            return true;
        }
        return false;
    }

    /**
     * Clean up on module destroy
     */
    onModuleDestroy() {
        this.logger.log('Cleaning up active trades...');

        for (const [tradeId, activeTrade] of this.activeTrades) {
            clearTimeout(activeTrade.timer);
            this.logger.log(`Cleaned up trade: ${tradeId}`);
        }

        this.activeTrades.clear();
    }
}
