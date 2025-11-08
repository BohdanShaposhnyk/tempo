import { MidgardAction } from "src/modules/thorchain/interfaces/thorchain.interface";

/**
 * Format amount for display (convert from base units)
 */
export function formatAmount(amount: string | number, divisor = 100000000): number {
    return parseFloat(amount.toString()) / divisor;
}

export function getStreamSwapSizeInUSD(action: MidgardAction): number {
    try {
        const { swap: { streamingSwapMeta, outPriceUSD = '0', inPriceUSD = '0' } = {} } = action.metadata ?? {};
        const { outEstimation, depositedCoin } = streamingSwapMeta ?? {};

        const [inAmount, outAmount] = [depositedCoin?.amount ?? '0', outEstimation ?? '0'].map(formatAmount);

        return Math.max(inAmount * parseFloat(inPriceUSD), outAmount * parseFloat(outPriceUSD));

    } catch (error) {
        return 0;
    }
}
