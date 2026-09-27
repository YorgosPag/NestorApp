/** Άγκυρες της ουράς προτεραιότητας (ADR-884 Φ2ε · §4.11): όριο · σειρά · ιδεμποτία · απομόνωση · ακύρωση. */

import { createPriorityTaskQueue, TaskCancelledError } from '../priority-task-queue';

interface Gate {
  readonly started: string[];
  readonly open: (key: string, value?: unknown) => void;
  readonly fail: (key: string) => void;
  readonly signals: Map<string, AbortSignal>;
  readonly task: (key: string) => (signal: AbortSignal) => Promise<unknown>;
}

function gate(): Gate {
  const started: string[] = [];
  const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();
  const signals = new Map<string, AbortSignal>();
  return {
    started,
    signals,
    open: (key, value = key) => pending.get(key)?.resolve(value),
    fail: (key) => pending.get(key)?.reject(new Error(`boom ${key}`)),
    task: (key) => (signal) => {
      started.push(key);
      signals.set(key, signal);
      return new Promise((resolve, reject) => pending.set(key, { resolve, reject }));
    },
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('createPriorityTaskQueue', () => {
  it('ποτέ πάνω από N ταυτόχρονα, και ο επόμενος ξεκινά μόλις ελευθερωθεί θέση', async () => {
    const q = createPriorityTaskQueue(2);
    const g = gate();
    for (const k of ['a', 'b', 'c']) void q.schedule(k, { priority: 0, group: 'g' }, g.task(k));
    expect(g.started).toEqual(['a', 'b']);
    g.open('a');
    await flush();
    expect(g.started).toEqual(['a', 'b', 'c']);
  });

  it('το πιο επείγον (μικρότερη προτεραιότητα) ξεκινά πρώτο — και μετά από reprioritize', async () => {
    const q = createPriorityTaskQueue(1);
    const g = gate();
    void q.schedule('busy', { priority: 0, group: 'g' }, g.task('busy'));
    void q.schedule('far', { priority: 3, group: 'g' }, g.task('far'));
    void q.schedule('mid', { priority: 2, group: 'g' }, g.task('mid'));
    q.reprioritize('far', 1);
    g.open('busy');
    await flush();
    expect(g.started).toEqual(['busy', 'far']);
  });

  it('ίδιο κλειδί ⇒ ΙΔΙΑ υπόσχεση, μία εκτέλεση', async () => {
    const q = createPriorityTaskQueue(1);
    const g = gate();
    const first = q.schedule('t', { priority: 5, group: 'g' }, g.task('t'));
    const second = q.schedule('t', { priority: 1, group: 'g' }, g.task('t'));
    expect(second).toBe(first);
    g.open('t', 42);
    await expect(first).resolves.toBe(42);
    expect(g.started).toEqual(['t']);
  });

  it('μια εργασία που αποτυγχάνει δεν σταματά τις άλλες', async () => {
    const q = createPriorityTaskQueue(1);
    const g = gate();
    const bad = q.schedule('bad', { priority: 0, group: 'g' }, g.task('bad'));
    const good = q.schedule('good', { priority: 1, group: 'g' }, g.task('good'));
    g.fail('bad');
    await expect(bad).rejects.toThrow('boom bad');
    await flush();
    g.open('good');
    await expect(good).resolves.toBe('good');
  });

  it('retainOnly: πετά ό,τι ΠΕΡΙΜΕΝΕΙ και δεν χρειάζεται — ό,τι τρέχει τελειώνει', async () => {
    const q = createPriorityTaskQueue(1);
    const g = gate();
    const running = q.schedule('run', { priority: 0, group: 'g' }, g.task('run'));
    const gone = q.schedule('gone', { priority: 1, group: 'g' }, g.task('gone'));
    const kept = q.schedule('kept', { priority: 2, group: 'g' }, g.task('kept'));
    q.retainOnly('g', new Set(['kept']));
    await expect(gone).rejects.toBeInstanceOf(TaskCancelledError);
    expect(g.signals.get('run')?.aborted).toBe(false);
    g.open('run');
    await expect(running).resolves.toBe('run');
    await flush();
    expect(g.started).toEqual(['run', 'kept']);
    g.open('kept');
    await kept;
  });

  it('cancelGroup: ακυρώνει και ό,τι τρέχει (σήμα) και ό,τι περιμένει — άλλες ομάδες ανέγγιχτες', async () => {
    const q = createPriorityTaskQueue(1);
    const g = gate();
    const a = q.schedule('a', { priority: 0, group: 'old' }, g.task('a'));
    const b = q.schedule('b', { priority: 1, group: 'old' }, g.task('b'));
    const c = q.schedule('c', { priority: 2, group: 'new' }, g.task('c'));
    q.cancelGroup('old');
    expect(g.signals.get('a')?.aborted).toBe(true);
    await expect(b).rejects.toBeInstanceOf(TaskCancelledError);
    g.fail('a');
    await expect(a).rejects.toBeInstanceOf(TaskCancelledError);
    await flush();
    expect(g.started).toEqual(['a', 'c']);
    g.open('c');
    await expect(c).resolves.toBe('c');
    expect(q.stats()).toEqual({ queued: 0, running: 0 });
  });

  it('ακυρωμένη εργασία που ΤΕΛΕΙΩΣΕ αγνοώντας το σήμα ⇒ ακύρωση, ποτέ το αποτέλεσμα', async () => {
    const q = createPriorityTaskQueue(1);
    const g = gate();
    const stale = q.schedule('stale', { priority: 0, group: 'old' }, g.task('stale'));
    q.cancelGroup('old');
    g.open('stale', 'late image');
    await expect(stale).rejects.toBeInstanceOf(TaskCancelledError);
  });
});
