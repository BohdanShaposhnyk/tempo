import { EventEmitter2 } from '@nestjs/event-emitter';
import { MidgardService } from './midgard.service';
import { PollerService } from './poller.service';

import {
  MidgardAction,
  MidgardActionStatus,
  MidgardCoin,
  MidgardTx,
} from '../interfaces/thorchain.interface';

function makeAction(height: number, txId: string): MidgardAction {
  const coins: MidgardCoin[] = [];
  const tx: MidgardTx = {
    address: 'addr',
    coins,
    txID: txId,
  };

  return {
    type: 'swap',
    status: 'success' as MidgardActionStatus,
    in: [tx],
    out: [],
    pools: ['THOR.RUJI', 'THOR.TCY'],
    date: '0',
    height: String(height),
  };
}

describe('PollerService', () => {
  let midgardService: jest.Mocked<Pick<MidgardService, 'getRecentActions'>>;
  let eventEmitter: jest.Mocked<Pick<EventEmitter2, 'emit'>>;

  beforeEach(() => {
    midgardService = {
      getRecentActions: jest.fn(),
    };

    eventEmitter = {
      emit: jest.fn(),
    } as unknown as jest.Mocked<Pick<EventEmitter2, 'emit'>>;
  });

  it('emits action.detected in ascending height order', async () => {
    midgardService.getRecentActions.mockResolvedValue([
      makeAction(10, 'txA'),
      makeAction(5, 'txB'),
    ]);

    const service = new PollerService(
      midgardService as unknown as MidgardService,
      eventEmitter as unknown as EventEmitter2,
    );

    const internal = service as unknown as {
      processedTxIds: Set<string>;
      poll: () => Promise<void>;
    };
    internal.processedTxIds = new Set();

    await internal.poll();

    expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
    const firstPayload = eventEmitter.emit.mock.calls[0][1] as unknown as {
      height: string;
    };
    const secondPayload = eventEmitter.emit.mock.calls[1][1] as unknown as {
      height: string;
    };
    expect(firstPayload.height).toBe('5');
    expect(secondPayload.height).toBe('10');
  });

  it('dedupes by txID (does not emit for already-processed txs)', async () => {
    midgardService.getRecentActions.mockResolvedValue([
      makeAction(10, 'txA'),
      makeAction(5, 'txB'),
    ]);

    const service = new PollerService(
      midgardService as unknown as MidgardService,
      eventEmitter as unknown as EventEmitter2,
    );

    const internal = service as unknown as {
      processedTxIds: Set<string>;
      poll: () => Promise<void>;
    };
    internal.processedTxIds = new Set(['txB']);

    await internal.poll();

    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    const onlyPayload = eventEmitter.emit.mock.calls[0][1] as unknown as {
      height: string;
    };
    expect(onlyPayload.height).toBe('10');
  });

  it('skips actions with missing txID', async () => {
    midgardService.getRecentActions.mockResolvedValue([
      makeAction(5, ''), // Poller treats empty txID as missing.
      makeAction(10, 'txA'),
    ]);

    const service = new PollerService(
      midgardService as unknown as MidgardService,
      eventEmitter as unknown as EventEmitter2,
    );

    const internal = service as unknown as {
      processedTxIds: Set<string>;
      poll: () => Promise<void>;
    };
    internal.processedTxIds = new Set();

    await internal.poll();

    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    const onlyPayload = eventEmitter.emit.mock.calls[0][1] as unknown as {
      height: string;
    };
    expect(onlyPayload.height).toBe('10');
  });

  it('logs correct height range for fetched actions', async () => {
    midgardService.getRecentActions.mockResolvedValue([
      makeAction(5, 'txA'),
      makeAction(10, 'txB'),
    ]);

    const service = new PollerService(
      midgardService as unknown as MidgardService,
      eventEmitter as unknown as EventEmitter2,
    );

    const internal = service as unknown as {
      processedTxIds: Set<string>;
      poll: () => Promise<void>;
      logger: { log: (...args: unknown[]) => void };
    };
    internal.processedTxIds = new Set();

    const logSpy = jest
      .spyOn(internal.logger, 'log')
      .mockImplementation(() => undefined);

    await internal.poll();

    const messages = logSpy.mock.calls
      .map((c) => c[0])
      .filter((v): v is string => typeof v === 'string');
    expect(messages.some((m) => m.includes('lastProcessedHeight=10'))).toBe(
      true,
    );
  });
});
