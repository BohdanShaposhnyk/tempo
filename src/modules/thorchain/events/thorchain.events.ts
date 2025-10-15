import { StreamSwapOpportunity } from '../interfaces/thorchain.interface';

/**
 * Event emitted when a stream swap opportunity is detected
 */
export class StreamSwapDetectedEvent {
    constructor(public readonly opportunity: StreamSwapOpportunity) { }
}

export class ValidOpportunityDetectedEvent {
    constructor(public readonly opportunity: StreamSwapOpportunity) { }
}

