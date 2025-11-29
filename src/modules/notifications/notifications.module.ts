import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '../config/config.module';
import { TelegramConfigService } from './telegram-config.service';
import { TelegramService } from './telegram.service';
import { TelegramCommandsService } from './telegram-commands.service';
import { TelegramController } from './telegram.controller';
import { NotificationListenerService } from './notification-listener.service';

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
        TelegramConfigService,
        TelegramService,
        TelegramCommandsService,
        NotificationListenerService,
    ],
    controllers: [TelegramController],
    exports: [TelegramService],
})
export class NotificationsModule { }

