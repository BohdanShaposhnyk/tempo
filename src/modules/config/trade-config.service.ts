import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TradeConfigService {
    private readonly logger = new Logger(TradeConfigService.name);
    private minOpportunitySize$: number = 4000; // Default value
    private minOpportunityDurationS: number = 30; // Default value

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

