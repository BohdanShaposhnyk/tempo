/**
 * Format amount for display (convert from base units)
 */
export function formatAmount(amount: string | number): string | number {
    try {
        const num = BigInt(amount);
        const divisor = BigInt(100000000); // 8 decimals for THORChain
        const whole = num / divisor;
        const fraction = num % divisor;
        return `${whole}.${fraction.toString().padStart(8, '0')}`;
    } catch (error) {
        return amount;
    }
}