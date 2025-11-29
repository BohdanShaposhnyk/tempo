import { MidgardAction, ThornodeTxStatus } from "src/modules/thorchain/interfaces/thorchain.interface";

/**
 * Format amount for display (convert from base units)
 */
export function formatAmount(amount: string | number, divisor = 100000000): number {
    return parseFloat(amount.toString()) / divisor;
}

/**
 * Calculate USD size from THORNode transaction data
 * @param txStatus THORNode transaction status
 * @param assetPriceUSD Asset price in USD
 * @returns USD size or 0 if calculation fails
 */
export function calculateSizeFromThornodeTx(txStatus: ThornodeTxStatus, assetPriceUSD: number): number {
    try {
        if (!txStatus.tx?.coins || txStatus.tx.coins.length === 0) {
            return 0;
        }

        const coin = txStatus.tx.coins[0];
        const amount = formatAmount(coin.amount);

        if (!isFinite(amount) || !isFinite(assetPriceUSD) || amount <= 0 || assetPriceUSD <= 0) {
            return 0;
        }

        const sizeUSD = amount * assetPriceUSD;
        return isFinite(sizeUSD) ? sizeUSD : 0;
    } catch (error) {
        return 0;
    }
}

/**
 * @deprecated Use calculateSizeFromThornodeTx instead for reliable size calculation
 * Fallback function for calculating size from Midgard action data
 */
export function getStreamSwapSizeInUSD(action: MidgardAction): number {
    try {
        const { swap: { streamingSwapMeta, outPriceUSD = '0', inPriceUSD = '0' } = {} } = action.metadata ?? {};
        const { outEstimation, depositedCoin } = streamingSwapMeta ?? {};

        const [inAmount, outAmount] = [depositedCoin?.amount ?? '0', outEstimation ?? '0'].map(x => formatAmount(x));

        return Math.max(inAmount * parseFloat(inPriceUSD), outAmount * parseFloat(outPriceUSD));

    } catch (error) {
        return 0;
    }
}
