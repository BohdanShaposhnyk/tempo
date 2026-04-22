import { Injectable, Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TradeConfigService } from '../../config/trade-config.service';
import { getErrorMessage } from 'src/common/utils/error-message.utils';

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    date: number;
    text?: string;
  };
}

@Injectable()
export class TelegramCommandsService {
  private readonly logger = new Logger(TelegramCommandsService.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly tradeConfigService: TradeConfigService,
  ) {}

  /**
   * Handle incoming Telegram message/command
   */
  async handleMessage(update: TelegramUpdate): Promise<void> {
    if (!update.message || !update.message.text) {
      return;
    }

    const { text, chat } = update.message;
    const chatId = chat.id.toString();

    // Check if it's a command
    if (!text.startsWith('/')) {
      return;
    }

    const [command, ...args] = text.split(/\s+/);
    const commandLower = command.toLowerCase();

    try {
      switch (commandLower) {
        case '/set_min_size':
          await this.handleSetMinSize(chatId, args);
          break;
        case '/set_min_duration':
          await this.handleSetMinDuration(chatId, args);
          break;
        case '/get_config':
          await this.handleGetConfig(chatId);
          break;
        case '/set_assets':
          await this.handleSetAssets(chatId, args);
          break;
        case '/set_midgard_delay':
          await this.handleSetMidgardDelay(chatId, args);
          break;
        case '/help':
          await this.handleHelp(chatId);
          break;
        default:
          await this.sendMessage(
            chatId,
            `Unknown command: ${command}\nUse /help to see available commands.`,
          );
      }
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      this.logger.error(`Error handling command ${command}: ${message}`);
      await this.sendMessage(chatId, `❌ Error: ${message}`);
    }
  }

  /**
   * Handle /set_min_size command
   */
  private async handleSetMinSize(
    chatId: string,
    args: string[],
  ): Promise<void> {
    if (args.length === 0) {
      await this.sendMessage(
        chatId,
        'Usage: /set_min_size <amount>\nExample: /set_min_size 5000',
      );
      return;
    }

    const amount = parseFloat(args[0]);
    if (isNaN(amount) || amount <= 0) {
      await this.sendMessage(
        chatId,
        '❌ Invalid amount. Please provide a positive number.',
      );
      return;
    }

    this.tradeConfigService.setMinOpportunitySize$(amount);
    await this.sendMessage(
      chatId,
      `✅ Minimum opportunity size set to *$${amount}*`,
    );
  }

  /**
   * Handle /set_min_duration command
   */
  private async handleSetMinDuration(
    chatId: string,
    args: string[],
  ): Promise<void> {
    if (args.length === 0) {
      await this.sendMessage(
        chatId,
        'Usage: /set_min_duration <seconds>\nExample: /set_min_duration 60',
      );
      return;
    }

    const duration = parseFloat(args[0]);
    if (isNaN(duration) || duration <= 0) {
      await this.sendMessage(
        chatId,
        '❌ Invalid duration. Please provide a positive number.',
      );
      return;
    }

    this.tradeConfigService.setMinOpportunityDurationS(duration);
    await this.sendMessage(
      chatId,
      `✅ Minimum opportunity duration set to *${duration}s*`,
    );
  }

  /**
   * Handle /get_config command
   */
  private async handleGetConfig(chatId: string): Promise<void> {
    const config = this.tradeConfigService.getConfig();
    const assetsLine = config.assets.length
      ? config.assets.map((a) => `  • \`${a}\``).join('\n')
      : '  _(none)_';
    const message =
      `*Current Configuration:*\n\n` +
      `💰 Min Size: *$${config.minSize}*\n` +
      `⏱️ Min Duration: *${config.minDuration}s*\n` +
      `⏳ Midgard inter-asset delay: *${config.midgardInterAssetDelayMs}ms*\n` +
      `🪙 Monitored assets:\n${assetsLine}`;
    await this.sendMessage(chatId, message);
  }

  /**
   * Parse asset list from Telegram args (space and/or comma separated)
   */
  private parseAssetArgs(args: string[]): string[] {
    if (args.length === 0) {
      return [];
    }
    const joined = args.join(' ');
    return joined
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  /**
   * Handle /set_assets command
   */
  private async handleSetAssets(chatId: string, args: string[]): Promise<void> {
    const assets = this.parseAssetArgs(args);
    if (assets.length === 0) {
      await this.sendMessage(
        chatId,
        'Usage: /set_assets <asset1> [asset2] ...\nExample: /set_assets THOR.RUJI THOR.TCY\nOr: /set_assets THOR.RUJI,THOR.TCY',
      );
      return;
    }

    this.tradeConfigService.setMonitoredAssets(assets);
    await this.sendMessage(
      chatId,
      `✅ Monitored assets set to:\n${assets.map((a) => `• \`${a}\``).join('\n')}`,
    );
  }

  /**
   * Handle /set_midgard_delay command
   */
  private async handleSetMidgardDelay(
    chatId: string,
    args: string[],
  ): Promise<void> {
    if (args.length === 0) {
      await this.sendMessage(
        chatId,
        'Usage: /set_midgard_delay <milliseconds>\nExample: /set_midgard_delay 500',
      );
      return;
    }

    const ms = parseFloat(args[0]);
    if (isNaN(ms) || !isFinite(ms) || ms < 0) {
      await this.sendMessage(
        chatId,
        '❌ Invalid value. Please provide a non-negative number of milliseconds.',
      );
      return;
    }

    this.tradeConfigService.setMidgardInterAssetDelayMs(ms);
    await this.sendMessage(
      chatId,
      `✅ Midgard inter-asset delay set to *${ms}ms*`,
    );
  }

  /**
   * Handle /help command
   */
  private async handleHelp(chatId: string): Promise<void> {
    const message =
      `*Available Commands:*\n\n` +
      `💰 /set_min_size <amount> - Set minimum opportunity size in USD\n` +
      `⏱️ /set_min_duration <seconds> - Set minimum opportunity duration\n` +
      `⏳ /set_midgard_delay <ms> - Delay between per-asset Midgard polling calls (reduces 429s)\n` +
      `🪙 /set_assets <asset> [...] - Set Midgard monitored assets (comma or space separated)\n` +
      `📊 /get_config - Show current configuration\n` +
      `❓ /help - Show this help message`;
    await this.sendMessage(chatId, message);
  }

  /**
   * Send message to Telegram chat
   */
  private async sendMessage(chatId: string, text: string): Promise<void> {
    await this.telegramService.sendMessage(chatId, text, 'Markdown');
  }
}
