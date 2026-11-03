"use client";

/**
 * @fileoverview **Ο ΠΙΝΑΚΑΣ ΜΗΝΥΜΑΤΩΝ, ΜΟΝΟ ΟΤΑΝ ΜΠΟΡΕΙ ΝΑ ΖΩΓΡΑΦΙΣΕΙ ΣΩΣΤΑ** — ADR-744 §34.
 * @related `../deferred-message-table.ts` (ο πίνακας) · `./useBundlesComplete.ts` (η αυθεντία πληρότητας)
 *
 * Ο πίνακας επιστρέφεται **μόνο** όταν έχει φτάσει **και** τα namespaces του είναι πλήρη. Μέχρι τότε `null`, και η
 * μετάφραση δίνει τη γενική λέξη του καταναλωτή (από το slice) — ποτέ ωμό κλειδί.
 *
 * 🔑 `getServerSnapshot` ⇒ `null`: στον server κανένα εύρημα δεν έχει ζωγραφιστεί ακόμη, και ο client ξεκινά από το
 *    ίδιο σημείο ⇒ καμία ασυμφωνία hydration, ακόμη κι αν ο πίνακας είναι ήδη στη μνήμη από προηγούμενη σελίδα.
 * 🔑 Προφόρτωση σε αδράνεια μετά το mount· **άμεση** όταν `needed` (υπάρχει εύρημα να δειχτεί τώρα).
 * 🔑 **Η ΜΙΑ δυναμική `t()`** όλων των πινάκων ζει εδώ, στο `useDeferredMessage`, και φτάνει σε αυτή **μόνο** με πίνακα
 *    **και** πλήρες bundle. ⚠️ Ο γεννήτορας του slice **δεν** τη βλέπει: το `t` έρχεται ως παράμετρος, γνωστό τυφλό
 *    σημείο του εξαγωγέα (ADR-744 §2). Η εγγύηση «ποτέ ωμό κλειδί» στηρίζεται εδώ στη φρουρά χρόνου εκτέλεσης και στις
 *    άγκυρές της (`deferred-message-table.test.tsx`, μεταλλάξεις M1/M2), **όχι** στον γεννήτορα.
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { TOptions } from 'i18next';

import { whenIdle, type DeferredMessageTable } from '../deferred-message-table';
import { useBundlesComplete } from './useBundlesComplete';

const serverSnapshot = (): null => null;

export function useDeferredMessageTable<T>(table: DeferredMessageTable<T>, language: string, needed: boolean): T | null {
  const getTable = useCallback(() => table.getTable(), [table]);
  const loaded = useSyncExternalStore(table.subscribe, getTable, serverSnapshot);
  const complete = useBundlesComplete(language, table.namespaces);

  useEffect(() => {
    if (needed) {
      void table.load();
      return undefined;
    }
    return whenIdle(window, () => void table.load());
  }, [table, needed]);

  return loaded !== null && complete ? loaded : null;
}

type Translate = (key: string, options?: TOptions) => string;

/** Η μετάφραση ενός κωδικού: το ακριβές μήνυμα όταν ο πίνακας είναι έτοιμος, αλλιώς το `pending` του καταναλωτή. */
export function useDeferredMessage<Code extends string>(
  table: DeferredMessageTable<Readonly<Record<Code, string>>>,
  options: { readonly language: string; readonly needed: boolean; readonly t: Translate; readonly pending: string },
): (code: Code, params?: TOptions) => string {
  const { language, needed, t, pending } = options;
  const keys = useDeferredMessageTable(table, language, needed);
  return useCallback(
    (code: Code, params?: TOptions) => (keys === null ? pending : t(keys[code], params ?? {})),
    [keys, pending, t],
  );
}
