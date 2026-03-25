import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { TradeConfigService } from './trade-config.service';
import { ConfigController } from './config.controller';

@Module({
  imports: [
    NestConfigModule,
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
  ],
  providers: [TradeConfigService],
  controllers: [ConfigController],
  exports: [TradeConfigService],
})
export class ConfigModule {}
