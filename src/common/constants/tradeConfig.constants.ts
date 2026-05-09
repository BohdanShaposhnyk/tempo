export const TRADE_CONFIG_CONSTANTS = {
  MIN_OPPORTUNITY_SIZE_$: 1500,
  MIN_OPPORTUNITY_DURATION_S: 1,
  /** Indexer `asset` filter (OR); combined into one request as `asset=a,b,...` */
  DEFAULT_MONITORED_ASSETS: ['THOR.RUJI', 'THOR.TCY'] as const,
  /** Legacy default; `MidgardService.getRecentActions` no longer performs per-asset calls */
  DEFAULT_MIDGARD_INTER_ASSET_DELAY_MS: 500,
} as const;
