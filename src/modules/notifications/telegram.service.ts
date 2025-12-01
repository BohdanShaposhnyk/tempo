import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, catchError } from 'rxjs';
import { of } from 'rxjs';
import { AxiosError } from 'axios';
import { TelegramConfigService } from './telegram-config.service';
import { StreamSwapOpportunity } from '../thorchain/interfaces/thorchain.interface';
import { TradeDirection } from '../thorchain/interfaces/trade.interface';
import { formatAmount } from 'src/common/utils/format.utils';

@Injectable()
export class TelegramService {
    private readonly logger = new Logger(TelegramService.name);
    private readonly apiUrl = 'https://api.telegram.org';

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: TelegramConfigService,
    ) { }

    /**
     * Send notification to Telegram
     * @param isTest If true, marks the message as a test notification
     */
    async sendNotification(opportunity: StreamSwapOpportunity, address: string, isTest = false): Promise<boolean> {
        try {
            const config = await this.configService.getTelegramConfig();

            if (!config.botToken || !config.chatId) {
                this.logger.warn('Telegram config not set, skipping notification');
                return false;
            }

            const message = this.formatMessage(opportunity, address, isTest);
            const success = await this.sendMessage(config.chatId, message, 'Markdown', true);

            if (success) {
                this.logger.debug(`Telegram notification sent successfully for tx ${opportunity.txHash}`);
            } else {
                this.logger.warn(`Failed to send Telegram notification for tx ${opportunity.txHash}`);
            }

            return success;
        } catch (error) {
            this.logger.error(`Error sending Telegram notification: ${error.message}`);
            return false;
        }
    }

    /**
     * Format notification message
     */
    private trimAssetName(text: string): string {
        return text.replace(/^.*[.\-\/]/, '');
    }

    private formatMessage(
        opportunity: StreamSwapOpportunity,
        address: string,
        isTest = false
    ): string {
        const { tradeDirection, $size, inputAsset, outputAsset, inputAmount, txHash, prices } = opportunity;

        const emoji = tradeDirection === TradeDirection.long ? '🟢' : '🔴';
        const directionText = tradeDirection === TradeDirection.long ? '*RUJI* bought!' : '*RUJI* dumped!';

        const formattedInputAmount = formatAmount(inputAmount).toFixed(2);
        const outputAmount = `≈ ${Number($size / (prices?.out ?? 1)).toFixed(0)}`;
        const formattedSize = $size.toFixed(0);

        const txLink = `[tx](https://thorchain.net/tx/${txHash})`;
        const addressLink = `[${address.slice(0, 5)}...${address.slice(-5)}](https://thorchain.net/address/${address})`;

        const escInputAsset = this.trimAssetName(inputAsset);
        const escOutputAsset = this.trimAssetName(outputAsset);

        const testPrefix = isTest ? '🧪 *TEST NOTIFICATION*\n\n' : '';

        return (
            `${testPrefix}${emoji} *$${formattedSize}* ${directionText}\n\n` +
            `    ${formattedInputAmount} *${escInputAsset}* → ${outputAmount} *${escOutputAsset}*\n\n` +
            `    ${txLink} · ${addressLink}`
        );
    }

    /**
     * Send test message
     */
    async sendTestMessage(): Promise<boolean> {
        try {
            const config = await this.configService.getTelegramConfig();

            if (!config.botToken || !config.chatId) {
                return false;
            }

            const testMessage = '✅ Telegram notification test - configuration successful!';
            return await this.sendMessage(config.chatId, testMessage, null);
        } catch (error) {
            this.logger.error(`Error sending test message: ${error.message}`);
            return false;
        }
    }

    /**
     * Send arbitrary message to Telegram chat
     * @param chatId Chat ID to send message to
     * @param text Message text
     * @param parseMode Optional parse mode (Markdown, HTML, etc.)
     * @param disableWebPagePreview Optional flag to disable web page preview
     */
    async sendMessage(
        chatId: string,
        text: string,
        parseMode: 'Markdown' | 'HTML' | null = 'Markdown',
        disableWebPagePreview = false,
    ): Promise<boolean> {
        try {
            const config = await this.configService.getTelegramConfig();

            if (!config.botToken) {
                this.logger.warn('Telegram bot token not configured');
                return false;
            }

            const url = `${this.apiUrl}/bot${config.botToken}/sendMessage`;
            const payload: any = {
                chat_id: chatId,
                text,
            };

            if (parseMode) {
                payload.parse_mode = parseMode;
            }

            if (disableWebPagePreview) {
                payload.disable_web_page_preview = true;
            }

            const response = await firstValueFrom(
                this.httpService.post(url, payload).pipe(
                    catchError((error: AxiosError) => {
                        if (error.response) {
                            const errorData = error.response.data;
                            this.logger.error(
                                `Telegram API error: ${error.response.status} - ${JSON.stringify(errorData)}`,
                            );
                            // Log the actual error description from Telegram
                            if (errorData && typeof errorData === 'object' && 'description' in errorData) {
                                this.logger.error(`Telegram error description: ${errorData.description}`);
                            }
                        } else if (error.request) {
                            this.logger.error(`Telegram API request failed (no response): ${error.message || JSON.stringify(error.request)}`);
                        } else {
                            this.logger.error(`Telegram API error: ${error.message || JSON.stringify(error)}`);
                        }
                        return of(null);
                    }),
                ),
            );

            return response?.data?.ok === true;
        } catch (error) {
            this.logger.error(`Error sending message: ${error.message}`);
            return false;
        }
    }
}

