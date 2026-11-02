/**
 * Το άμεσο άδειασμα (ADR-923 §5.13 Δ3): best effort, με όριο, ποτέ το `catalog`, και ποτέ δεν ρίχνει την πράξη.
 */

import { after } from 'next/server';

import type { PublicScope } from '@/subapps/catalog/public/public-scopes-of-write';
import { schedulePublicDrain } from '../public/public-drain-schedule.server';
import { drainPublicModel } from '../public/public-model-writer.server';

jest.mock('next/server', () => ({ after: jest.fn() }));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => ({}) }));
jest.mock('../public/public-model-writer.server', () => ({ drainPublicModel: jest.fn(async () => 'published') }));

const afterMock = after as jest.MockedFunction<typeof after>;
const drain = drainPublicModel as jest.MockedFunction<typeof drainPublicModel>;

const models = (count: number): PublicScope[] => Array.from({ length: count }, (_, i) => ({ kind: 'model', modelId: `cpmod_${i}` }));

async function runScheduled(): Promise<void> {
  const task = afterMock.mock.calls[0][0] as () => Promise<void>;
  await task();
}

beforeEach(() => {
  afterMock.mockReset();
  drain.mockReset();
  drain.mockResolvedValue('published');
});

describe('schedulePublicDrain', () => {
  it('αδειάζει τα μοντέλα μετά την απάντηση', async () => {
    schedulePublicDrain('comp-a', models(2));
    expect(drain).not.toHaveBeenCalled();
    await runScheduled();
    expect(drain.mock.calls.map((call) => [call[1], call[2]])).toEqual([['comp-a', 'cpmod_0'], ['comp-a', 'cpmod_1']]);
  });

  it('το catalog δεν αδειάζει ποτέ μέσα στην αίτηση', () => {
    schedulePublicDrain('comp-a', [{ kind: 'catalog' }]);
    expect(afterMock).not.toHaveBeenCalled();
  });

  it('μεγάλη εισαγωγή: όριο 20, τα υπόλοιπα τα παίρνει η σάρωση', async () => {
    schedulePublicDrain('comp-a', models(500));
    await runScheduled();
    expect(drain).toHaveBeenCalledTimes(20);
  });

  it('έξω από αίτηση το after πετά: η πράξη δεν πέφτει', () => {
    afterMock.mockImplementation(() => { throw new Error('outside a request scope'); });
    expect(() => schedulePublicDrain('comp-a', models(1))).not.toThrow();
  });

  it('αποτυχία αδειάσματος δεν ξεφεύγει από το after', async () => {
    drain.mockRejectedValue(new Error('5xx'));
    schedulePublicDrain('comp-a', models(1));
    await expect(runScheduled()).resolves.toBeUndefined();
  });
});
