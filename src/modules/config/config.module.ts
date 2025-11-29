import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ApiKeyService } from './apikey.service';
import { TradeConfigService } from './trade-config.service';
import { ConfigController } from './config.controller';
import { KrakenAuthService } from '../kraken/services/auth.service';

@Module({
    imports: [
        NestConfigModule,
        HttpModule.register({
            timeout: 10000,
            maxRedirects: 5,
        }),
    ],
    providers: [
        ApiKeyService,
        TradeConfigService,
        KrakenAuthService,
    ],
    controllers: [ConfigController],
    exports: [ApiKeyService, TradeConfigService, KrakenAuthService],
})
export class ConfigModule { }
