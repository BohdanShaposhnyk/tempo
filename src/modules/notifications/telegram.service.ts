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
            const url = `${this.apiUrl}/bot${config.botToken}/sendMessage`;

            const response = await firstValueFrom(
                this.httpService.post(url, {
                    chat_id: config.chatId,
                    text: message,
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true
                }).pipe(
                    catchError((error: AxiosError) => {
                        if (error.response) {
                            this.logger.error(
                                `Telegram API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`,
                            );
                        } else {
                            this.logger.error(`Telegram API request failed: ${error.message}`);
                        }
                        return of(null);
                    }),
                ),
            );

            if (response && response.data?.ok) {
                this.logger.debug(`Telegram notification sent successfully for tx ${opportunity.txHash}`);
                return true;
            } else {
                this.logger.warn(`Failed to send Telegram notification: ${response?.data?.description || 'Unknown error'}`);
                return false;
            }
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
        const { tradeDirection, $size, inputAsset, outputAsset, inputAmount, outputAmount, txHash } = opportunity;

        const emoji = tradeDirection === TradeDirection.long ? '🟢' : '🔴';
        const directionText = tradeDirection === TradeDirection.long ? '*RUJI* bought!' : '*RUJI* dumped!';

        const formattedInputAmount = formatAmount(inputAmount).toFixed(2);
        const formattedOutputAmount = formatAmount(outputAmount).toFixed(2);
        const formattedSize = $size.toFixed(0);

        const txLink = `[tx](https://thorchain.net/tx/${txHash})`;
        const addressLink = `[${address.slice(0, 5)}...${address.slice(-5)}](https://thorchain.net/address/${address})`;

        const escInputAsset = this.trimAssetName(inputAsset);
        const escOutputAsset = this.trimAssetName(outputAsset);

        const testPrefix = isTest ? '🧪 *TEST NOTIFICATION*\n\n' : '';

        return (
            `${testPrefix}${emoji} *$${formattedSize}* ${directionText}\n\n` +
            `    ${formattedInputAmount} *${escInputAsset}* → ${formattedOutputAmount} *${escOutputAsset}*\n\n` +
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

            const url = `${this.apiUrl}/bot${config.botToken}/sendMessage`;
            const testMessage = '✅ Telegram notification test - configuration successful!';

            const response = await firstValueFrom(
                this.httpService.post(url, {
                    chat_id: config.chatId,
                    text: testMessage,
                }).pipe(
                    catchError((error: AxiosError) => {
                        if (error.response) {
                            this.logger.error(
                                `Telegram test error: ${error.response.status} - ${JSON.stringify(error.response.data)}`,
                            );
                        }
                        return of(null);
                    }),
                ),
            );

            return response?.data?.ok === true;
        } catch (error) {
            this.logger.error(`Error sending test message: ${error.message}`);
            return false;
        }
    }
}

