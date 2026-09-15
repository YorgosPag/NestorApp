/**
 * =============================================================================
 * guard-result — Η ΕΚΒΑΣΗ μιας φυλαγμένης πράξης, ως ΟΝΟΜΑ (ADR-664 · ADR-777 §8.69.13)
 * =============================================================================
 *
 * **Καθαρό — κανένα React.** Ζει χωριστά από το `useImpactDecision` ώστε να το εισάγουν και
 * μη-React στρώσεις (π.χ. `utils/contactForm/execute-guarded-contact-update.ts`) χωρίς να
 * τραβούν hook module.
 *
 * | Έκβαση | Πότε | Τι κάνει ο καλών |
 * |---|---|---|
 * | `completed` | η πράξη **τελείωσε** | κλείνει, μήνυμα επιτυχίας |
 * | `failed` | η πράξη **έσκασε** (κουβαλά το σφάλμα) | μήνυμα σφάλματος |
 * | `cancelled` | ο άνθρωπος είπε όχι σε `warn` / νεότερη κλήση / unmount | σιωπή |
 * | `blocked` | `block`, ή το preview δεν ήταν διαθέσιμο | σιωπή — ο διάλογος εξήγησε |
 */

/** **Τι απέγινε** η φυλαγμένη πράξη. Ονομασμένο, ποτέ boolean. */
export type GuardOutcome = 'completed' | 'cancelled' | 'blocked' | 'failed';

/** Οι εκβάσεις που **δεν** κουβαλούν σφάλμα. */
export type SettledGuardOutcome = Exclude<GuardOutcome, 'failed'>;

export type GuardResult =
  | { readonly outcome: SettledGuardOutcome }
  | { readonly outcome: 'failed'; readonly error: unknown };

export const GUARD_COMPLETED: GuardResult = { outcome: 'completed' };
export const GUARD_CANCELLED: GuardResult = { outcome: 'cancelled' };
export const GUARD_BLOCKED: GuardResult = { outcome: 'blocked' };

/** Τρέχει την πράξη και **ονομάζει** το αποτέλεσμα — ποτέ δεν ρίχνει. */
export async function runGuardedAction(action: () => Promise<void>): Promise<GuardResult> {
  try {
    await action();
    return GUARD_COMPLETED;
  } catch (error) {
    return { outcome: 'failed', error };
  }
}

/**
 * `failed` ⇒ ρίχνει το **αρχικό** σφάλμα, ώστε να το χειριστεί το **υπάρχον** `catch` του καλούντα
 * (π.χ. `translatePropertyMutationError`)· αλλιώς επιστρέφει την έκβαση.
 *
 * 🔑 Κανόνας για κάθε καλούντα: επιτυχία **μόνο** σε `'completed'` · σιωπή σε `'cancelled'`/`'blocked'`.
 */
export function outcomeOrThrow(result: GuardResult): SettledGuardOutcome {
  if (result.outcome === 'failed') throw result.error;
  return result.outcome;
}
