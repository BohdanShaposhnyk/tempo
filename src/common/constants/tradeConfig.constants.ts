export const TRADE_CONFIG_CONSTANTS = {
    MIN_OPPORTUNITY_SIZE_$: 1500,
    MIN_OPPORTUNITY_DURATION_S: 1,
    /** Midgard `/v2/actions` asset filter (comma-joined); at least one asset per swap */
    DEFAULT_MONITORED_ASSETS: ['THOR.RUJI', 'THOR.TCY'] as const,
} as const;
