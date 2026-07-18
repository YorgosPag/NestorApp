/**
 * ADR-634 follow-up — per-row write serialization primitive.
 *
 * Proves the invariant the managed-BOQ-row race fix depends on: operations that
 * share a key never interleave (read-modify-write is atomic per row id), while
 * distinct keys still run concurrently, and one task's rejection never blocks the
 * next queued task for the same key.
 */

import { createKeyedSerialQueue } from '../boq-row-write-queue';

/** Resolve on the next microtask/macrotask so overlap can be observed if any. */
function tick(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('createKeyedSerialQueue', () => {
  it('serializes tasks that share a key (no interleave)', async () => {
    const queue = createKeyedSerialQueue();
    const events: string[] = [];

    const makeTask = (label: string) => async () => {
      events.push(`${label}:start`);
      await tick(5);
      events.push(`${label}:end`);
    };

    // Fire both for the SAME key without awaiting the first.
    const p1 = queue.run('row-1', makeTask('A'));
    const p2 = queue.run('row-1', makeTask('B'));
    await Promise.all([p1, p2]);

    // B must not start until A has fully ended.
    expect(events).toEqual(['A:start', 'A:end', 'B:start', 'B:end']);
  });

  it('runs tasks for DIFFERENT keys concurrently', async () => {
    const queue = createKeyedSerialQueue();
    const events: string[] = [];

    const makeTask = (label: string) => async () => {
      events.push(`${label}:start`);
      await tick(5);
      events.push(`${label}:end`);
    };

    const p1 = queue.run('row-1', makeTask('A'));
    const p2 = queue.run('row-2', makeTask('B'));
    await Promise.all([p1, p2]);

    // Both start before either ends → interleaved, not serialized.
    expect(events.slice(0, 2).sort()).toEqual(['A:start', 'B:start']);
  });

  it('returns each task result / rejection to its own caller', async () => {
    const queue = createKeyedSerialQueue();
    await expect(queue.run('k', async () => 42)).resolves.toBe(42);
    await expect(queue.run('k', async () => { throw new Error('boom'); })).rejects.toThrow('boom');
  });

  it('a rejected task does not block the next task for the same key', async () => {
    const queue = createKeyedSerialQueue();
    const order: string[] = [];

    const failing = queue.run('row-1', async () => {
      order.push('failing');
      throw new Error('nope');
    });
    const next = queue.run('row-1', async () => {
      order.push('next');
      return 'ok';
    });

    await expect(failing).rejects.toThrow('nope');
    await expect(next).resolves.toBe('ok');
    expect(order).toEqual(['failing', 'next']);
  });

  it('models the mass-delete race: a single delete happens, no double-write', async () => {
    // Simulate two concurrent recomputes of the same row: each reads existence,
    // then deletes if present. Serialized, only the FIRST sees it present.
    const queue = createKeyedSerialQueue();
    let exists = true;
    let deletes = 0;

    const recompute = () =>
      queue.run('row-1', async () => {
        const present = exists; // read
        await tick(1);          // async gap where the naive race would occur
        if (present && exists) {
          exists = false;       // delete
          deletes += 1;
        }
      });

    await Promise.all([recompute(), recompute(), recompute()]);
    expect(deletes).toBe(1);
  });
});
