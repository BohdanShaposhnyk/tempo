import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MidgardService } from './midgard.service';
import { THORCHAIN_CONSTANTS } from 'src/common/constants/thorchain.constants';
import { TRADE_CONFIG_CONSTANTS } from 'src/common/constants/tradeConfig.constants';
import { ValidOpportunityDetectedEvent } from '../events/thorchain.events';
import { MidgardAction, StreamSwapOpportunity, TradeDirection } from '../interfaces/thorchain.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class TradeService implements OnApplicationBootstrap {
    private readonly logger = new Logger(TradeService.name);

    constructor(
        private readonly midgardService: MidgardService,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    onApplicationBootstrap() {
        this.logger.log('Trade service initialized and ready');
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

