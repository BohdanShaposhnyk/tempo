import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { KrakenAuthService } from './auth.service';
import { TRADE_CONFIG_CONSTANTS } from 'src/common/constants/tradeConfig.constants';

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

export interface KrakenOrderResult {
    orderId: string;
    status: string;
    description: string;
    volume: string;
    price?: string;
    avgPrice?: string;
    filled?: string;
    remaining?: string;
    cost?: string;
    fee?: string;
}

export interface KrakenBalance {
    [asset: string]: string;
}

/**
 * KrakenService
 * - Fetches depth (order book)
 * - Simulates market execution
 * - Executes real trades via private API
 */
@Injectable()
export class KrakenTradeService {
    private readonly logger = new Logger(KrakenTradeService.name);
    private readonly publicUrl = 'https://api.kraken.com/0/public';
    private readonly privateUrl = 'https://api.kraken.com/0/private';

    constructor(
        private readonly http: HttpService,
        private readonly authService: KrakenAuthService,
    ) { }

    /**
     * Fetch Kraken order book for a given pair (e.g., XBTUSDT, ETHUSD)
     * @param pair Kraken pair ID
     * @param count number of levels to fetch
     */
    async getOrderBook(pair: string, count = 20): Promise<OrderBook> {
        const url = `${this.publicUrl}/Depth?pair=${pair}&count=${count}`;
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

    /**
     * Place a market order on Kraken
     * @param side 'buy' or 'sell'
     * @param qty amount of base asset
     * @param dryRun if true, only simulate the trade
     */
    async placeMarketOrder(side: 'buy' | 'sell', qty: number, dryRun = false): Promise<KrakenOrderResult | SimulatedTradeResult> {
        const pair = TRADE_CONFIG_CONSTANTS.KRAKEN_PAIR;

        if (dryRun || TRADE_CONFIG_CONSTANTS.DRY_RUN_MODE) {
            this.logger.log(`[DRY RUN] Placing ${side} order for ${qty} ${pair}`);
            const book = await this.getOrderBook(pair);
            return this.simulateMarketTrade(book, side, qty);
        }

        try {
            const path = '/0/private/AddOrder';
            const data = {
                pair,
                type: side,
                ordertype: 'market',
                volume: qty.toString(),
            };

            const headers = await this.authService.getAuthHeaders(path, data);
            const postData = new URLSearchParams({ ...data, nonce: Date.now().toString() }).toString();

            const response = await this.http.axiosRef.post(
                `${this.privateUrl}${path}`,
                postData,
                {
                    headers: {
                        ...headers,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            if (response.data.error?.length) {
                throw new Error(response.data.error.join(', '));
            }

            const result = response.data.result;
            const orderId = Object.keys(result.txid)[0];
            const orderInfo = result.txid[orderId];

            this.logger.log(`Order placed successfully: ${orderId} - ${side} ${qty} ${pair}`);

            return {
                orderId,
                status: orderInfo.status || 'pending',
                description: orderInfo.desc?.order || '',
                volume: qty.toString(),
            };
        } catch (error) {
            this.logger.error(`Failed to place market order: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get order status
     */
    async getOrderStatus(orderId: string): Promise<KrakenOrderResult | null> {
        try {
            const path = '/0/private/QueryOrders';
            const data = { txid: orderId };

            const headers = await this.authService.getAuthHeaders(path, data);
            const postData = new URLSearchParams({ ...data, nonce: Date.now().toString() }).toString();

            const response = await this.http.axiosRef.post(
                `${this.privateUrl}${path}`,
                postData,
                {
                    headers: {
                        ...headers,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            if (response.data.error?.length) {
                throw new Error(response.data.error.join(', '));
            }

            const result = response.data.result[orderId];
            if (!result) {
                return null;
            }

            return {
                orderId,
                status: result.status,
                description: result.desc?.order || '',
                volume: result.vol,
                price: result.price,
                avgPrice: result.avg_price,
                filled: result.vol_exec,
                remaining: result.vol,
                cost: result.cost,
                fee: result.fee,
            };
        } catch (error) {
            this.logger.error(`Failed to get order status: ${error.message}`);
            throw error;
        }
    }

    /**
     * Cancel an order
     */
    async cancelOrder(orderId: string): Promise<boolean> {
        try {
            const path = '/0/private/CancelOrder';
            const data = { txid: orderId };

            const headers = await this.authService.getAuthHeaders(path, data);
            const postData = new URLSearchParams({ ...data, nonce: Date.now().toString() }).toString();

            const response = await this.http.axiosRef.post(
                `${this.privateUrl}${path}`,
                postData,
                {
                    headers: {
                        ...headers,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            if (response.data.error?.length) {
                throw new Error(response.data.error.join(', '));
            }

            this.logger.log(`Order cancelled: ${orderId}`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to cancel order: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get account balance
     */
    async getBalance(): Promise<KrakenBalance> {
        try {
            const path = '/0/private/Balance';
            const data = {};

            const headers = await this.authService.getAuthHeaders(path, data);
            const postData = new URLSearchParams({ ...data, nonce: Date.now().toString() }).toString();

            const response = await this.http.axiosRef.post(
                `${this.privateUrl}${path}`,
                postData,
                {
                    headers: {
                        ...headers,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            if (response.data.error?.length) {
                throw new Error(response.data.error.join(', '));
            }

            return response.data.result;
        } catch (error) {
            this.logger.error(`Failed to get balance: ${error.message}`);
            throw error;
        }
    }
}
