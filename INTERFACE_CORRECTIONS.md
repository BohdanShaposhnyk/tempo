# Interface Corrections - Midgard API Response Types

## Issue

The initial TypeScript interfaces for Midgard API responses were based on assumptions rather than actual API responses. This could have led to runtime errors when processing real data.

## What Was Wrong

### Original (Incorrect) Interface
```typescript
export interface MidgardAction {
  in: MidgardCoin[];  // ❌ Wrong: in is actually MidgardTx[]
  out: MidgardCoin[]; // ❌ Wrong: out is actually MidgardTx[]
  metadata?: {
    swap?: {
      streaming?: {  // ❌ Wrong: field is called streamingSwapMeta
        count: number;    // ❌ Wrong: these are strings in API
        quantity: number; // ❌ Wrong
        interval: number; // ❌ Wrong
      };
    };
  };
}
```

### Corrected Interface
```typescript
export interface MidgardAction {
  in: MidgardTx[];   // ✅ Correct: array of transaction objects
  out: MidgardTx[];  // ✅ Correct: array of transaction objects
  metadata?: {
    swap?: {
      isStreamingSwap: boolean;  // ✅ Boolean flag to check if streaming
      streamingSwapMeta?: {      // ✅ Correct field name
        count: string;           // ✅ Strings, not numbers
        interval: string;        // ✅
        quantity: string;        // ✅
        depositedCoin: MidgardCoin;
        inCoin: MidgardCoin;
        outCoin: MidgardCoin;
        lastHeight: string;
        outEstimation: string;
      };
      // Plus many other fields...
    };
  };
}

export interface MidgardTx {
  address: string;
  coins: MidgardCoin[];
  txID: string;
  height?: string;
}
```

## Actual API Response Structure

Based on querying `https://midgard.ninerealms.com/v2/actions`:

```json
{
  "actions": [
    {
      "type": "swap",
      "status": "success",
      "in": [
        {
          "address": "thor...",
          "coins": [
            {
              "asset": "ETH~USDC-0X...",
              "amount": "148647071999"
            }
          ],
          "txID": "638E9E..."
        }
      ],
      "out": [
        {
          "address": "thor...",
          "coins": [
            {
              "asset": "BSC~USDT-0X...",
              "amount": "148692598424"
            }
          ],
          "txID": "",
          "height": "23232669"
        }
      ],
      "metadata": {
        "swap": {
          "affiliateAddress": "",
          "affiliateFee": "0",
          "inPriceUSD": "0.9990...",
          "outPriceUSD": "0.9980...",
          "isStreamingSwap": true,
          "liquidityFee": "320446220",
          "memo": "=:BSC~USDT-...",
          "networkFees": [...],
          "swapSlip": "20",
          "swapTarget": "24773593268",
          "txType": "swap",
          "streamingSwapMeta": {
            "count": "6",
            "interval": "1",
            "quantity": "6",
            "lastHeight": "23232669",
            "depositedCoin": {
              "amount": "148647071999",
              "asset": "ETH~USDC-0X..."
            },
            "inCoin": { ... },
            "outCoin": { ... },
            "outEstimation": "148697459604"
          }
        }
      },
      "pools": ["ETH.USDC-0X...", "BSC.USDT-0X..."],
      "date": "1760362109393852063",
      "height": "23232668"
    }
  ]
}
```

## Changes Made

### 1. Updated Interfaces (`thorchain.interface.ts`)
- ✅ Changed `in` and `out` from `MidgardCoin[]` to `MidgardTx[]`
- ✅ Added `MidgardTx` interface with `address`, `coins`, `txID`, `height`
- ✅ Renamed `streaming` to `streamingSwapMeta`
- ✅ Changed all count/interval/quantity from `number` to `string`
- ✅ Added `isStreamingSwap` boolean flag
- ✅ Added all actual metadata fields from API response
- ✅ Added detailed `streamingSwapMeta` structure with all fields

### 2. Updated MidgardService (`midgard.service.ts`)
- ✅ Changed `isStreamSwap()` to check `isStreamingSwap` flag and `streamingSwapMeta` existence
- ✅ Updated `involvesRuji()` to navigate through `tx.coins` arrays
- ✅ Updated `getSwapDirection()` to extract coins from transaction objects

### 3. Updated DetectorService (`detector.service.ts`)
- ✅ Changed to access `streamingSwapMeta` instead of `streaming`
- ✅ Parse string values to numbers: `parseInt(streamingMeta.count)`
- ✅ Updated duration calculation (interval is in blocks, ~6s per block)
- ✅ Fixed timestamp conversion from nanoseconds to milliseconds
- ✅ Updated to access `action.in[0].coins[0].amount` (nested structure)
- ✅ Extract `txID` from `action.in[0].txID`

## Key Learnings

1. **Always verify API responses** - Don't assume structure based on documentation alone
2. **Query actual endpoints** - Use `curl` or similar tools to inspect real responses
3. **String vs Number** - APIs often return numeric values as strings for precision
4. **Nested structures** - THORChain responses have deeply nested transaction objects
5. **Field naming** - `streamingSwapMeta` not `streaming`, `isStreamingSwap` boolean flag

## Testing

Verified by:
1. ✅ Querying `https://midgard.ninerealms.com/v2/actions?limit=50&type=swap`
2. ✅ Finding actual streaming swaps with `"isStreamingSwap": true`
3. ✅ Inspecting the `streamingSwapMeta` structure
4. ✅ Building the project successfully with correct types
5. ✅ No linter errors

## Reference

- API Documentation: https://midgard.ninerealms.com/v2/doc#operation/GetActions
- Live API endpoint: https://midgard.ninerealms.com/v2/actions

## Impact

These corrections ensure:
- ✅ No runtime errors when accessing nested properties
- ✅ Correct type checking throughout the application
- ✅ Proper stream swap detection
- ✅ Accurate duration calculations
- ✅ Correct RUJI token detection in multi-hop swaps

