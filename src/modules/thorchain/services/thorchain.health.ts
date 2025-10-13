import { Injectable } from '@nestjs/common';
import {
    HealthIndicator,
    HealthIndicatorResult,
    HealthCheckError,
} from '@nestjs/terminus';
import { PollerService } from './poller.service';

@Injectable()
export class ThorchainHealthIndicator extends HealthIndicator {
    constructor(private readonly pollerService: PollerService) {
        super();
    }

    async isHealthy(key: string): Promise<HealthIndicatorResult> {
        const isHealthy = this.pollerService.isHealthy();
        const lastHeight = this.pollerService.getLastHeight();

        const result = this.getStatus(key, isHealthy, {
            poller: isHealthy ? 'running' : 'stopped',
            lastProcessedHeight: lastHeight,
        });

        if (isHealthy) {
            return result;
        }

        throw new HealthCheckError('THORChain Poller check failed', result);
    }
}

