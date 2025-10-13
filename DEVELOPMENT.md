# Development Guide

## Project Overview

This is a NestJS-based detection system for temporal arbitrage opportunities on THORChain, specifically monitoring RUJI token stream swaps.

## Architecture

### Module Structure

The application follows NestJS modular architecture:

- **ThorchainModule**: Core business logic for THORChain integration
  - WebSocketService: Manages real-time connection
  - MidgardService: HTTP client for transaction details
  - DetectorService: Identifies arbitrage opportunities
  - ThorchainHealthIndicator: Connection health monitoring

### Event Flow

```
┌─────────────────┐
│  THORNode WS    │
│ (Real-time TX)  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│  WebSocketService           │
│  - Connects & Subscribes    │
│  - Handles reconnection     │
└────────┬────────────────────┘
         │ Emits: transaction.detected
         ▼
┌─────────────────────────────┐
│  DetectorService            │
│  - @OnEvent listener        │
│  - Filters for RUJI         │
└────────┬────────────────────┘
         │ Calls
         ▼
┌─────────────────────────────┐
│  MidgardService             │
│  - Fetches TX details       │
│  - Parses stream metadata   │
└────────┬────────────────────┘
         │ Returns
         ▼
┌─────────────────────────────┐
│  DetectorService            │
│  - Validates stream swap    │
│  - Emits: streamswap.detected
│  - Logs opportunity         │
└─────────────────────────────┘
```

## Key Design Patterns

### 1. Dependency Injection

All services use constructor-based DI:

```typescript
@Injectable()
export class DetectorService {
  constructor(
    private readonly midgardService: MidgardService,
    private readonly eventEmitter: EventEmitter2,
  ) {}
}
```

### 2. Event-Driven Architecture

Services communicate via events, not direct calls:

```typescript
// Emit event
this.eventEmitter.emit('transaction.detected', new TransactionDetectedEvent(...));

// Listen to event
@OnEvent('transaction.detected', { async: true })
async handleTransactionDetected(event: TransactionDetectedEvent) { ... }
```

### 3. Lifecycle Hooks

Services initialize and cleanup properly:

```typescript
@Injectable()
export class WebSocketService implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    // Connect to WebSocket
  }
  
  async onModuleDestroy() {
    // Close connection gracefully
  }
}
```

### 4. Health Indicators

Custom health checks extend HealthIndicator:

```typescript
@Injectable()
export class ThorchainHealthIndicator extends HealthIndicator {
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    // Check WebSocket connection
  }
}
```

## Code Organization

### Constants

All configuration in one place:

```typescript
// src/common/constants/thorchain.constants.ts
export const THORCHAIN_CONSTANTS = {
  THORNODE_WEBSOCKET: 'wss://thornode.ninerealms.com/websocket',
  MIDGARD_API: 'https://midgard.ninerealms.com',
  RUJI_TOKEN: 'THOR.RUJI',
  // ...
} as const;
```

### Interfaces

Type-safe data structures:

```typescript
// src/modules/thorchain/interfaces/thorchain.interface.ts
export interface StreamSwapOpportunity {
  txHash: string;
  timestamp: Date;
  direction: string;
  // ...
}
```

### Events

Typed event classes:

```typescript
// src/modules/thorchain/events/thorchain.events.ts
export class TransactionDetectedEvent {
  constructor(
    public readonly txHash: string,
    public readonly height: string,
    public readonly events: Array<...>,
  ) {}
}
```

## Adding New Features

### 1. Database Storage

Create a new service to store opportunities:

```typescript
@Injectable()
export class StorageService {
  @OnEvent('streamswap.detected')
  async saveOpportunity(event: StreamSwapDetectedEvent) {
    // Save to database
  }
}
```

### 2. Trading Execution

Create a trading module:

```typescript
@Injectable()
export class TradingService {
  @OnEvent('streamswap.detected')
  async evaluateTrade(event: StreamSwapDetectedEvent) {
    // Calculate profitability
    // Execute trade if profitable
  }
}
```

### 3. Additional Tokens

Extend constants and detector logic:

```typescript
export const THORCHAIN_CONSTANTS = {
  MONITORED_TOKENS: ['THOR.RUJI', 'THOR.TOKEN2'],
  // ...
};
```

### 4. Web Dashboard

Add a controller with endpoints:

```typescript
@Controller('opportunities')
export class OpportunitiesController {
  @Get()
  getRecent() {
    // Return recent opportunities
  }
}
```

## Testing

### Unit Tests

Test services in isolation:

```typescript
describe('DetectorService', () => {
  let service: DetectorService;
  let midgardService: MidgardService;
  
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DetectorService,
        { provide: MidgardService, useValue: mockMidgardService },
      ],
    }).compile();
    
    service = module.get<DetectorService>(DetectorService);
  });
  
  it('should detect RUJI stream swaps', async () => {
    // Test logic
  });
});
```

