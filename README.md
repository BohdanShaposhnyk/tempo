# THORChain RUJI Temporal Arbitrage Bot

A NestJS-based detection system for identifying temporal arbitrage opportunities on THORChain involving the RUJI token through stream swap monitoring.

## Overview

This application monitors THORChain's transaction stream in real-time to detect stream swaps involving RUJI token. Stream swaps create predictable short-term price swings in pools, presenting potential arbitrage opportunities.

### How It Works

1. **Polling Service**: Queries Midgard API (`https://midgard.ninerealms.com/v2/actions`) every 6 seconds for new swap actions
2. **Transaction Detection**: Filters actions for those involving RUJI token (either directly or through multi-hop swaps)
3. **Stream Swap Identification**: Detects stream swaps and extracts key information:
   - Swap direction (e.g., RUJI->RUNE->BTC or BTC->RUNE->RUJI)
   - Input/output amounts
   - Stream configuration (count, interval, quantity)
   - Estimated duration
   - Pools involved
5. **Opportunity Logging**: Logs detected opportunities to console with timestamp and details

## Project Structure

```
src/
├── modules/
│   └── thorchain/
│       ├── thorchain.module.ts          # Module definition
│       ├── events/
│       │   └── thorchain.events.ts      # Event classes for event-driven architecture
│       ├── interfaces/
│       │   └── thorchain.interface.ts   # TypeScript interfaces and types
│       └── services/
│           ├── websocket.service.ts     # WebSocket connection management
│           ├── midgard.service.ts       # Midgard API client
│           ├── detector.service.ts      # Stream swap detection logic
│           └── thorchain.health.ts      # Health indicator
├── common/
│   └── constants/
│       └── thorchain.constants.ts       # Configuration constants
├── health/
│   └── health.controller.ts             # Health check endpoint
├── app.module.ts                        # Root application module
└── main.ts                              # Application entry point
```

## Features

- ✅ Reliable Midgard API polling (6-second intervals)
- ✅ Event-driven architecture using NestJS EventEmitter
- ✅ Multi-hop swap detection (RUJI->RUNE->X and X->RUNE->RUJI)
- ✅ Stream swap metadata parsing
- ✅ Block height tracking to prevent duplicates
- ✅ Comprehensive logging with context
- ✅ Health check endpoint with poller status
- ✅ Graceful shutdown handling
- ✅ Type-safe configuration management
- ✅ Environment-based configuration

## Installation

```bash
npm install
```

## Configuration

The application uses environment variables for configuration. Create a `.env` file in the root directory:

```env
# Application
NODE_ENV=development
PORT=3000

# THORChain Configuration
THORNODE_WEBSOCKET_URL=wss://thornode.ninerealms.com/websocket
MIDGARD_API_URL=https://midgard.ninerealms.com

# Token Configuration
RUJI_TOKEN=THOR.RUJI
RUNE_TOKEN=THOR.RUNE

# Logging
LOG_LEVEL=debug
```

Default values are provided in the code if environment variables are not set.

## Running the Application

### Development Mode
```bash
npm run start:dev
```

### Production Mode
```bash
npm run build
npm run start:prod
```

### Debug Mode
```bash
npm run start:debug
```

## API Endpoints

### Health Check
```
GET http://localhost:3000/health
```

Returns the health status of the application and polling service:

```json
{
  "status": "ok",
  "info": {
    "thorchain": {
      "status": "up",
      "poller": "running",
      "lastProcessedHeight": 12345678
    }
  }
}
```

## Architecture

### NestJS Best Practices

This project follows NestJS best practices:

- **Dependency Injection**: All services use `@Injectable()` with constructor-based DI
- **Module System**: Properly organized modules with clear boundaries
- **Event-Driven Architecture**: Uses `@nestjs/event-emitter` for loose coupling
- **Lifecycle Hooks**: Services initialize and cleanup using `OnModuleInit`, `OnModuleDestroy`, `OnApplicationBootstrap`
- **Configuration Management**: Type-safe configuration using `@nestjs/config`
- **Health Checks**: Custom health indicators using `@nestjs/terminus`
- **Logging**: Context-based logging using NestJS Logger

