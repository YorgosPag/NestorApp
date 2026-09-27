/**
 * @fileoverview **ΟΥΡΑ ΕΡΓΑΣΙΩΝ ΜΕ ΠΡΟΤΕΡΑΙΟΤΗΤΑ ΚΑΙ ΟΡΙΟ ΠΑΡΑΛΛΗΛΩΝ** — ό,τι κάνουν οι θεατές πανοράματος (Marzipano ·
 * Photo Sphere Viewer) για τα πλακίδια: το πιο σημαντικό πρώτο, ποτέ πάνω από N ταυτόχρονα, ό,τι δεν χρειάζεται πια
 * φεύγει από την ουρά πριν ξεκινήσει (ADR-884 Φ2ε · §4.11). Γενικό· χωρίς DOM.
 * @related `components/spatial-tour/viewer/tour-tile-streamer.ts` (πρώτος καταναλωτής)
 * @module lib/async/priority-task-queue
 *
 * 🔑 **Ιδεμπότητο ανά κλειδί**: δεύτερο αίτημα για το ίδιο κλειδί επιστρέφει την ΙΔΙΑ υπόσχεση (και ανεβάζει την
 *   προτεραιότητα αν είναι πιο επείγον) — ένα πλακίδιο δεν κατεβαίνει δύο φορές.
 * 🔑 **Απομόνωση σφαλμάτων**: μια εργασία που αποτυγχάνει απορρίπτει μόνο τη δική της υπόσχεση· η ουρά συνεχίζει.
 * 🔑 **Ακύρωση ανά ομάδα**: `cancelGroup` σταματά ό,τι περιμένει ΚΑΙ ό,τι τρέχει (`AbortSignal`)· `retainOnly` πετά μόνο
 *   ό,τι **περιμένει** και δεν χρειάζεται — ό,τι τρέχει τελειώνει (φθηνότερο από το να ξαναζητηθεί σε λίγο).
 * 🔑 Μικρές ουρές (≤ μερικές εκατοντάδες): γραμμική επιλογή του επόμενου, χωρίς σωρό — απλούστερο και αρκετό.
 */

/** Η απόρριψη μιας εργασίας που ακυρώθηκε πριν/ενώ έτρεχε — ο καλών την αναγνωρίζει με `isTaskCancelled`. */
export class TaskCancelledError extends Error {
  constructor() {
    super('task cancelled');
    this.name = 'TaskCancelledError';
  }
}

export function isTaskCancelled(error: unknown): error is TaskCancelledError {
  return error instanceof TaskCancelledError;
}

export interface PriorityTaskOptions {
  /** Μικρότερο = νωρίτερα. */
  readonly priority: number;
  /** Ομάδα για ακύρωση/κράτημα (π.χ. «πλακίδια του σημείου Χ»). */
  readonly group: string;
}

export interface PriorityTaskQueue {
  /** Βάζει (ή βρίσκει) την εργασία `key`· `run` δέχεται σήμα ακύρωσης. */
  schedule<T>(key: string, options: PriorityTaskOptions, run: (signal: AbortSignal) => Promise<T>): Promise<T>;
  /** Αλλάζει την προτεραιότητα εργασίας που **περιμένει** (σε εκτέλεση: καμία επίδραση). */
  reprioritize(key: string, priority: number): void;
  /** Πετά ό,τι περιμένει στην ομάδα και **δεν** είναι στο `keep`. */
  retainOnly(group: string, keep: ReadonlySet<string>): void;
  /** Ακυρώνει όλη την ομάδα — και ό,τι περιμένει και ό,τι τρέχει. */
  cancelGroup(group: string): void;
  /** Πόσες περιμένουν · πόσες τρέχουν (για διάγνωση και τεστ). */
  stats(): { readonly queued: number; readonly running: number };
}

interface Entry {
  readonly key: string;
  readonly group: string;
  priority: number;
  readonly run: (signal: AbortSignal) => Promise<unknown>;
  readonly controller: AbortController;
  readonly promise: Promise<unknown>;
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: unknown) => void;
}

function makeEntry(key: string, options: PriorityTaskOptions, run: (signal: AbortSignal) => Promise<unknown>): Entry {
  let resolve: (value: unknown) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<unknown>((res, rej) => { resolve = res; reject = rej; });
  // Η ακύρωση είναι ΚΑΝΟΝΙΚΗ ροή, όχι βλάβη: καλών που δεν πρόλαβε να κρεμάσει χειριστή δεν πρέπει να ρίξει τη διεργασία
  // (unhandled rejection). Όποιος κρατά την υπόσχεση βλέπει κανονικά την απόρριψη.
  promise.catch(() => undefined);
  return { key, group: options.group, priority: options.priority, run, controller: new AbortController(), promise, resolve, reject };
}

export function createPriorityTaskQueue(concurrency: number): PriorityTaskQueue {
  const waiting = new Map<string, Entry>();
  const running = new Map<string, Entry>();

  function next(): Entry | null {
    let best: Entry | null = null;
    for (const entry of waiting.values()) if (best === null || entry.priority < best.priority) best = entry;
    return best;
  }

  function pump(): void {
    while (running.size < concurrency) {
      const entry = next();
      if (entry === null) return;
      waiting.delete(entry.key);
      running.set(entry.key, entry);
      entry.run(entry.controller.signal).then(
        // Ακυρωμένη εργασία που τελείωσε παρ' όλα αυτά (αγνόησε το σήμα): ο καλών ζήτησε να ΜΗΝ πάρει το αποτέλεσμα.
        (value) => (entry.controller.signal.aborted ? entry.reject(new TaskCancelledError()) : entry.resolve(value)),
        (error: unknown) => entry.reject(entry.controller.signal.aborted ? new TaskCancelledError() : error),
      ).finally(() => {
        running.delete(entry.key);
        pump();
      });
    }
  }

  function drop(entry: Entry): void {
    waiting.delete(entry.key);
    entry.controller.abort();
    entry.reject(new TaskCancelledError());
  }

  return {
    schedule<T>(key: string, options: PriorityTaskOptions, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
      const existing = waiting.get(key) ?? running.get(key);
      if (existing !== undefined) {
        if (options.priority < existing.priority) existing.priority = options.priority;
        return existing.promise as Promise<T>;
      }
      const entry = makeEntry(key, options, run);
      waiting.set(key, entry);
      pump();
      return entry.promise as Promise<T>;
    },
    reprioritize(key, priority) {
      const entry = waiting.get(key);
      if (entry !== undefined) entry.priority = priority;
    },
    retainOnly(group, keep) {
      for (const entry of [...waiting.values()]) if (entry.group === group && !keep.has(entry.key)) drop(entry);
    },
    cancelGroup(group) {
      for (const entry of [...waiting.values()]) if (entry.group === group) drop(entry);
      for (const entry of running.values()) if (entry.group === group) entry.controller.abort();
    },
    stats: () => ({ queued: waiting.size, running: running.size }),
  };
}
