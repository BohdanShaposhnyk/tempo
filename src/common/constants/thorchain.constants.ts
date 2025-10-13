export const THORCHAIN_CONSTANTS = {
  // THORChain endpoints
  THORNODE_WEBSOCKET: 'wss://thornode.ninerealms.com/websocket',
  MIDGARD_API: 'https://midgard.ninerealms.com',

  // RUJI token identifier
  // Format: CHAIN.SYMBOL for THORChain assets
  RUJI_TOKEN: 'THOR.RUJI',
  RUNE_TOKEN: 'THOR.RUNE',

  // Pool identifier
  RUJI_RUNE_POOL: 'THOR.RUJI',

  // WebSocket subscription settings
  WS_RECONNECT_DELAY_MS: 1000,
  WS_MAX_RECONNECT_DELAY_MS: 30000,
  WS_RECONNECT_BACKOFF_MULTIPLIER: 1.5,

  // API settings
  API_TIMEOUT_MS: 10000,
  API_MAX_RETRIES: 3,
} as const;

