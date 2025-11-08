import { Controller, Post, Get, Delete, Body, Res, HttpStatus, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiKeyService } from './apikey.service';
import { KrakenAuthService } from '../kraken/services/auth.service';

interface SetApiKeysDto {
    apiKey: string;
    privateKey: string;
}

@Controller('config/kraken')
export class ConfigController {
    constructor(
        private readonly apiKeyService: ApiKeyService,
        private readonly krakenAuthService: KrakenAuthService,
    ) { }

    /**
     * Set Kraken API keys
     */
    @Post('keys')
    async setApiKeys(@Body() dto: SetApiKeysDto, @Res() res: Response) {
        try {
            if (!dto.apiKey || !dto.privateKey) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: 'API key and private key are required'
                });
            }

            await this.apiKeyService.setApiKeys(dto.apiKey, dto.privateKey);

            return res.status(HttpStatus.OK).json({
                success: true,
                message: 'API keys stored successfully'
            });
        } catch (error) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: `Failed to store API keys: ${error.message}`
            });
        }
    }

    /**
     * Check if API keys are configured
     */
    @Get('keys/status')
    async getKeysStatus(@Res() res: Response) {
        try {
            const hasKeys = this.apiKeyService.hasApiKeys();

            return res.status(HttpStatus.OK).json({
                success: true,
                configured: hasKeys,
                message: hasKeys ? 'API keys are configured' : 'API keys not configured'
            });
        } catch (error) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: `Failed to check API keys status: ${error.message}`
            });
        }
    }

    /**
     * Clear stored API keys
     */
    @Delete('keys')
    async clearApiKeys(@Res() res: Response) {
        try {
            this.apiKeyService.clearApiKeys();

            return res.status(HttpStatus.OK).json({
                success: true,
                message: 'API keys cleared successfully'
            });
        } catch (error) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: `Failed to clear API keys: ${error.message}`
            });
        }
    }

    /**
     * Test connection with stored API keys
     */
    @Post('test')
    async testConnection(@Res() res: Response) {
        try {
            const isValid = await this.krakenAuthService.validateApiKeys();

            if (isValid) {
                return res.status(HttpStatus.OK).json({
                    success: true,
                    message: 'Connection test successful'
                });
            } else {
                return res.status(HttpStatus.UNAUTHORIZED).json({
                    success: false,
                    message: 'Connection test failed - invalid API keys'
                });
            }
        } catch (error) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: `Connection test failed: ${error.message}`
            });
        }
    }

    /**
     * Serve admin UI
     */
    @Get('admin')
    async getAdminUI(@Res() res: Response) {
        return res.sendFile('admin.html', { root: 'src/modules/config/public' });
    }
}
