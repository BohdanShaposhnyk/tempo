# Implementation Note: Polling vs WebSocket

## Issue Encountered

When attempting to connect to `wss://thornode.ninerealms.com/websocket`, we encountered a **501 (Not Implemented)** error. This indicates that either:
1. The WebSocket endpoint doesn't support the subscription method we were using
2. The endpoint requires different authentication or protocol
3. The service may not be available for public WebSocket connections

## Solution: Polling-Based Detection

Instead of WebSocket, we implemented a **reliable polling-based approach** using Midgard's REST API.

### How It Works

1. **PollerService** queries Midgard's `/v2/actions` endpoint every 6 seconds (matching THORChain's block time)
2. Filters for swap actions only to reduce API load
3. Tracks the last processed block height to avoid duplicates
4. Emits `action.detected` events for RUJI-related swaps
5. DetectorService processes these events and identifies stream swap opportunities

### Advantages of Polling

✅ **Reliable**: REST API is stable and well-documented  
✅ **No Connection Issues**: No WebSocket reconnection logic needed  
✅ **Filtered Data**: Only fetches swap actions, reducing noise  
✅ **Height Tracking**: Prevents processing duplicates  
✅ **Simpler**: Easier to debug and maintain  

### Performance Considerations

- **Latency**: ~6 seconds (one block time) vs real-time WebSocket
- **API Calls**: 1 call per 6 seconds = 10 calls/minute = 600 calls/hour
- **Rate Limits**: Well within Midgard's rate limits
- **Resource Usage**: Minimal - single HTTP request per interval

### Configuration

The polling interval is set in `PollerService`:

```typescript
private readonly pollIntervalMs = 6000; // 6 seconds
```

This can be adjusted based on:
- THORChain block time variations
- API rate limit considerations
- Detection latency requirements

## When to Use WebSocket

If WebSocket becomes necessary in the future:

1. **Research**: Find correct THORNode WebSocket subscription format
2. **Authentication**: Check if API keys or special access is needed
3. **Alternative Endpoints**: Consider other THORChain node providers
4. **Fallback**: Keep PollerService as a fallback mechanism

The architecture supports both approaches - just swap `PollerService` for `WebSocketService` in the module providers.

## Trade-offs

| Aspect | WebSocket | Polling (Current) |
|--------|-----------|-------------------|
| Latency | Real-time (~instant) | ~6 seconds |
| Reliability | Depends on connection | Very reliable |
| Complexity | High (reconnection logic) | Low |
| API Load | Low (after connection) | Medium (periodic requests) |
| Debugging | Harder | Easier |
| Implementation | ❌ 501 Error | ✅ Working |

## Conclusion

For the initial detection phase, **polling is the optimal solution**:
- Provides sufficient speed for stream swap detection (duration is typically minutes, not seconds)
- Highly reliable and easy to maintain
- Uses well-documented REST API
- Can be upgraded to WebSocket later if needed

The 6-second latency is acceptable because:
- Stream swaps last minutes (typically 100-300+ seconds)
- We're detecting the start of the stream, not trading instantly
- Trading execution would add its own latency anyway

## Future Optimization

If sub-second detection becomes critical:
1. Try different WebSocket endpoints or node providers
2. Reduce polling interval (e.g., 3 seconds)
3. Implement multiple parallel polling sources
4. Set up a dedicated THORNode with direct access

