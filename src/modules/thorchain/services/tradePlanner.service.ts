import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MidgardService } from './midgard.service';
import { ValidOpportunityDetectedEvent } from '../events/thorchain.events';
import { TradeDirection } from '../interfaces/trade.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TradeService } from './trade.sevice';

@Injectable()
export class TradePlannerService implements OnApplicationBootstrap {
    private readonly logger = new Logger(TradePlannerService.name);

    constructor(
        private readonly midgardService: MidgardService,
        private readonly tradeService: TradeService,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    onApplicationBootstrap() {
        this.logger.log('TradePlanner service initialized and ready');
    }

    /**
     * Listen for valid opportunity detected events (for potential future processing)
     */
    @OnEvent('validopportunity.detected')
    handleValidOpportunityDetected(event: ValidOpportunityDetectedEvent): void {
        const { opportunity } = event;

        this.logger.debug(
            `Starting trade: ${opportunity.txHash}`,
        );

        const { $size, estimatedDurationSeconds, tradeDirection } = opportunity;

        if (tradeDirection === TradeDirection.long) {
            this.logger.log(`Long trade: ${opportunity.txHash}`);
        } else {
            this.logger.log(`Short trade: ${opportunity.txHash}`);
        }
    }
}

