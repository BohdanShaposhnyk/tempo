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
     * Fetch recent actions from Midgard
     */
    async getRecentActions(limit: number = 10): Promise<MidgardAction[]> {
        try {
            this.logger.debug(`Fetching ${limit} recent actions`);

            const response$ = this.httpService
                .get<MidgardActionsResponse>(`${this.baseUrl}/v2/actions`, {
                    params: {
                        limit: limit.toString(),
                        type: 'swap', // Only get swap actions
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
            action.metadata?.swap?.isStreamingSwap === true &&
            action.metadata.swap.streamingSwapMeta !== undefined
        );
    }

    /**
     * Check if an action involves RUJI token
     */
    involvesRuji(action: MidgardAction): boolean {
        const rujiToken = THORCHAIN_CONSTANTS.RUJI_TOKEN;

        // Check input transactions for RUJI coins
        const hasRujiInput = action.in?.some(tx =>
            tx.coins?.some(coin => coin.asset === rujiToken)
        ) ?? false;

        // Check output transactions for RUJI coins
        const hasRujiOutput = action.out?.some(tx =>
            tx.coins?.some(coin => coin.asset === rujiToken)
        ) ?? false;

        // Check pools involved (pool names use dot notation like THOR.RUJI)
        const hasRujiPool = action.pools?.some((pool) => pool.includes('RUJI')) ?? false;

        return hasRujiInput || hasRujiOutput || hasRujiPool;
    }

    /**
     * Extract swap direction from action
     */
    getSwapDirection(action: MidgardAction): {
        from: string;
        to: string;
    } | null {
        if (!action.in || !action.out || action.in.length === 0 || action.out.length === 0) {
            return null;
        }

        const inCoin = action.in[0]?.coins?.[0];
        const outCoin = action.out[0]?.coins?.[0];

        if (!inCoin || !outCoin) {
            return null;
        }

        return {
            from: inCoin.asset,
            to: outCoin.asset,
        };
    }
}

