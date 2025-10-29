import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { KrakenTradeService } from './services/trade.sevice';

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
    ],
    exports: [KrakenTradeService],
})
export class KrakenModule { }

