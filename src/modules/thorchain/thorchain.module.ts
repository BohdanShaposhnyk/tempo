import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PollerService } from './services/poller.service';
import { MidgardService } from './services/midgard.service';
import { DetectorService } from './services/detector.service';
import { ThorchainHealthIndicator } from './services/thorchain.health';
// import { TradeService } from './services/trade.sevice';
import { TradePlannerService } from './services/tradePlanner.service';

@Module({
    imports: [
        HttpModule.register({
            timeout: 10000,
            maxRedirects: 5,
        }),
        ConfigModule,
        EventEmitterModule,
    ],
    providers: [
        PollerService,
        MidgardService,
        DetectorService,
        // TradeService,
        TradePlannerService,
        ThorchainHealthIndicator,
    ],
    exports: [ThorchainHealthIndicator],
})
export class ThorchainModule { }

