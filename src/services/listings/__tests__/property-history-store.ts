/**
 * Η ελάχιστη Firestore των σφραγίδων ιστορικού (`property-history-stamp.ts`): **πραγματική** σημασιολογία
 * συναλλαγής και λαβή αγώνα ανάμεσα στην έξω ανάγνωση και τη συναλλαγή. Μία για όλα τα πεδία ιστορικού
 * (`priceHistory` · `availabilityHistory`), ώστε οι σουίτες να μην είναι δίδυμες (ADR-919 §10).
 */

export function historyStoreOf(field: string, initial: Record<string, unknown> | undefined) {
  const state: { doc: Record<string, unknown> | undefined } = { doc: initial };
  const counters = { transactions: 0, updates: 0 };
  let onBeforeTransactionRead: (() => void) | null = null;
  let failUpdate = false;

  const adminDb = {
    collection: () => ({ doc: () => ({}) }),
    runTransaction: async <T,>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      counters.transactions += 1;
      const tx = {
        get: async () => {
          onBeforeTransactionRead?.();
          return { data: () => state.doc };
        },
        update: (_ref: unknown, patch: Record<string, unknown>) => {
          if (failUpdate) throw new Error('PERMISSION_DENIED');
          counters.updates += 1;
          state.doc = { ...(state.doc ?? {}), ...patch };
        },
      };
      return fn(tx);
    },
  } as never;

  return {
    adminDb,
    counters,
    state,
    current: () => state.doc?.[field],
    race: (fn: () => void) => {
      onBeforeTransactionRead = fn;
    },
    breakUpdate: () => {
      failUpdate = true;
    },
  };
}
