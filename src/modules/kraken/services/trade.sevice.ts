import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

interface OrderBook {
    bids: [string, string][]; // [price, volume]
    asks: [string, string][];
}

export interface SimulatedTradeResult {
    executed: boolean;
    side: 'buy' | 'sell';
    avgPrice: number;
    filledQty: number;
    totalCost: number; // for buy = cost spent; for sell = proceeds received
    slippagePct: number;
}

/**
 * KrakenService
 * - Fetches depth (order book)
 * - Simulates market execution
 * - Future: execute real trades
 */
@Injectable()
export class KrakenTradeService {
    private readonly logger = new Logger(KrakenTradeService.name);
    private readonly baseUrl = 'https://api.kraken.com/0/public';

    constructor(private readonly http: HttpService) { }

    /**
     * Fetch Kraken order book for a given pair (e.g., XBTUSDT, ETHUSD)
     * @param pair Kraken pair ID
     * @param count number of levels to fetch
     */
    async getOrderBook(pair: string, count = 20): Promise<OrderBook> {
        const url = `${this.baseUrl}/Depth?pair=${pair}&count=${count}`;
        try {
            const res = await this.http.axiosRef.get(url);
            if (res.data.error?.length) {
                throw new Error(res.data.error.join(','));
            }
            const key = Object.keys(res.data.result)[0];
            const { bids, asks } = res.data.result[key];
            return { bids, asks };
        } catch (err) {
            this.logger.error(`Failed to fetch Kraken depth for ${pair}: ${err.message}`);
            throw err;
        }
    }

    /**
     * Simulate a market trade (non-executing)
     * @param side 'buy' or 'sell'
     * @param qty amount of base asset
     */
    simulateMarketTrade(book: OrderBook, side: 'buy' | 'sell', qty: number): SimulatedTradeResult {
        const levels = side === 'buy' ? book.asks : book.bids;
        let remaining = qty;
        let totalCost = 0;
        let weightedPrice = 0;
        let filled = 0;

        for (const [priceStr, volStr] of levels) {
            if (remaining <= 0) break;
            const price = parseFloat(priceStr);
            const volume = parseFloat(volStr);
            const tradeVol = Math.min(volume, remaining);

            totalCost += tradeVol * price;
            weightedPrice += tradeVol * price;
            remaining -= tradeVol;
            filled += tradeVol;
        }

        if (filled === 0) {
            return { executed: false, side, avgPrice: 0, filledQty: 0, totalCost: 0, slippagePct: 0 };
        }

        const avgPrice = weightedPrice / filled;
        const bestLevel = parseFloat(levels[0][0]);
        const slippagePct = ((avgPrice - bestLevel) / bestLevel) * 100 * (side === 'buy' ? 1 : -1);

        return {
            executed: true,
            side,
            avgPrice,
            filledQty: filled,
            totalCost,
            slippagePct,
        };
    }

    /**
     * High-level helper:
     * Fetch book + simulate trade in one go
     */
    async testMarketTrade(pair: string, side: 'buy' | 'sell', qty: number) {
        const book = await this.getOrderBook(pair);
        return this.simulateMarketTrade(book, side, qty);
    }
}
