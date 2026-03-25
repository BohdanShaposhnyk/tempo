import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Res,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getErrorMessage } from 'src/common/utils/error-message.utils';
import { TelegramConfigService } from './telegram-config.service';
import { TelegramService } from './telegram.service';
import { TelegramCommandsService } from './telegram-commands.service';
import type { TelegramUpdate } from './telegram-commands.service';
import { MidgardService } from '../../thorchain/services/midgard.service';
import {
  MidgardAction,
  MidgardActionStatus,
  StreamSwapOpportunity,
} from '../../thorchain/interfaces/thorchain.interface';

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
    private readonly midgardService: MidgardService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Set Telegram bot token and chat ID
   */
  @Post('config')
  async setTelegramConfig(
    @Body() dto: SetTelegramConfigDto,
    @Res() res: Response,
  ) {
    try {
      if (!dto.botToken || !dto.chatId) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Bot token and chat ID are required',
        });
      }

      await this.configService.setTelegramConfig(dto.botToken, dto.chatId);

      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Telegram config stored successfully',
      });
    } catch (error: unknown) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: `Failed to store Telegram config: ${getErrorMessage(error)}`,
      });
    }
  }

  /**
   * Check if Telegram config is configured
   */
  @Get('config/status')
  async getConfigStatus(@Res() res: Response) {
    // satisfy `require-await` without changing behavior
    await Promise.resolve();
    try {
      const hasConfig = this.configService.hasTelegramConfig();

      return res.status(HttpStatus.OK).json({
        success: true,
        configured: hasConfig,
        message: hasConfig
          ? 'Telegram config is configured'
          : 'Telegram config not configured',
      });
    } catch (error: unknown) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: `Failed to check Telegram config status: ${getErrorMessage(error)}`,
      });
    }
  }

  /**
   * Clear stored Telegram config
   */
  @Delete('config')
  async clearTelegramConfig(@Res() res: Response) {
    // satisfy `require-await` without changing behavior
    await Promise.resolve();
    try {
      this.configService.clearTelegramConfig();

      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Telegram config cleared successfully',
      });
    } catch (error: unknown) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: `Failed to clear Telegram config: ${getErrorMessage(error)}`,
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
          message: 'Test message sent successfully',
        });
      } else {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Failed to send test message - check bot token and chat ID',
        });
      }
    } catch (error: unknown) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: `Test failed: ${getErrorMessage(error)}`,
      });
    }
  }

  /**
   * Send test opportunity notification
   * @param direction Optional: 'long' or 'short' (default: 'long')
   */
  @Post('test/opportunity')
  async testOpportunityNotification(@Res() res: Response) {
    try {
      const hasConfig = this.configService.hasTelegramConfig();
      if (!hasConfig) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message:
            'Telegram config not set. Please configure bot token and chat ID first.',
        });
      }

      // Create mock opportunity
      const mockOpportunity: StreamSwapOpportunity = {
        txHash: 'TEST' + Date.now().toString(16).toUpperCase(),
        timestamp: new Date(),
        inputAsset: 'THOR.RUJI',
        outputAsset: 'THOR.TCY',
        inputAmount: '1000000000000', // 10000 in base units
        outputAmount: '500000000000', // 5000 in base units
        streamingConfig: {
          count: 10,
          quantity: 2,
          interval: 3,
        },
        prices: {
          in: 1,
          out: 0.5,
        },
        estimatedDurationSeconds: 180,
        pools: ['THOR.RUJI', 'THOR.TCY'],
        height: '12345678',
        $size: 5000.5,
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
            size: mockOpportunity.$size,
          },
        });
      } else {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Failed to send test opportunity notification',
        });
      }
    } catch (error: unknown) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: `Test failed: ${getErrorMessage(error)}`,
      });
    }
  }

  /**
   * Test historical transaction by fetching from Midgard and emitting action.detected event
   */
  @Post('test/txhash')
  async testHistoricalTx(
    @Body() body: { txHash: string },
    @Res() res: Response,
  ) {
    try {
      const txHash = body.txHash?.trim();
      if (!txHash) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Transaction hash is required',
        });
      }

      // Fetch action from Midgard
      const actions = await this.midgardService.getActionsByTxId(txHash);

      if (!actions || actions.length === 0) {
        return res.status(HttpStatus.NOT_FOUND).json({
          success: false,
          message: `No action found for transaction hash: ${txHash}`,
        });
      }

      // Use the first action (Midgard may return multiple actions for a tx)
      // Remove streamingSwapMeta from metadata to test thornode service
      // Change status to pending so it ain't skipped by the detector
      const action = {
        ...actions[0],
        status: 'pending' as MidgardActionStatus,
        metadata: {
          ...actions[0].metadata,
          swap: {
            ...actions[0].metadata?.swap,
            streamingSwapMeta: undefined,
          },
        },
      } as MidgardAction;

      const height = action.height || '0';

      // Emit action.detected event (same format as PollerService)
      this.eventEmitter.emit('action.detected', {
        action,
        height,
      });

      return res.status(HttpStatus.OK).json({
        success: true,
        message: `Action detected event emitted for transaction: ${txHash}`,
        action: {
          txHash: action.in?.[0]?.txID || txHash,
          type: action.type,
          status: action.status,
          height,
          isStreamSwap: this.midgardService.isStreamSwap(action),
        },
      });
    } catch (error: unknown) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: `Failed to test historical transaction: ${getErrorMessage(error)}`,
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
    } catch (error: unknown) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        ok: false,
        error: getErrorMessage(error),
      });
    }
  }

  /**
   * Serve admin UI
   */
  @Get('admin')
  getAdminUI(@Res() res: Response) {
    return res.sendFile('telegram-admin.html', {
      root: 'src/modules/notifications/telegram/public',
    });
  }
}
