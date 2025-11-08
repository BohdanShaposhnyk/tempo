export const TRADE_CONFIG_CONSTANTS = {
    MIN_OPPORTUNITY_SIZE_$: 4000,
    MIN_OPPORTUNITY_DURATION_S: 30,
    TADE_SIZE_$: 5,
    KRAKEN_PAIR: 'RUJIUSD',
    MAX_SLIPPAGE_PCT: 5,
    EXIT_BUFFER_SECONDS: 10, // exit 10s before stream swap ends
    // Default to dry-run mode (true) unless explicitly set to 'false'
    DRY_RUN_MODE: process.env.KRAKEN_DRY_RUN !== 'false',
} as const;
