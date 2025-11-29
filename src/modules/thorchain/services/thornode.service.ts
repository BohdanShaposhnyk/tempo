import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, catchError, timeout } from 'rxjs';
import { AxiosError } from 'axios';
import { of } from 'rxjs';
import { ThornodeTxStatus } from '../interfaces/thorchain.interface';

@Injectable()
export class ThornodeService {
    private readonly logger = new Logger(ThornodeService.name);
    private readonly baseUrl = 'https://thornode.ninerealms.com';

    constructor(private readonly httpService: HttpService) { }

    /**
     * Fetch transaction status from THORNode API
     * @param txHash Transaction hash to fetch
     * @returns Transaction status or null if fetch fails
     */
    async getTransactionStatus(txHash: string): Promise<ThornodeTxStatus | null> {
        try {
            const url = `${this.baseUrl}/thorchain/tx/status/${txHash}`;

            this.logger.debug(`Fetching transaction status from THORNode: ${txHash}`);

            const response = await firstValueFrom(
                this.httpService.get<ThornodeTxStatus>(url).pipe(
                    timeout(5000), // 5 second timeout
                    catchError((error: AxiosError) => {
                        if (error.response) {
                            this.logger.warn(
                                `THORNode API error for tx ${txHash}: ${error.response.status} - ${error.response.statusText}`,
                            );
                        } else if (error.request) {
                            this.logger.warn(`THORNode API request failed for tx ${txHash}: ${error.message}`);
                        } else {
                            this.logger.warn(`THORNode API error for tx ${txHash}: ${error.message}`);
                        }
                        return of(null);
                    }),
                ),
            );

            if (!response || !response.data) {
                return null;
            }

            this.logger.debug(`Successfully fetched transaction status for ${txHash}`);
            return response.data;

        } catch (error) {
            this.logger.error(`Failed to fetch transaction status for ${txHash}: ${error.message}`);
            return null;
        }
    }
}

