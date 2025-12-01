import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '../config/config.module';
import { PollerService } from './services/poller.service';
import { MidgardService } from './services/midgard.service';
import { ThornodeService } from './services/thornode.service';
import { DetectorService } from './services/detector.service';
import { ThorchainHealthIndicator } from './services/thorchain.health';

@Module({
    imports: [
        HttpModule.register({
            timeout: 10000,
            maxRedirects: 5,
        }),
        NestConfigModule,
        ConfigModule,
        EventEmitterModule,
    ],
    providers: [
        PollerService,
        MidgardService,
        ThornodeService,
        DetectorService,
        ThorchainHealthIndicator,
    ],
    exports: [ThorchainHealthIndicator, MidgardService],
})
export class ThorchainModule { }

