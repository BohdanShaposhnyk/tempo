import { Injectable, Logger } from '@nestjs/common';
import { TRADE_CONFIG_CONSTANTS } from 'src/common/constants/tradeConfig.constants';

export type TradeConfigSnapshot = {
    minSize: number;
    minDuration: number;
    assets: string[];
};

@Injectable()
export class TradeConfigService {
    private readonly logger = new Logger(TradeConfigService.name);
    private minOpportunitySize$: number = TRADE_CONFIG_CONSTANTS.MIN_OPPORTUNITY_SIZE_$; // Default value
    private minOpportunityDurationS: number = TRADE_CONFIG_CONSTANTS.MIN_OPPORTUNITY_DURATION_S; // Default value
    private monitoredAssets: string[] = [
        ...TRADE_CONFIG_CONSTANTS.DEFAULT_MONITORED_ASSETS,
    ];

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
     * Assets passed to Midgard `asset` query (OR semantics)
     */
    getMonitoredAssets(): string[] {
        return [...this.monitoredAssets];
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
     * Set Midgard monitored assets (non-empty, trimmed, deduped)
     */
    setMonitoredAssets(assets: string[]): void {
        const normalized = this.normalizeAssetList(assets);
        if (normalized.length === 0) {
            throw new Error('At least one non-empty asset is required');
        }
        this.monitoredAssets = normalized;
        this.logger.log(`Monitored assets updated to: ${normalized.join(', ')}`);
    }

    private normalizeAssetList(assets: string[]): string[] {
        const seen = new Set<string>();
        const out: string[] = [];
        for (const raw of assets) {
            const s = raw.trim();
            if (s.length === 0) {
                continue;
            }
            if (seen.has(s)) {
                continue;
            }
            seen.add(s);
            out.push(s);
        }
        return out;
    }

    /**
     * Get current configuration
     */
    getConfig(): TradeConfigSnapshot {
        return {
            minSize: this.minOpportunitySize$,
            minDuration: this.minOpportunityDurationS,
            assets: this.getMonitoredAssets(),
        };
    }

    /**
     * Set configuration
     */
    setConfig(minSize: number, minDuration: number, assets?: string[]): void {
        this.setMinOpportunitySize$(minSize);
        this.setMinOpportunityDurationS(minDuration);
        if (assets !== undefined) {
            this.setMonitoredAssets(assets);
        }
    }
}
