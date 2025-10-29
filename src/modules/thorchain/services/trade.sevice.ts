import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MidgardService } from './midgard.service';
import { THORCHAIN_CONSTANTS } from 'src/common/constants/thorchain.constants';
import { TRADE_CONFIG_CONSTANTS } from 'src/common/constants/tradeConfig.constants';
import { StreamSwapOpportunity } from '../interfaces/thorchain.interface';
import { TradeDirection } from '../interfaces/trade.interface';
import { Trade, TradeState } from '../interfaces/trade.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { formatAmount } from 'src/common/utils/format.utils';

@Injectable()
export class TradeService implements OnApplicationBootstrap {
    private readonly logger = new Logger(TradeService.name);
    private readonly trades = new Map<string, Trade>();

    constructor(
        private readonly midgardService: MidgardService,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    private getInputAmount(opportunity: StreamSwapOpportunity): number {
        const $size = TRADE_CONFIG_CONSTANTS.TADE_SIZE_$; // TODO: get from trade planner

        return $size / formatAmount(opportunity.inputAmount);
    }

    createTrade(opportunity: StreamSwapOpportunity): Trade {
        const [inputAsset, outputAsset] = opportunity.tradeDirection === TradeDirection.long
            ? [THORCHAIN_CONSTANTS.RUJI_TOKEN, THORCHAIN_CONSTANTS.RUNE_TOKEN]
            : [THORCHAIN_CONSTANTS.RUNE_TOKEN, THORCHAIN_CONSTANTS.RUJI_TOKEN];

        const trade: Trade = {
            id: opportunity.txHash,
            signalTxHash: opportunity.txHash,
            pool: THORCHAIN_CONSTANTS.RUJI_RUNE_POOL,
            direction: opportunity.tradeDirection,
            inputAsset,
            outputAsset,
            inputAmount: this.getInputAmount(opportunity),
            state: 'detected',
            detectedAt: new Date(),
        };

        this.trades.set(trade.id, trade);
        this.logger.debug(`New trade detected: ${trade.id}`);
        return trade;
    }

    updateState(id: string, newState: TradeState) {
        const trade = this.trades.get(id);
        if (!trade) throw new Error(`Trade ${id} not found`);
        trade.state = newState;
        this.trades.set(id, trade);
        this.logger.debug(`Trade ${id} moved to state ${newState}`);
    }

    getActiveTrades(): Trade[] {
        return [...this.trades.values()].filter(t =>
            ['detected', 'planned', 'submitted', 'confirmed', 'exiting'].includes(t.state)
        );
    }

    getAllTrades(): Trade[] {
        return [...this.trades.values()];
    }

    onApplicationBootstrap() {
        this.logger.log('Trade service initialized and ready');
    }


}

