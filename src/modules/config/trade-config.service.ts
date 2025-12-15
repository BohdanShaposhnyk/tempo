import { Injectable, Logger } from '@nestjs/common';
import { TRADE_CONFIG_CONSTANTS } from 'src/common/constants/tradeConfig.constants';

@Injectable()
export class TradeConfigService {
    private readonly logger = new Logger(TradeConfigService.name);
    private minOpportunitySize$: number = TRADE_CONFIG_CONSTANTS.MIN_OPPORTUNITY_SIZE_$; // Default value
    private minOpportunityDurationS: number = TRADE_CONFIG_CONSTANTS.MIN_OPPORTUNITY_DURATION_S; // Default value

    /**
     * Get minimum opportunity size in USD
     */
    getMinOpportunitySize$(): number {
        return this.minOpportunitySize$;
    }

    /**
     * Get minimum opportunity duration in seconds
     */
    getMinOpportunityDurationS(): number {
        return this.minOpportunityDurationS;
    }

    /**
     * Set minimum opportunity size in USD
     */
    setMinOpportunitySize$(value: number): void {
        if (value <= 0 || !isFinite(value)) {
            throw new Error('Minimum opportunity size must be a positive number');
        }
        this.minOpportunitySize$ = value;
        this.logger.log(`Minimum opportunity size updated to $${value}`);
    }

    /**
     * Set minimum opportunity duration in seconds
     */
    setMinOpportunityDurationS(value: number): void {
        if (value <= 0 || !isFinite(value)) {
            throw new Error('Minimum opportunity duration must be a positive number');
        }
        this.minOpportunityDurationS = value;
        this.logger.log(`Minimum opportunity duration updated to ${value}s`);
    }

    /**
     * Get current configuration
     */
    getConfig(): { minSize: number; minDuration: number } {
        return {
            minSize: this.minOpportunitySize$,
            minDuration: this.minOpportunityDurationS,
        };
    }

    /**
     * Set configuration
     */
    setConfig(minSize: number, minDuration: number): void {
        this.setMinOpportunitySize$(minSize);
        this.setMinOpportunityDurationS(minDuration);
    }
}

