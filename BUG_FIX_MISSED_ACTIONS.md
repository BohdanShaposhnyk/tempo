# Bug Fix: Missed RUJI Actions Due to Low Fetch Limit

## Issue

RUJI actions were being missed by the PollerService, not appearing in logs even though they should have been detected. Example: RUJI action at block 23232768 was skipped entirely.

## Root Cause

The PollerService was only fetching **10 recent actions** per poll:

```typescript
const actions = await this.midgardService.getRecentActions(10);
```

### The Problem

THORChain can have **10+ swap actions in a single block**:

```json
Recent blocks:
- Block 23232821: 10 actions
- Block 23232822: 9 actions  
- Block 23232823: 7 actions
- Block 23232824: 5 actions
```

**What happened:**

1. Poller runs at time T, fetches 10 most recent actions
2. Block 23232821 alone has 10 actions
3. All 10 fetched actions are from block 23232821
4. **Actions from earlier blocks (like 23232768) are not in the batch**
5. Those actions never get processed, even if they contain RUJI

### Additional Risk Factors

- **Polling interval:** 6 seconds (matches block time)
- **Network delays:** API calls can take time
- **Missed polls:** If a poll fails or is delayed, even more actions accumulate
- **Busy periods:** During high activity, multiple blocks can have 10+ actions each

### Example Scenario

```
Time 0:  Block 23232768 created (has RUJI action)
Time 1:  Blocks 23232769-23232770 created (9 actions each)
Time 2:  Block 23232821 created (10 actions)
Time 3:  Poller runs, fetches 10 most recent actions
         → Gets all 10 from block 23232821
         → RUJI action from 23232768 is NOT in the batch
         → RUJI action MISSED ❌
```

## The Fix

Increased fetch limit from **10 to 50 actions**:

```typescript
// Get recent actions from Midgard
// Fetch enough to cover multiple blocks with high activity
// At ~10 actions/block and 6s polling, 50 actions should be safe
const actions = await this.midgardService.getRecentActions(50);
```

### Why 50?

- **Typical block:** ~5-10 swap actions
- **Polling interval:** 6 seconds ≈ 1 block
- **Safety margin:** Even if we miss 1-2 polls, we have ~5 blocks of history
- **Busy periods:** Can handle multiple high-activity blocks
- **API overhead:** Minimal increase (still a small request)

### Coverage Calculation

```
50 actions ÷ 10 actions/block = 5 blocks of coverage
5 blocks × 6 seconds/block = 30 seconds of history

Even with:
- API delays
- Missed poll cycles  
- High-activity periods

We should capture all actions reliably.
```

## Impact

### Before (limit=10)
- ❌ Single block with 10+ actions → miss earlier blocks
- ❌ Delayed poll → miss multiple blocks worth of actions
- ❌ RUJI actions randomly missed

### After (limit=50)
- ✅ Covers ~5 blocks of activity
- ✅ Handles high-activity periods
- ✅ Tolerates poll delays/failures
- ✅ Reliable RUJI detection

## Verification

To verify the fix:

1. **Monitor logs:** Should see more consistent RUJI action detection
2. **Check health endpoint:** `lastProcessedHeight` should increment smoothly
3. **Compare with Midgard:** Query Midgard directly to verify no RUJI actions are missed
4. **Stress test:** Monitor during high-activity periods

### Query to Check RUJI Actions

```bash
# Get all RUJI actions in recent blocks
curl -s "https://midgard.ninerealms.com/v2/actions?limit=100&type=swap" \
  | jq '[.actions[] | select(.pools[] | contains("RUJI"))]'
```

Compare with logged actions to ensure none are missed.

## Trade-offs

### API Load
- **Before:** 10 actions × ~1KB = ~10KB per poll
- **After:** 50 actions × ~1KB = ~50KB per poll
- **Increase:** 5x data, but still minimal (~50KB every 6 seconds)

### Processing
- **Before:** Process up to 10 actions per poll
- **After:** Process up to 50 actions per poll (but most are filtered out)
- **Impact:** Negligible - filtering is very fast

### Duplicates
- Height tracking prevents duplicate processing
- No negative impact from larger fetch size

## Files Changed

- `src/modules/thorchain/services/poller.service.ts` - Line 69: Changed limit from 10 to 50

## Build Status

✅ Build successful  
✅ No linter errors  
✅ TypeScript compilation passes

## Future Optimization

If we still miss actions during extremely busy periods:

1. **Increase limit further** (100, 200)
2. **Implement pagination** - Fetch multiple pages if needed
3. **Add action queue** - Track which actions we've seen
4. **Use height-based fetching** - Fetch by height range instead of recency
5. **Add monitoring** - Alert if action count approaches limit

For now, 50 should be sufficient for normal THORChain activity levels.

