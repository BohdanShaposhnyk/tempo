import { MidgardAction } from "src/modules/thorchain/interfaces/thorchain.interface";

/**
 * Format amount for display (convert from base units)
 */
export function formatAmount(amount: string | number, divisor = 100000000): number {
    return parseFloat(amount.toString()) / divisor;
}

export function getStreamSwapSizeInUSD(action: MidgardAction): number {
    try {
        const { swap: { streamingSwapMeta, outPriceUSD } = {} } = action.metadata ?? {};
        const { outEstimation } = streamingSwapMeta ?? {};
        if (!outEstimation || !outPriceUSD) {
            return 0;
        }

        return formatAmount(outEstimation) * formatAmount(outPriceUSD);
    } catch (error) {
        return 0;
    }
}

