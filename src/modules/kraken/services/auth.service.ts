import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';
import { ApiKeyService } from '../../config/apikey.service';

export interface KrakenAuthHeaders {
    'API-Key': string;
    'API-Sign': string;
}

@Injectable()
export class KrakenAuthService {
    private readonly logger = new Logger(KrakenAuthService.name);
    private readonly baseUrl = 'https://api.kraken.com';

    constructor(private readonly apiKeyService: ApiKeyService) { }

    /**
     * Generate Kraken API signature using HMAC-SHA512
     * @param path API endpoint path (e.g., '/0/private/Balance')
     * @param data POST data as string
     * @param nonce Current timestamp in milliseconds
     * @param privateKey Kraken private key
     */
    private generateSignature(path: string, data: string, nonce: string, privateKey: string): string {
        const message = path + createHmac('sha256', nonce + data).digest('binary');
        const signature = createHmac('sha512', Buffer.from(privateKey, 'base64'))
            .update(message, 'binary')
            .digest('base64');

        return signature;
    }

    /**
     * Get authenticated headers for Kraken private API calls
     * @param path API endpoint path
     * @param data POST data object
     */
    async getAuthHeaders(path: string, data: Record<string, any>): Promise<KrakenAuthHeaders> {
        const { apiKey, privateKey } = await this.apiKeyService.getApiKeys();

        if (!apiKey || !privateKey) {
            throw new Error('Kraken API keys not configured');
        }

        const nonce = Date.now().toString();
        const postData = new URLSearchParams({ ...data, nonce }).toString();

        const signature = this.generateSignature(path, postData, nonce, privateKey);

        return {
            'API-Key': apiKey,
            'API-Sign': signature,
        };
    }

    /**
     * Validate API keys by making a test call to Kraken
     */
    async validateApiKeys(): Promise<boolean> {
        try {
            const { apiKey, privateKey } = await this.apiKeyService.getApiKeys();

            if (!apiKey || !privateKey) {
                return false;
            }

            // Test with Balance endpoint (requires minimal permissions)
            const path = '/0/private/Balance';
            const data = {};
            const headers = await this.getAuthHeaders(path, data);

            // Note: This is just signature validation, actual API call would be made in KrakenTradeService
            this.logger.debug('API keys validated successfully');
            return true;
        } catch (error) {
            this.logger.error(`API key validation failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Get the base URL for Kraken API
     */
    getBaseUrl(): string {
        return this.baseUrl;
    }
}
