import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, catchError, timeout } from 'rxjs';
import { AxiosError } from 'axios';
import {
    MidgardActionsResponse,
    MidgardPoolResponse,
    MidgardAction,
} from '../interfaces/thorchain.interface';
import { THORCHAIN_CONSTANTS } from '../../../common/constants/thorchain.constants';
import { TradeConfigService } from 'src/modules/config/trade-config.service';

@Injectable()
export class MidgardService {
    private readonly logger = new Logger(MidgardService.name);
    private readonly baseUrl: string;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        private readonly tradeConfigService: TradeConfigService,
    ) {
        this.baseUrl =
            this.configService.get<string>('MIDGARD_API_URL') ||
            THORCHAIN_CONSTANTS.MIDGARD_API;
    }

    /**
     * Fetch recent actions from Midgard filtered by asset
     */
    async getRecentActions(limit: number = 10): Promise<MidgardAction[]> {
        try {
            const assets = this.tradeConfigService.getMonitoredAssets();
            const assetParam = assets.join(',');

            const response$ = this.httpService
                .get<MidgardActionsResponse>(`${this.baseUrl}/v2/actions`, {
                    params: {
                        limit: limit.toString(),
                        type: 'swap', // Only get swap actions
                        asset: assetParam,
                    },
                })
                .pipe(
                    timeout(THORCHAIN_CONSTANTS.API_TIMEOUT_MS),
                    catchError((error: AxiosError) => {
                        this.logger.error(
                            `Failed to fetch recent actions: ${error.message}`,
                        );
                        throw error;
                    }),
                );

            const response = await firstValueFrom(response$);
            return response.data.actions || [];
        } catch (error) {
            this.logger.error(`Error in getRecentActions: ${error.message}`);
            return [];
        }
    }

    /**
     * Fetch actions (transactions) by transaction ID
     */
    async getActionsByTxId(txId: string): Promise<MidgardAction[]> {
        try {
            this.logger.debug(`Fetching actions for txId: ${txId}`);

            const response$ = this.httpService
                .get<MidgardActionsResponse>(`${this.baseUrl}/v2/actions`, {
                    params: {
                        txid: txId,
                    },
                })
                .pipe(
                    timeout(THORCHAIN_CONSTANTS.API_TIMEOUT_MS),
                    catchError((error: AxiosError) => {
                        this.logger.error(
                            `Failed to fetch actions for txId ${txId}: ${error.message}`,
                        );
                        throw error;
                    }),
                );

            const response = await firstValueFrom(response$);
            return response.data.actions || [];
        } catch (error) {
            this.logger.error(`Error in getActionsByTxId: ${error.message}`);
            return [];
        }
    }

    /**
     * Fetch pool information for a specific asset
     */
    async getPoolInfo(asset: string): Promise<MidgardPoolResponse | null> {
        try {
            this.logger.debug(`Fetching pool info for asset: ${asset}`);

            const response$ = this.httpService
                .get<MidgardPoolResponse>(`${this.baseUrl}/v2/pool/${asset}`)
                .pipe(
                    timeout(THORCHAIN_CONSTANTS.API_TIMEOUT_MS),
                    catchError((error: AxiosError) => {
                        this.logger.error(
                            `Failed to fetch pool info for ${asset}: ${error.message}`,
                        );
                        throw error;
                    }),
                );

            const response = await firstValueFrom(response$);
            return response.data;
        } catch (error) {
            this.logger.error(`Error in getPoolInfo: ${error.message}`);
            return null;
        }
    }

    /**
     * Check if an action is a stream swap
     */
    isStreamSwap(action: MidgardAction): boolean {
        return (
            action.type === 'swap' &&
            action.metadata?.swap?.isStreamingSwap === true
        );
    }

    /**
     * Extract swap direction from action
     * Uses pools array as fallback for pending/fresh stream swaps with empty out array
     */
    getSwapAssets(action: MidgardAction): {
        from: string;
        to: string;
    } {
        if (action.pools.length === 2) {
            return {
                from: action.pools[0],
                to: action.pools[1],
            };
        }
        // Try to get direction from in/out coins first
        const inCoin = action.in[0].coins[0];

        return inCoin.asset === THORCHAIN_CONSTANTS.RUNE_TOKEN ? {
            from: THORCHAIN_CONSTANTS.RUNE_TOKEN,
            to: action.pools[0],
        } : {
            from: action.pools[0],
            to: THORCHAIN_CONSTANTS.RUNE_TOKEN,
        };
    }

    getPrices(action: MidgardAction): {
        in: number;
        out: number;
    } {
        return {
            in: parseFloat(action.metadata?.swap?.inPriceUSD ?? '0'),
            out: parseFloat(action.metadata?.swap?.outPriceUSD ?? '0'),
        };
    }
}

