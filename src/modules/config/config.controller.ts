import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Res,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { TradeConfigService } from './trade-config.service';
import { getErrorMessage } from 'src/common/utils/error-message.utils';

interface SetTradeConfigDto {
  minSize?: number;
  minDuration?: number;
  /** Midgard `asset` filter (OR); non-empty strings */
  assets?: string[];
}

@Controller('config')
export class ConfigController {
  constructor(private readonly tradeConfigService: TradeConfigService) {}

  /**
   * Get trade configuration
   */
  @Get('trade')
  getTradeConfig(@Res() res: Response) {
    try {
      const config = this.tradeConfigService.getConfig();
      return res.status(HttpStatus.OK).json({
        success: true,
        config,
      });
    } catch (error: unknown) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: `Failed to get trade config: ${getErrorMessage(error)}`,
      });
    }
  }

  /**
   * Set trade configuration
   */
  @Post('trade')
  setTradeConfig(@Body() dto: SetTradeConfigDto, @Res() res: Response) {
    try {
      if (dto.minSize !== undefined) {
        this.tradeConfigService.setMinOpportunitySize$(dto.minSize);
      }
      if (dto.minDuration !== undefined) {
        this.tradeConfigService.setMinOpportunityDurationS(dto.minDuration);
      }
      if (dto.assets !== undefined) {
        this.tradeConfigService.setMonitoredAssets(dto.assets);
      }

      const config = this.tradeConfigService.getConfig();
      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Trade config updated successfully',
        config,
      });
    } catch (error: unknown) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: `Failed to set trade config: ${getErrorMessage(error)}`,
      });
    }
  }

  /**
   * Set minimum opportunity size
   */
  @Put('trade/size')
  setMinSize(@Body() body: { value: number }, @Res() res: Response) {
    try {
      if (body.value === undefined || body.value === null) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Value is required',
        });
      }

      this.tradeConfigService.setMinOpportunitySize$(body.value);
      return res.status(HttpStatus.OK).json({
        success: true,
        message: `Minimum opportunity size set to $${body.value}`,
        config: this.tradeConfigService.getConfig(),
      });
    } catch (error: unknown) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: `Failed to set min size: ${getErrorMessage(error)}`,
      });
    }
  }

  /**
   * Set minimum opportunity duration
   */
  @Put('trade/duration')
  setMinDuration(@Body() body: { value: number }, @Res() res: Response) {
    try {
      if (body.value === undefined || body.value === null) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Value is required',
        });
      }

      this.tradeConfigService.setMinOpportunityDurationS(body.value);
      return res.status(HttpStatus.OK).json({
        success: true,
        message: `Minimum opportunity duration set to ${body.value}s`,
        config: this.tradeConfigService.getConfig(),
      });
    } catch (error: unknown) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: `Failed to set min duration: ${getErrorMessage(error)}`,
      });
    }
  }
}
