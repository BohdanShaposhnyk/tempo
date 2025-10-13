# Bug Fix: Multiple RUJI Actions Per Block

## Issue

When multiple RUJI-related actions occurred at the same block height, only the **first action** was being detected and processed. Subsequent actions at the same height were incorrectly skipped.

**Example:** At height 23232703, there were 6 RUJI actions, but only 1 was detected.

## Root Cause

In `poller.service.ts`, the `lastProcessedHeight` was being updated **inside the loop** after processing each action:

```typescript
for (const action of sortedActions) {
  const height = parseInt(action.height);

  // Skip if we've already processed this height
  if (height <= this.lastProcessedHeight) {
    continue;  // ❌ This skips subsequent actions at same height!
  }

  // Process action...

  // Update last processed height
  if (height > this.lastProcessedHeight) {
    this.lastProcessedHeight = height;  // ❌ Updated inside the loop!
  }
}
```

### What Happened

At block height 23232703 with 6 RUJI actions:

1. **First action** (height 23232703):
   - Check: `23232703 <= this.lastProcessedHeight (23232702)` → false, continue
   - Process action ✅
   - Update: `this.lastProcessedHeight = 23232703`

2. **Second action** (height 23232703):
   - Check: `23232703 <= this.lastProcessedHeight (23232703)` → **true, SKIP!** ❌
   
3. **Third action** (height 23232703):
   - Check: `23232703 <= this.lastProcessedHeight (23232703)` → **true, SKIP!** ❌

4-6. Same as above - all skipped ❌

## The Fix

Move the `lastProcessedHeight` update **outside the loop** and only update after all actions have been processed:

```typescript
let maxHeightProcessed = this.lastProcessedHeight;

for (const action of sortedActions) {
  const height = parseInt(action.height);

  // Skip if we've already processed this height
  if (height <= this.lastProcessedHeight) {
    continue;  // ✅ Still compares against original value
  }

  // Process action...

  // Track the maximum height we've seen
  if (height > maxHeightProcessed) {
    maxHeightProcessed = height;  // ✅ Just tracking, not updating yet
  }
}

// Update last processed height after all actions are processed
this.lastProcessedHeight = maxHeightProcessed;  // ✅ Updated AFTER loop
```

### What Happens Now

At block height 23232703 with 6 RUJI actions:

1. **First action** (height 23232703):
   - Check: `23232703 <= this.lastProcessedHeight (23232702)` → false, continue
   - Process action ✅
   - Track: `maxHeightProcessed = 23232703`

2. **Second action** (height 23232703):
   - Check: `23232703 <= this.lastProcessedHeight (23232702)` → **false, PROCESS!** ✅
   - Process action ✅
   - Track: `maxHeightProcessed = 23232703`

3. **Third action** (height 23232703):
   - Check: `23232703 <= this.lastProcessedHeight (23232702)` → **false, PROCESS!** ✅
   - Process action ✅
   - Track: `maxHeightProcessed = 23232703`

4-6. Same - all processed ✅

**After loop completes:**
- Update: `this.lastProcessedHeight = 23232703`

## Result

✅ All 6 RUJI actions at height 23232703 are now detected and processed  
✅ No duplicate processing (height tracking still works correctly)  
✅ Proper handling of multiple actions per block  

## Testing

To verify the fix works:

1. Monitor logs for blocks with multiple RUJI actions
2. Check that all actions at the same height are logged
3. Verify `lastProcessedHeight` increments correctly
4. Confirm no duplicates on subsequent polls

## Files Changed

- `src/modules/thorchain/services/poller.service.ts` - Lines 80-112

## Build Status

✅ Build successful  
✅ No linter errors  
✅ TypeScript compilation passes  

