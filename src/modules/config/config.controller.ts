import { Controller, Post, Get, Delete, Put, Body, Res, HttpStatus, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiKeyService } from './apikey.service';
import { TradeConfigService } from './trade-config.service';
import { KrakenAuthService } from '../kraken/services/auth.service';

interface SetApiKeysDto {
    apiKey: string;
    privateKey: string;
}

interface SetTradeConfigDto {
    minSize?: number;
    minDuration?: number;
}

@Controller('config')
export class ConfigController {
    constructor(
        private readonly apiKeyService: ApiKeyService,
        private readonly tradeConfigService: TradeConfigService,
        private readonly krakenAuthService: KrakenAuthService,
    ) { }

    /**
     * Get trade configuration
     */
    @Get('trade')
    async getTradeConfig(@Res() res: Response) {
        try {
            const config = this.tradeConfigService.getConfig();
            return res.status(HttpStatus.OK).json({
                success: true,
                config,
            });
        } catch (error) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: `Failed to get trade config: ${error.message}`
            });
        }
    }

    /**
     * Set trade configuration
     */
    @Post('trade')
    async setTradeConfig(@Body() dto: SetTradeConfigDto, @Res() res: Response) {
        try {
            if (dto.minSize !== undefined) {
                this.tradeConfigService.setMinOpportunitySize$(dto.minSize);
            }
            if (dto.minDuration !== undefined) {
                this.tradeConfigService.setMinOpportunityDurationS(dto.minDuration);
            }

            const config = this.tradeConfigService.getConfig();
            return res.status(HttpStatus.OK).json({
                success: true,
                message: 'Trade config updated successfully',
                config,
            });
        } catch (error) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                message: `Failed to set trade config: ${error.message}`
            });
        }
    }

    /**
     * Set minimum opportunity size
     */
    @Put('trade/size')
    async setMinSize(@Body() body: { value: number }, @Res() res: Response) {
        try {
            if (body.value === undefined || body.value === null) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: 'Value is required'
                });
            }

            this.tradeConfigService.setMinOpportunitySize$(body.value);
            return res.status(HttpStatus.OK).json({
                success: true,
                message: `Minimum opportunity size set to $${body.value}`,
                config: this.tradeConfigService.getConfig(),
            });
        } catch (error) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                message: `Failed to set min size: ${error.message}`
            });
        }
    }

    /**
     * Set minimum opportunity duration
     */
    @Put('trade/duration')
    async setMinDuration(@Body() body: { value: number }, @Res() res: Response) {
        try {
            if (body.value === undefined || body.value === null) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: 'Value is required'
                });
            }

            this.tradeConfigService.setMinOpportunityDurationS(body.value);
            return res.status(HttpStatus.OK).json({
                success: true,
                message: `Minimum opportunity duration set to ${body.value}s`,
                config: this.tradeConfigService.getConfig(),
            });
        } catch (error) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                message: `Failed to set min duration: ${error.message}`
            });
        }
    }

    /**
     * Set Kraken API keys
     */
    @Post('kraken/keys')
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
    @Get('kraken/keys/status')
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
    @Delete('kraken/keys')
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
    @Post('kraken/test')
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
    @Get('kraken/admin')
    async getAdminUI(@Res() res: Response) {
        return res.sendFile('admin.html', { root: 'src/modules/config/public' });
    }
}
