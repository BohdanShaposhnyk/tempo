import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '../config/config.module';
import { ThorchainModule } from '../thorchain/thorchain.module';
import { TelegramConfigService } from './telegram/telegram-config.service';
import { TelegramService } from './telegram/telegram.service';
import { TelegramCommandsService } from './telegram/telegram-commands.service';
import { TelegramController } from './telegram/telegram.controller';
import { NotificationListenerService } from './notification-listener.service';
import { WebSocketNotificationGateway } from './ws/websocket-notification.gateway';

@Module({
    imports: [
        HttpModule.register({
            timeout: 10000,
            maxRedirects: 5,
        }),
        NestConfigModule,
        ConfigModule,
        EventEmitterModule,
        ThorchainModule,
    ],
    providers: [
        TelegramConfigService,
        TelegramService,
        TelegramCommandsService,
        NotificationListenerService,
        WebSocketNotificationGateway,
    ],
    controllers: [TelegramController],
    exports: [TelegramService, WebSocketNotificationGateway],
})
export class NotificationsModule { }

