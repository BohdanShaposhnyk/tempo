import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export interface TelegramConfig {
    botToken: string;
    chatId: string;
}

@Injectable()
export class TelegramConfigService {
    private readonly logger = new Logger(TelegramConfigService.name);
    private readonly algorithm = 'aes-256-gcm';
    private encryptedBotToken: string | null = null;
    private encryptedChatId: string | null = null;
    private iv: Buffer | null = null;
    private botTokenTag: Buffer | null = null;
    private chatIdTag: Buffer | null = null;

    constructor() {
        const encryptionSecret = process.env.ENCRYPTION_SECRET;
        if (!encryptionSecret) {
            this.logger.warn('ENCRYPTION_SECRET not set, using default (not secure for production)');
        }
    }

    private getEncryptionKey(): Buffer {
        const secret = process.env.ENCRYPTION_SECRET || 'default-secret-key-not-secure';
        return Buffer.from(secret.padEnd(32, '0').slice(0, 32), 'utf8');
    }

    /**
     * Set and encrypt Telegram config
     */
    async setTelegramConfig(botToken: string, chatId: string): Promise<void> {
        try {
            const key = this.getEncryptionKey();
            const iv = randomBytes(16);
            const cipher = createCipheriv(this.algorithm, key, iv);

            // Encrypt bot token
            const botTokenEncrypted = Buffer.concat([
                cipher.update(botToken, 'utf8'),
                cipher.final()
            ]);
            const botTokenTag = cipher.getAuthTag();

            // Encrypt chat ID
            const chatIdCipher = createCipheriv(this.algorithm, key, iv);
            const chatIdEncrypted = Buffer.concat([
                chatIdCipher.update(chatId, 'utf8'),
                chatIdCipher.final()
            ]);
            const chatIdTag = chatIdCipher.getAuthTag();

            // Store encrypted data
            this.encryptedBotToken = botTokenEncrypted.toString('base64');
            this.encryptedChatId = chatIdEncrypted.toString('base64');
            this.iv = iv;
            this.botTokenTag = botTokenTag;
            this.chatIdTag = chatIdTag;

            this.logger.log('Telegram config encrypted and stored successfully');
        } catch (error) {
            this.logger.error(`Failed to encrypt Telegram config: ${error.message}`);
            throw new Error('Failed to store Telegram config');
        }
    }

    /**
     * Get decrypted Telegram config
     */
    async getTelegramConfig(): Promise<TelegramConfig> {
        if (!this.encryptedBotToken || !this.encryptedChatId || !this.iv || !this.botTokenTag || !this.chatIdTag) {
            return { botToken: '', chatId: '' };
        }

        try {
            const key = this.getEncryptionKey();
            const iv = this.iv;

            // Decrypt bot token
            const decipher = createDecipheriv(this.algorithm, key, iv);
            decipher.setAuthTag(this.botTokenTag);
            const botToken = Buffer.concat([
                decipher.update(Buffer.from(this.encryptedBotToken, 'base64')),
                decipher.final()
            ]).toString('utf8');

            // Decrypt chat ID
            const chatIdDecipher = createDecipheriv(this.algorithm, key, iv);
            chatIdDecipher.setAuthTag(this.chatIdTag);
            const chatId = Buffer.concat([
                chatIdDecipher.update(Buffer.from(this.encryptedChatId, 'base64')),
                chatIdDecipher.final()
            ]).toString('utf8');

            return { botToken, chatId };
        } catch (error) {
            this.logger.error(`Failed to decrypt Telegram config: ${error.message}`);
            throw new Error('Failed to retrieve Telegram config');
        }
    }

    /**
     * Check if Telegram config is configured
     */
    hasTelegramConfig(): boolean {
        return !!(this.encryptedBotToken && this.encryptedChatId && this.iv && this.botTokenTag && this.chatIdTag);
    }

    /**
     * Clear stored Telegram config
     */
    clearTelegramConfig(): void {
        this.encryptedBotToken = null;
        this.encryptedChatId = null;
        this.iv = null;
        this.botTokenTag = null;
        this.chatIdTag = null;
        this.logger.log('Telegram config cleared');
    }
}

