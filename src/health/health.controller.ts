import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { ThorchainHealthIndicator } from '../modules/thorchain/services/thorchain.health';

@Controller('health')
export class HealthController {
    constructor(
        private health: HealthCheckService,
        private thorchainHealthIndicator: ThorchainHealthIndicator,
    ) { }

    @Get()
    @HealthCheck()
    check() {
        return this.health.check([
            () => this.thorchainHealthIndicator.isHealthy('thorchain'),
        ]);
    }
}

