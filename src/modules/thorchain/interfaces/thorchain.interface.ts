/**
 * Midgard API Response Types
 * Based on actual API response from https://midgard.ninerealms.com/v2/doc#operation/GetActions
 */
export interface MidgardAction {
    type: string;
    status: string;
    in: MidgardTx[];
    out: MidgardTx[];
    metadata?: {
        swap?: {
            affiliateAddress: string;
            affiliateFee: string;
            inPriceUSD: string;
            outPriceUSD: string;
            isStreamingSwap: boolean;
            liquidityFee: string;
            memo: string;
            networkFees: Array<{ asset: string; amount: string }>;
            swapSlip: string;
            swapTarget: string;
            txType: string;
            streamingSwapMeta?: {
                count: string;
                interval: string;
                quantity: string;
                lastHeight: string;
                depositedCoin: MidgardCoin;
                inCoin: MidgardCoin;
                outCoin: MidgardCoin;
                outEstimation: string;
            };
        };
    };
    pools?: string[];
    date: string;
    height: string;
}

export interface MidgardTx {
    address: string;
    coins: MidgardCoin[];
    txID: string;
    height?: string;
}

export interface MidgardCoin {
    asset: string;
    amount: string;
}

export interface MidgardTransaction {
    txid: string;
    chain: string;
    address: string;
    coins: MidgardCoin[];
    memo?: string;
    gas?: MidgardCoin[];
}

export interface MidgardActionsResponse {
    actions: MidgardAction[];
    count: string;
    meta?: {
        nextPageToken?: string;
    };
}

export interface MidgardPoolResponse {
    asset: string;
    assetDepth: string;
    assetPrice: string;
    assetPriceUSD: string;
    liquidityUnits: string;
    poolAPY: string;
    runeDepth: string;
    status: string;
    synthSupply: string;
    synthUnits: string;
    units: string;
    volume24h: string;
}

/**
 * Stream Swap Detection Types
 */
export interface StreamSwapOpportunity {
    txHash: string;
    timestamp: Date;
    inputAsset: string;
    outputAsset: string;
    inputAmount: string;
    outputAmount: string;
    streamingConfig: {
        count: number;
        quantity: number;
        interval: number;
    };
    estimatedDurationSeconds: number;
    pools: string[];
    height: string;
    $size: number;
    tradeDirection: TradeDirection;
}

/**
 * Configuration Types
 */
export interface ThorchainConfig {
    midgardApiUrl: string;
    rujiToken: string;
    runeToken: string;
}

export enum TradeDirection {
    short = "short",
    long = "long",
}