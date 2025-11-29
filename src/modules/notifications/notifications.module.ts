import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TelegramConfigService } from './telegram-config.service';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { NotificationListenerService } from './notification-listener.service';

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
        TelegramConfigService,
        TelegramService,
        NotificationListenerService,
    ],
    controllers: [TelegramController],
    exports: [TelegramService],
})
export class NotificationsModule { }

