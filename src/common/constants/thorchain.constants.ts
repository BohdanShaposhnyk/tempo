export const THORCHAIN_CONSTANTS = {
  /** Indexer base URL (swap actions, tx lookup) — Vanaheimex Midgard-compatible API */
  MIDGARD_API: 'https://vanaheimex.com',

  /**
   * Pool stats (`/v2/pool/{asset}`); same Midgard API under Liquify gateway (`/v2/pools` list).
   * Override with `MIDGARD_POOL_API_URL`.
   */
  MIDGARD_POOL_API: 'https://gateway.liquify.com/chain/thorchain_midgard',

  RUNE_TOKEN: 'THOR.RUNE',

  // API settings (indexer responses can be slow)
  API_TIMEOUT_MS: 25000,
  API_MAX_RETRIES: 3,
} as const;