### Event Flow

```
WebSocket Event → TransactionDetectedEvent → Detector Service
                                                   ↓
                                         Query Midgard API
                                                   ↓
                                    Check if Stream Swap + RUJI
                                                   ↓
                                      StreamSwapDetectedEvent
                                                   ↓
                                            Log Opportunity
```

## Console Output Example

When a stream swap opportunity is detected, you'll see:

```
[ThorchainService] [OPPORTUNITY] 2025-10-13T10:30:45.123Z | THOR.RUJI -> BTC.BTC | Amount: 1000.00000000 | Duration: 300s | TxHash: ABC123...
[ThorchainService] Stream config: 10 swaps, 100 quantity, 30000000000ns interval
[ThorchainService] Pools involved: THOR.RUJI, BTC.BTC
```

## Development

### Code Structure

- **Services**: Each service has a single responsibility
  - `PollerService`: Polls Midgard API for new actions
  - `MidgardService`: HTTP client for Midgard API with helper methods
  - `DetectorService`: Business logic for detecting opportunities
  - `ThorchainHealthIndicator`: Custom health indicator

- **Events**: Type-safe event classes
  - `TransactionDetectedEvent`: Emitted when a transaction is detected
  - `StreamSwapDetectedEvent`: Emitted when a stream swap opportunity is found
  - `WebSocketConnectionEvent`: Emitted on connection status changes

- **Interfaces**: TypeScript interfaces for type safety
  - Midgard API response types
  - THORChain event types
  - Stream swap opportunity structure

### Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Roadmap

### Current Scope (v1.0)
- ✅ Stream swap detection
- ✅ Console logging
- ✅ RUJI token tracking
- ✅ Multi-hop swap support

### Future Enhancements
- [ ] Database storage for historical opportunities
- [ ] Trading execution module
- [ ] Price impact calculation
- [ ] Profitability estimation
- [ ] Web dashboard for monitoring
- [ ] Alerts and notifications
- [ ] Multiple token support
- [ ] Strategy backtesting

## Technical Details

### THORChain Integration

- **WebSocket Protocol**: Uses Tendermint RPC WebSocket protocol
- **Subscription**: Subscribes to `tm.event='Tx'` for all transactions
- **Event Parsing**: Decodes base64-encoded transaction data
- **Multi-hop Detection**: Identifies swaps routing through RUNE

### Stream Swaps

Stream swaps on THORChain split a large swap into smaller sub-swaps over time to reduce price impact. Key parameters:

- **Count**: Number of sub-swaps
- **Interval**: Time between sub-swaps (in nanoseconds)
- **Quantity**: Amount per sub-swap

The bot detects these and calculates the total duration to estimate the arbitrage window.

## Troubleshooting

### Poller Not Running

If the health check shows poller is stopped:
1. Check network connectivity to Midgard API
2. Verify the Midgard API URL is accessible (`https://midgard.ninerealms.com`)
3. Check logs for detailed error messages
4. Restart the application

### No Opportunities Detected

This is normal - stream swaps involving RUJI may be infrequent. The bot will continue monitoring and log when opportunities arise. Check the health endpoint to verify:
- Poller status is "running"
- `lastProcessedHeight` is increasing over time

### High API Usage

The default polling interval is 6 seconds. If you need to reduce API calls:
1. Increase `pollIntervalMs` in `PollerService`
2. Note: This will increase detection latency

### High Memory Usage

If monitoring for extended periods, consider adding periodic cleanup or database storage instead of in-memory caching.

## License

MIT

## Contributing

Contributions are welcome! Please ensure:
- Code follows NestJS best practices
- All services use dependency injection
- Events are properly typed
- Logging is contextual and informative
