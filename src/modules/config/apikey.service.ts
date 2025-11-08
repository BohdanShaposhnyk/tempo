import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export interface ApiKeys {
    apiKey: string;
    privateKey: string;
}

@Injectable()
export class ApiKeyService {
    private readonly logger = new Logger(ApiKeyService.name);
    private readonly algorithm = 'aes-256-gcm';
    private encryptedApiKey: string | null = null;
    private encryptedPrivateKey: string | null = null;
    private iv: Buffer | null = null;
    private apiKeyTag: Buffer | null = null;
    private privateKeyTag: Buffer | null = null;

    constructor() {
        // Initialize with encryption key from environment
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
     * Set and encrypt API keys
     */
    async setApiKeys(apiKey: string, privateKey: string): Promise<void> {
        try {
            const key = this.getEncryptionKey();
            const iv = randomBytes(16);
            const cipher = createCipheriv(this.algorithm, key, iv);

            // Encrypt API key
            const apiKeyEncrypted = Buffer.concat([
                cipher.update(apiKey, 'utf8'),
                cipher.final()
            ]);
            const apiKeyTag = cipher.getAuthTag();

            // Encrypt private key
            const privateKeyCipher = createCipheriv(this.algorithm, key, iv);
            const privateKeyEncrypted = Buffer.concat([
                privateKeyCipher.update(privateKey, 'utf8'),
                privateKeyCipher.final()
            ]);
            const privateKeyTag = privateKeyCipher.getAuthTag();

            // Store encrypted data
            this.encryptedApiKey = apiKeyEncrypted.toString('base64');
            this.encryptedPrivateKey = privateKeyEncrypted.toString('base64');
            this.iv = iv;
            this.apiKeyTag = apiKeyTag;
            this.privateKeyTag = privateKeyTag;

            this.logger.log('API keys encrypted and stored successfully');
        } catch (error) {
            this.logger.error(`Failed to encrypt API keys: ${error.message}`);
            throw new Error('Failed to store API keys');
        }
    }

    /**
     * Get decrypted API keys
     */
    async getApiKeys(): Promise<ApiKeys> {
        if (!this.encryptedApiKey || !this.encryptedPrivateKey || !this.iv || !this.apiKeyTag || !this.privateKeyTag) {
            return { apiKey: '', privateKey: '' };
        }

        try {
            const key = this.getEncryptionKey();
            const iv = this.iv;

            // Decrypt API key
            const decipher = createDecipheriv(this.algorithm, key, iv);
            decipher.setAuthTag(this.apiKeyTag);
            const apiKey = Buffer.concat([
                decipher.update(Buffer.from(this.encryptedApiKey, 'base64')),
                decipher.final()
            ]).toString('utf8');

            // Decrypt private key
            const privateKeyDecipher = createDecipheriv(this.algorithm, key, iv);
            privateKeyDecipher.setAuthTag(this.privateKeyTag);
            const privateKey = Buffer.concat([
                privateKeyDecipher.update(Buffer.from(this.encryptedPrivateKey, 'base64')),
                privateKeyDecipher.final()
            ]).toString('utf8');

            return { apiKey, privateKey };
        } catch (error) {
            this.logger.error(`Failed to decrypt API keys: ${error.message}`);
            throw new Error('Failed to retrieve API keys');
        }
    }

    /**
     * Check if API keys are configured
     */
    hasApiKeys(): boolean {
        return !!(this.encryptedApiKey && this.encryptedPrivateKey && this.iv && this.apiKeyTag && this.privateKeyTag);
    }

    /**
     * Clear stored API keys
     */
    clearApiKeys(): void {
        this.encryptedApiKey = null;
        this.encryptedPrivateKey = null;
        this.iv = null;
        this.apiKeyTag = null;
        this.privateKeyTag = null;
        this.logger.log('API keys cleared');
    }
}
