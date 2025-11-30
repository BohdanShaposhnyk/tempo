import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, catchError, timeout } from 'rxjs';
import { AxiosError } from 'axios';
import {
    MidgardActionsResponse,
    MidgardPoolResponse,
    MidgardAction,
    MidgardCoin,
} from '../interfaces/thorchain.interface';
import { THORCHAIN_CONSTANTS } from '../../../common/constants/thorchain.constants';

@Injectable()
export class MidgardService {
    private readonly logger = new Logger(MidgardService.name);
    private readonly baseUrl: string;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
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
            this.logger.debug(`Fetching ${limit} recent RUJI actions`);

            const response$ = this.httpService
                .get<MidgardActionsResponse>(`${this.baseUrl}/v2/actions`, {
                    params: {
                        limit: limit.toString(),
                        type: 'swap', // Only get swap actions
                        asset: THORCHAIN_CONSTANTS.RUJI_TOKEN, // Filter by RUJI at API level
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
    getSwapDirection(action: MidgardAction): {
        from: string;
        to: string;
    } | null {
        // Try to get direction from in/out coins first
        if (action.in && action.in.length > 0 && action.out && action.out.length > 0) {
            const inCoin = action.in[0]?.coins?.[0];

            // Find the first out entry with coins (skip empty/affiliate-only entries)
            let outCoin: MidgardCoin | undefined = undefined;
            for (const outTx of action.out) {
                if (outTx.coins && outTx.coins.length > 0) {
                    // Skip if this is just an affiliate fee (same asset as input)
                    const coin = outTx.coins[0];
                    if (coin && coin.asset !== inCoin?.asset) {
                        outCoin = coin;
                        break;
                    }
                }
            }

            if (inCoin && outCoin) {
                return {
                    from: inCoin.asset,
                    to: outCoin.asset,
                };
            }
        }

        // Fallback: Use pools array (pools[0]=input, pools[1]=output)
        // This works for pending stream swaps where out array might be empty
        if (action.pools && action.pools.length >= 2) {
            this.logger.debug(`Using pools array for direction: ${action.pools[0]} -> ${action.pools[1]}`);
            return {
                from: action.pools[0],
                to: action.pools[1],
            };
        }

        // Last resort: Check if we can infer from metadata
        if (action.metadata?.swap?.streamingSwapMeta) {
            const meta = action.metadata.swap.streamingSwapMeta;
            if (meta.inCoin?.asset && meta.outCoin?.asset) {
                this.logger.debug(`Using streamingSwapMeta for direction: ${meta.inCoin.asset} -> ${meta.outCoin.asset}`);
                return {
                    from: meta.inCoin.asset,
                    to: meta.outCoin.asset,
                };
            }
        }

        this.logger.warn(`Could not determine swap direction from any source. ` +
            `Pools: ${action.pools?.length || 0}, ` +
            `In: ${action.in?.length || 0}, ` +
            `Out: ${action.out?.length || 0}`);
        return null;
    }
}

