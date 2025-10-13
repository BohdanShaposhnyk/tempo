import { StreamSwapOpportunity } from '../interfaces/thorchain.interface';

/**
 * Event emitted when a new transaction is detected on the WebSocket
 */
export class TransactionDetectedEvent {
    constructor(
        public readonly txHash: string,
        public readonly height: string,
        public readonly events: Array<{
            type: string;
            attributes: Array<{ key: string; value: string }>;
        }>,
    ) { }
}

/**
 * Event emitted when a stream swap opportunity is detected
 */
export class StreamSwapDetectedEvent {
    constructor(public readonly opportunity: StreamSwapOpportunity) { }
}

/**
 * Event emitted when the WebSocket connection status changes
 */
export class WebSocketConnectionEvent {
    constructor(
        public readonly connected: boolean,
        public readonly timestamp: Date = new Date(),
    ) { }
}

