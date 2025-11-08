import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { KrakenModule } from '../kraken/kraken.module';
import { TradePlannerService } from './services/tradePlanner.service';
import { TradeLifecycleService } from './services/tradeLifecycle.service';

@Module({
    imports: [
        EventEmitterModule,
        KrakenModule,
    ],
    providers: [
        TradePlannerService,
        TradeLifecycleService,
    ],
    exports: [
        TradePlannerService,
        TradeLifecycleService,
    ],
})
export class TradeModule { }
