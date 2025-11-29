import { Controller, Post, Get, Delete, Body, Res, HttpStatus, Query } from '@nestjs/common';
import type { Response } from 'express';
import { TelegramConfigService } from './telegram-config.service';
import { TelegramService } from './telegram.service';
import { TelegramCommandsService } from './telegram-commands.service';
import type { TelegramUpdate } from './telegram-commands.service';
import { StreamSwapOpportunity } from '../thorchain/interfaces/thorchain.interface';
import { TradeDirection } from '../thorchain/interfaces/trade.interface';

interface SetTelegramConfigDto {
    botToken: string;
    chatId: string;
}

@Controller('notifications/telegram')
export class TelegramController {
    constructor(
        private readonly configService: TelegramConfigService,
        private readonly telegramService: TelegramService,
        private readonly commandsService: TelegramCommandsService,
    ) { }

    /**
     * Set Telegram bot token and chat ID
     */
    @Post('config')
    async setTelegramConfig(@Body() dto: SetTelegramConfigDto, @Res() res: Response) {
        try {
            if (!dto.botToken || !dto.chatId) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: 'Bot token and chat ID are required'
                });
            }

            await this.configService.setTelegramConfig(dto.botToken, dto.chatId);

            return res.status(HttpStatus.OK).json({
                success: true,
                message: 'Telegram config stored successfully'
            });
        } catch (error) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: `Failed to store Telegram config: ${error.message}`
            });
        }
    }

    /**
     * Check if Telegram config is configured
     */
    @Get('config/status')
    async getConfigStatus(@Res() res: Response) {
        try {
            const hasConfig = this.configService.hasTelegramConfig();

            return res.status(HttpStatus.OK).json({
                success: true,
                configured: hasConfig,
                message: hasConfig ? 'Telegram config is configured' : 'Telegram config not configured'
            });
        } catch (error) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: `Failed to check Telegram config status: ${error.message}`
            });
        }
    }

    /**
     * Clear stored Telegram config
     */
    @Delete('config')
    async clearTelegramConfig(@Res() res: Response) {
        try {
            this.configService.clearTelegramConfig();

            return res.status(HttpStatus.OK).json({
                success: true,
                message: 'Telegram config cleared successfully'
            });
        } catch (error) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: `Failed to clear Telegram config: ${error.message}`
            });
        }
    }

    /**
     * Test Telegram connection
     */
    @Post('test')
    async testConnection(@Res() res: Response) {
        try {
            const success = await this.telegramService.sendTestMessage();

            if (success) {
                return res.status(HttpStatus.OK).json({
                    success: true,
                    message: 'Test message sent successfully'
                });
            } else {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: 'Failed to send test message - check bot token and chat ID'
                });
            }
        } catch (error) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: `Test failed: ${error.message}`
            });
        }
    }

    /**
     * Send test opportunity notification
     * @param direction Optional: 'long' or 'short' (default: 'long')
     */
    @Post('test/opportunity')
    async testOpportunityNotification(
        @Query('direction') direction: 'long' | 'short' = 'long',
        @Res() res: Response,
    ) {
        try {
            const hasConfig = this.configService.hasTelegramConfig();
            if (!hasConfig) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: 'Telegram config not set. Please configure bot token and chat ID first.'
                });
            }

            // Create mock opportunity
            const mockOpportunity: StreamSwapOpportunity = {
                txHash: 'TEST' + Date.now().toString(16).toUpperCase(),
                timestamp: new Date(),
                inputAsset: direction === 'short' ? 'THOR.RUJI' : 'THOR.TCY',
                outputAsset: direction === 'short' ? 'THOR.TCY' : 'THOR.RUJI',
                inputAmount: '1000000000000', // 10000 in base units
                outputAmount: '500000000000', // 5000 in base units
                streamingConfig: {
                    count: 10,
                    quantity: 2,
                    interval: 3,
                },
                estimatedDurationSeconds: 180,
                pools: ['THOR.RUJI', 'THOR.TCY'],
                height: '12345678',
                $size: 5000.50,
                tradeDirection: direction === 'short' ? TradeDirection.short : TradeDirection.long,
                status: 'pending',
                address: 'thor1test1234567890abcdefghijklmnopqrstuvwxyz',
            };

            const success = await this.telegramService.sendNotification(
                mockOpportunity,
                mockOpportunity.address,
                true, // isTest = true
            );

            if (success) {
                return res.status(HttpStatus.OK).json({
                    success: true,
                    message: 'Test opportunity notification sent successfully',
                    opportunity: {
                        txHash: mockOpportunity.txHash,
                        direction: mockOpportunity.tradeDirection,
                        size: mockOpportunity.$size,
                    },
                });
            } else {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: 'Failed to send test opportunity notification'
                });
            }
        } catch (error) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: `Test failed: ${error.message}`
            });
        }
    }

    /**
     * Telegram webhook endpoint
     */
    @Post('webhook')
    async handleWebhook(@Body() update: TelegramUpdate, @Res() res: Response) {
        try {
            await this.commandsService.handleMessage(update);
            return res.status(HttpStatus.OK).json({ ok: true });
        } catch (error) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                ok: false,
                error: error.message,
            });
        }
    }

    /**
     * Serve admin UI
     */
    @Get('admin')
    async getAdminUI(@Res() res: Response) {
        return res.sendFile('telegram-admin.html', { root: 'src/modules/notifications/public' });
    }
}

