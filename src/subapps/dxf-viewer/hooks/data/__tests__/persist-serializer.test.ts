import { createPersistSerializer } from '../persist-serializer';

/** Resolve on the next macrotask — lets pending microtasks settle deterministically. */
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe('createPersistSerializer', () => {
  it('runs tasks for the SAME id sequentially (second waits for first)', async () => {
    const s = createPersistSerializer();
    const order: string[] = [];
    let releaseFirst!: () => void;

    const first = s.run('a', async () => {
      order.push('first:start');
      await new Promise<void>((r) => {
        releaseFirst = r;
      });
      order.push('first:end');
    });
    const second = s.run('a', async () => {
      order.push('second:start');
    });

    await tick();
    // Second must NOT have started while first is still in flight.
    expect(order).toEqual(['first:start']);

    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(['first:start', 'first:end', 'second:start']);
  });

  it('runs tasks for DIFFERENT ids concurrently (no cross-id blocking)', async () => {
    const s = createPersistSerializer();
    const order: string[] = [];
    let releaseA!: () => void;

    const a = s.run('a', async () => {
      order.push('a:start');
      await new Promise<void>((r) => {
        releaseA = r;
      });
    });
    const b = s.run('b', async () => {
      order.push('b:start');
    });

    await tick();
    // b is on a different id — it proceeds without waiting for a.
    expect(order).toContain('b:start');

    releaseA();
    await Promise.all([a, b]);
  });

  it('lets the second task observe state committed by the first (audit baseline)', async () => {
    // Mirrors the create→auto-attach race: the first persist commits the baseline,
    // the second must see it so it routes through `updated` instead of `created`.
    const s = createPersistSerializer();
    const lastSaved = new Map<string, string>();
    const audits: Array<'created' | 'updated'> = [];

    const persistOnce = (id: string, value: string) => async () => {
      const isNew = !lastSaved.has(id);
      await tick(); // simulate async setDoc
      lastSaved.set(id, value);
      audits.push(isNew ? 'created' : 'updated');
    };

    // Fire both in the same tick (create, then synchronous auto-attach re-persist).
    const p1 = s.run('w1', persistOnce('w1', 'storey-ceiling'));
    const p2 = s.run('w1', persistOnce('w1', 'attached'));
    await Promise.all([p1, p2]);

    expect(audits).toEqual(['created', 'updated']);
    expect(lastSaved.get('w1')).toBe('attached');
  });

  it('isolates a failing prior task — the next still runs in order', async () => {
    const s = createPersistSerializer();
    const order: string[] = [];

    const failing = s.run('a', async () => {
      order.push('failing');
      throw new Error('boom');
    });
    const next = s.run('a', async () => {
      order.push('next');
    });

    await expect(failing).rejects.toThrow('boom');
    await next;
    expect(order).toEqual(['failing', 'next']);
  });
});
