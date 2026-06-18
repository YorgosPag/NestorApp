/**
 * createMicrotaskCoalescer — SSoT coalescing primitive tests (ADR-488).
 */

import { createMicrotaskCoalescer } from '../proactive-coalescer';

const flush = (): Promise<void> => Promise.resolve().then(() => undefined);
/** Στράγγισε όλη την ουρά microtask (πολλαπλά passes) ώστε re-entrant schedules να ολοκληρωθούν. */
const flushAll = async (): Promise<void> => {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
};

describe('createMicrotaskCoalescer (ADR-488)', () => {
  it('πολλά schedule() στο ίδιο tick → ΕΝΑ run', async () => {
    let runs = 0;
    const { schedule } = createMicrotaskCoalescer(() => { runs += 1; });
    schedule();
    schedule();
    schedule();
    expect(runs).toBe(0); // τίποτα σύγχρονα
    await flush();
    expect(runs).toBe(1);
  });

  it('schedule() μετά την εκτέλεση → νέο run (το flag μηδενίζεται)', async () => {
    let runs = 0;
    const { schedule } = createMicrotaskCoalescer(() => { runs += 1; });
    schedule();
    await flush();
    expect(runs).toBe(1);
    schedule();
    await flush();
    expect(runs).toBe(2);
  });

  it('re-entrant schedule() μέσα στο run → προγραμματίζει επόμενο pass', async () => {
    let runs = 0;
    const coalescer = createMicrotaskCoalescer(() => {
      runs += 1;
      if (runs === 1) coalescer.schedule(); // ζήτα δεύτερο pass μέσα στο πρώτο
    });
    coalescer.schedule();
    await flushAll();
    expect(runs).toBe(2); // πρώτο pass + re-entrant δεύτερο pass
  });
});