### E2E Tests

Test the full application:

```typescript
describe('Health (e2e)', () => {
  let app: INestApplication;
  
  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    
    app = moduleFixture.createNestApplication();
    await app.init();
  });
  
  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200);
  });
});
```

## Common Development Tasks

### Adding a New Service

1. Create service file: `src/modules/thorchain/services/new.service.ts`
2. Add `@Injectable()` decorator
3. Implement logic
4. Add to module providers: `thorchain.module.ts`
5. Inject where needed

### Adding a New Event

1. Define event class: `src/modules/thorchain/events/thorchain.events.ts`
2. Emit from source: `this.eventEmitter.emit('event.name', new EventClass(...))`
3. Listen in consumer: `@OnEvent('event.name') handler(event: EventClass) {}`

### Modifying API Calls

Update `MidgardService`:
- Add new method
- Use `HttpService` from `@nestjs/axios`
- Handle errors with `catchError`
- Return typed responses

### Changing WebSocket Behavior

Update `WebSocketService`:
- Modify subscription in `subscribe()` method
- Adjust event parsing in `processEvent()`
- Update reconnection logic if needed

## Configuration

### Environment Variables

Add new variables:
1. Define in `.env.example` (if it exists)
2. Use in code: `this.configService.get<string>('VAR_NAME')`
3. Provide defaults for development

### Constants

Add to `thorchain.constants.ts`:
- Keep related constants together
- Use `as const` for type safety
- Document purpose with comments

## Debugging

### Enable Verbose Logging

```bash
npm run start:dev
# Logs include: log, error, warn, debug, verbose
```

### Debug Specific Service

Add temporary logs:

```typescript
this.logger.debug(`Variable value: ${JSON.stringify(data)}`);
```

### Debug WebSocket Messages

In `WebSocketService.handleMessage()`:

```typescript
this.logger.debug(`Raw message: ${data.toString()}`);
```

### Debug API Responses

In `MidgardService`:

```typescript
this.logger.debug(`API response: ${JSON.stringify(response.data)}`);
```

## Performance Considerations

### WebSocket

- Single connection per instance
- Automatic reconnection prevents connection leaks
- Event-driven processing avoids blocking

### API Calls

- Configured timeout: 10 seconds
- Error handling prevents crashes
- RxJS operators for clean async code

### Memory

- No persistent storage (current implementation)
- Events processed and discarded
- Minimal memory footprint

## Deployment

### Development

```bash
npm run start:dev
```

### Production

```bash
npm run build
npm run start:prod
```

### Docker (Future)

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
CMD ["node", "dist/main"]
```

### Environment Variables in Production

Use a `.env` file or system environment variables:

```bash
export THORNODE_WEBSOCKET_URL=wss://...
export MIDGARD_API_URL=https://...
npm run start:prod
```

## Code Style

### Formatting

```bash
npm run format
```

### Linting

```bash
npm run lint
```

### Pre-commit (Future)

Add Husky for automatic checks before commits.

## Monitoring

### Health Checks

```bash
curl http://localhost:3000/health
```

### Logs

Watch logs in real-time during development. In production, pipe to a logging service.

### Metrics (Future)

Add Prometheus metrics:
- Transaction processing rate
- Stream swaps detected per hour
- WebSocket reconnection count
- API call latency

## Troubleshooting

### WebSocket Won't Connect

1. Check URL is correct
2. Verify network access
3. Check THORNode status
4. Review logs for error details

### No Opportunities Detected

1. Verify WebSocket is connected (check `/health`)
2. Check logs for transaction events
3. Stream swaps may be infrequent (this is normal)
4. Verify RUJI token identifier is correct

### High CPU Usage

1. Check for infinite loops in event handlers
2. Verify no excessive logging
3. Monitor API call frequency

### Memory Leaks

1. Ensure WebSocket cleanup in `onModuleDestroy`
2. Check for unsubscribed event listeners
3. Monitor with Node.js inspector

## Best Practices

### ✅ Do

- Use dependency injection
- Emit events for cross-service communication
- Log with context: `new Logger(ServiceName.name)`
- Handle errors gracefully
- Use TypeScript types everywhere
- Write async/await style code
- Follow NestJS conventions

### ❌ Don't

- Use global variables
- Directly import services from other modules
- Ignore errors silently
- Block the event loop
- Use `any` type
- Mix async patterns (callbacks + promises)
- Hardcode configuration values

## Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [THORChain Docs](https://docs.thorchain.org/)
- [Midgard API](https://midgard.ninerealms.com/v2/doc)
- [WebSocket Protocol](https://docs.tendermint.com/master/rpc/)

## Support

For questions or issues:
1. Check the logs
2. Review this documentation
3. Consult NestJS docs
4. Check THORChain developer resources

