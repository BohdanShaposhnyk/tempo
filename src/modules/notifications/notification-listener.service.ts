import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ValidOpportunityDetectedEvent } from '../thorchain/events/thorchain.events';
import { TelegramService } from './telegram/telegram.service';

@Injectable()
export class NotificationListenerService implements OnApplicationBootstrap {
    private readonly logger = new Logger(NotificationListenerService.name);

    constructor(private readonly telegramService: TelegramService) { }

    onApplicationBootstrap() {
        this.logger.log('Notification listener initialized and ready');
    }

    /**
     * Listen for valid opportunity detected events and send Telegram notifications
     */
    @OnEvent('validopportunity.detected', { async: true })
    async handleValidOpportunityDetected(event: ValidOpportunityDetectedEvent): Promise<void> {
        try {
            const { opportunity, address } = event;

            this.logger.debug(`Sending Telegram notification for opportunity: ${opportunity.txHash}`);

            const success = await this.telegramService.sendNotification(opportunity, address);

            if (success) {
                this.logger.log(`Telegram notification sent successfully for tx ${opportunity.txHash}`);
            } else {
                this.logger.warn(`Failed to send Telegram notification for tx ${opportunity.txHash}`);
            }
        } catch (error) {
            // Don't crash on notification failures - just log the error
            this.logger.error(`Error sending Telegram notification: ${error.message}`);
        }
    }
}

