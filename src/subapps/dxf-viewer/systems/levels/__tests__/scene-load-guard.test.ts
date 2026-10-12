/**
 * ADR-913 §3.6 — ο φρουρός φόρτωσης με μίσθωση.
 *
 * Το περιστατικό (Chrome, 2026-10-11): F5 πάνω σε πρόχειρο ⇒ η φόρτωση της προεπιλεγμένης
 * κάτοψης ακυρώνεται, το πρόχειρο δεν έχει αρχείο άρα δεν ξεκινά νέα, και ο φρουρός έμενε
 * αναμμένος για όλη τη συνεδρία — καμία αποθήκευση.
 */

import { createSceneLoadGuard } from '../scene-load-guard';

function harness() {
  const calls: boolean[] = [];
  const guard = createSceneLoadGuard((loading) => calls.push(loading));
  return { calls, guard, isLoading: () => calls[calls.length - 1] ?? false };
}

describe('createSceneLoadGuard', () => {
  it('η φόρτωση ανάβει τον φρουρό και η απελευθέρωσή της τον σβήνει', () => {
    const { guard, calls } = harness();
    const release = guard.begin();
    expect(calls).toEqual([true]);
    release();
    expect(calls).toEqual([true, false]);
  });

  it('ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ: ακυρωμένη φόρτωση χωρίς διάδοχο δεν αφήνει τον φρουρό αναμμένο', () => {
    const { guard, isLoading } = harness();
    const release = guard.begin(); // η προεπιλεγμένη κάτοψη αρχίζει να φορτώνει
    release(); // cleanup του effect: αλλαγή σε επίπεδο ΧΩΡΙΣ αρχείο — καμία νέα φόρτωση
    expect(isLoading()).toBe(false);
  });

  it('η απελευθέρωση είναι idempotent (cleanup μετά από ολοκληρωμένη φόρτωση)', () => {
    const { guard, calls } = harness();
    const release = guard.begin();
    release();
    release();
    expect(calls).toEqual([true, false]);
  });

  it('καθυστερημένη απελευθέρωση παλιάς φόρτωσης ΔΕΝ σβήνει τον φρουρό της νεότερης', () => {
    const { guard, isLoading, calls } = harness();
    const releaseA = guard.begin(); // Α τελειώνει· το rAF της εκκρεμεί
    const releaseB = guard.begin(); // αλλαγή επιπέδου: η Β παίρνει τον φρουρό
    releaseA(); // το rAF της Α φτάνει τώρα
    expect(isLoading()).toBe(true);
    releaseB();
    expect(isLoading()).toBe(false);
    expect(calls).toEqual([true, true, false]);
  });

  it('μετά την απελευθέρωση, νέα φόρτωση ξαναπαίρνει τον φρουρό κανονικά', () => {
    const { guard, isLoading } = harness();
    guard.begin()();
    const release = guard.begin();
    expect(isLoading()).toBe(true);
    release();
    expect(isLoading()).toBe(false);
  });
});
