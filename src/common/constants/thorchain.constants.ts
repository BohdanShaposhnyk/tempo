export const THORCHAIN_CONSTANTS = {
  // THORChain endpoints
  MIDGARD_API: 'https://midgard.ninerealms.com',

  // RUJI token identifier
  // Format: CHAIN.SYMBOL for THORChain assets
  RUJI_TOKEN: 'THOR.RUJI',
  RUNE_TOKEN: 'THOR.RUNE',

  // Pool identifier
  RUJI_RUNE_POOL: 'THOR.RUJI',

  // API settings
  API_TIMEOUT_MS: 10000,
  API_MAX_RETRIES: 3,
} as const;

