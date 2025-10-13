# Quick Start Guide

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (Optional)
Create a `.env` file in the project root if you want to override defaults:

```env
PORT=3000
THORNODE_WEBSOCKET_URL=wss://thornode.ninerealms.com/websocket
MIDGARD_API_URL=https://midgard.ninerealms.com
```

### 3. Start the Application

**Development mode with hot reload:**
```bash
npm run start:dev
```

**Production mode:**
```bash
npm run build
npm run start:prod
```

### 4. Verify It's Running

Open your browser or use curl:
```bash
curl http://localhost:3000/health
```

You should see:
```json
{
  "status": "ok",
  "info": {
    "thorchain": {
      "status": "up",
      "websocket": "connected"
    }
  }
}
```

### 5. Monitor the Console

The application will automatically:
1. Connect to THORNode WebSocket
2. Subscribe to transaction events
3. Query Midgard API for transaction details
4. Detect stream swaps involving RUJI token
5. Log opportunities to the console

### Example Console Output

```
[Nest] 12345  - 10/13/2025, 10:30:45 AM     LOG [Bootstrap] Application is running on: http://localhost:3000
[Nest] 12345  - 10/13/2025, 10:30:45 AM     LOG [Bootstrap] Health check available at: http://localhost:3000/health
[Nest] 12345  - 10/13/2025, 10:30:45 AM     LOG [Bootstrap] THORChain Stream Swap Detector is active
[Nest] 12345  - 10/13/2025, 10:30:45 AM     LOG [WebSocketService] Initializing WebSocket connection to THORNode...
[Nest] 12345  - 10/13/2025, 10:30:45 AM     LOG [WebSocketService] Connecting to WebSocket: wss://thornode.ninerealms.com/websocket
[Nest] 12345  - 10/13/2025, 10:30:46 AM     LOG [WebSocketService] WebSocket connection established
[Nest] 12345  - 10/13/2025, 10:30:46 AM     LOG [WebSocketService] Subscribed to transaction events
[Nest] 12345  - 10/13/2025, 10:30:46 AM     LOG [DetectorService] Stream Swap Detector initialized and ready

... waiting for stream swaps ...

[Nest] 12345  - 10/13/2025, 10:45:23 AM     LOG [DetectorService] [OPPORTUNITY] 2025-10-13T10:45:23.000Z | THOR.RUJI -> BTC.BTC | Amount: 1000.00000000 | Duration: 300s | TxHash: ABC123...
```

## What to Expect

### Normal Operation

- **Immediate**: WebSocket connection establishes within seconds
- **Continuous**: Service runs indefinitely, monitoring all transactions
- **Opportunities**: Will be logged when detected (may be infrequent)

### Automatic Features

- **Reconnection**: If WebSocket disconnects, it automatically reconnects with exponential backoff
- **Error Handling**: Failed API calls are logged but don't crash the service
- **Graceful Shutdown**: CTRL+C cleanly closes WebSocket and terminates

## Next Steps

### Understanding the Output

When a stream swap opportunity is detected, you'll see:

- **Timestamp**: When the opportunity was detected
- **Direction**: Swap route (e.g., RUJI->RUNE->BTC)
- **Amount**: Input amount in base units
- **Duration**: Estimated time window for the stream swap
- **TxHash**: Transaction identifier for reference

### Extending the System

The codebase is designed for extension:

1. **Add Database Storage**: Listen to `streamswap.detected` event in a new service
2. **Add Trading Logic**: Create a trading service that responds to opportunities
3. **Add Notifications**: Integrate Telegram/Discord/Email in the detector
4. **Add Analytics**: Calculate profitability, track success rates, etc.

## Troubleshooting

### WebSocket Not Connecting

Check the logs for connection errors. The service will automatically retry. If it continues failing:
- Verify network connectivity
- Check if the THORNode endpoint is accessible
- Try the URL in your browser: https://thornode.ninerealms.com

### No Opportunities Detected

This is normal! Stream swaps involving RUJI may be infrequent. The bot is working correctly and will log opportunities when they occur.

### Port Already in Use

Change the port in your `.env` file or set environment variable:
```bash
PORT=3001 npm run start:dev
```

## Development Tips

### Watch Mode

Use `npm run start:dev` for hot reload during development. Changes to source files automatically restart the server.

### Debug Mode

For detailed debugging:
```bash
npm run start:debug
```

Then attach your debugger to port 9229.

### Check Logs

All services use contextual logging. Look for:
- `[WebSocketService]` - Connection status
- `[DetectorService]` - Opportunity detection
- `[MidgardService]` - API calls and responses

### Monitor Health

Periodically check the health endpoint:
```bash
watch -n 5 curl -s http://localhost:3000/health
```

## API Testing

While the service primarily runs in the background, you can test the health endpoint:

```bash
# Check overall health
curl http://localhost:3000/health

# Pretty print with jq
curl -s http://localhost:3000/health | jq
```

## Stopping the Application

Press `CTRL+C` in the terminal. The application will:
1. Stop accepting new connections
2. Close WebSocket connection
3. Complete any in-flight requests
4. Shut down gracefully

## Support

If you encounter issues:
1. Check the console logs for detailed error messages
2. Verify all dependencies are installed (`npm install`)
3. Ensure Node.js version is compatible (v18+ recommended)
4. Try rebuilding: `npm run build`

