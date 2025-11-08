import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '../config/config.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { KrakenTradeService } from './services/trade.sevice';
import { KrakenAuthService } from './services/auth.service';

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
        KrakenTradeService,
        KrakenAuthService,
    ],
    exports: [KrakenTradeService, KrakenAuthService],
})
export class KrakenModule { }

