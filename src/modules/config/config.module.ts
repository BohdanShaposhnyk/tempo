import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ApiKeyService } from './apikey.service';
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
        KrakenAuthService,
    ],
    controllers: [ConfigController],
    exports: [ApiKeyService, KrakenAuthService],
})
export class ConfigModule { }
