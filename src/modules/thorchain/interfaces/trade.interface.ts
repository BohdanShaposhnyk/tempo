export enum TradeDirection {
    short = "short",
    long = "long",
}

export type TradeState =
    | 'detected'      // signal found, awaiting validation
    | 'planned'       // execution plan built (price targets, pool checked)
    | 'submitted'     // transaction submitted to Thorchain
    | 'confirmed'     // transaction confirmed on-chain
    | 'exiting'       // exit leg executing
    | 'completed'     // both legs done, PnL realized
    | 'failed';       // failed or invalidated

export interface Trade {
    id: string; // use signalTxHash
    signalTxHash: string;
    pool: string;             // e.g. "THOR.RUJI"
    direction: TradeDirection;
    detectedAt: Date;
    state: TradeState;
    inputAsset: string;
    outputAsset: string;
    inputAmount: number;
    outputEstimate?: number;
    executedTxHash?: string;
    exitTxHash?: string;
    pnl?: number;
    error?: string;
}