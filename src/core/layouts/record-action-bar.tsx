'use client';
/**
 * @fileoverview **Η κάτω μπάρα ενεργειών της σελίδας εγγραφής** — πού αποδίδει τις ενέργειές της η κεφαλίδα μιας
 *   σελίδας εγγραφής (κεφαλίδα με `media`) όταν η οθόνη είναι στενή.
 * @related ADR-912 §12.13 · ADR-777 §8.87.11 · `core/entity-headers/RecordHeaderActions.tsx` (ο καταναλωτής) ·
 *   `details-sheet-actions.tsx` (το ίδιο σχήμα για το φύλλο κινητού)
 * @module core/layouts/record-action-bar
 *
 * 🔴 **Η αφορμή, στιγμιότυπο Giorgio 2026-10-17 (390×844)**: στη σελίδα ακινήτου τέσσερα κουμπιά σε τρεις γραμμές
 *   κάτω από την τιμή ⇒ ~130px πριν από τις καρτέλες, και οι ενέργειες στο πάνω μισό της οθόνης, μακριά από τον αντίχειρα.
 * 🔑 **Πρακτική**: Material 3 *bottom app bar* (κινητό, 2–5 ενέργειες) · Salesforce mobile *action bar* στο κάτω μέρος
 *   της εγγραφής. Η κεφαλίδα **δηλώνει**, η μπάρα **αποδίδει** (portal — ΕΝΑ αντίτυπο στο DOM), όπως στο ADR-912 §12.1.
 * 🔑 **`sticky bottom-0` ως ΤΕΛΕΥΤΑΙΟ παιδί της σελίδας, όχι `fixed`**: κρατά μόνη της τον χώρο της στο τέλος της
 *   ροής (κανένα μαντεμένο `padding-bottom` για να μη σκεπαστεί το τελευταίο στοιχείο) και δεν σπάει μέσα σε πρόγονο
 *   με `container-type`/`transform` (ADR-797 §3.1). Κενή ⇒ `empty:hidden`, δεν πιάνει ούτε pixel.
 * 🔑 **Πλωτή, μέσα στον διάδρομο του κελύφους** (Material 3 Expressive *floating toolbar*, που διαδέχεται το bottom
 *   app bar): όχι `-mx-*` για να φτάσει τις άκρες — ο διάδρομος ανήκει στο κέλυφος (ADR-797, CHECK 3.63).
 * 🔑 **`null` = η σελίδα δεν έχει μπάρα· `{ host: null }` = έχει, αλλά δεν έχει ζωγραφιστεί ακόμη.**
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface RecordActionBarSlot {
  /** Το στοιχείο της μπάρας όπου μπαίνουν οι ενέργειες· `null` ώσπου να στηθεί. */
  readonly host: HTMLElement | null;
}

const RecordActionBarContext = createContext<RecordActionBarSlot | null>(null);

/** `null` ⇒ η σελίδα δεν προσφέρει κάτω μπάρα και η κεφαλίδα αποδίδει τις ενέργειές της επιτόπου. */
export function useRecordActionBar(): RecordActionBarSlot | null {
  return useContext(RecordActionBarContext);
}

/**
 * Τυλίγει το περιεχόμενο μιας σελίδας εγγραφής και βάζει την μπάρα **στο τέλος** του. Ο πρόγονος πρέπει να είναι το
 * στοιχείο που κυλά μαζί με τη σελίδα (εδώ το `<main>`), αλλιώς το `sticky` κολλά στο λάθος κουτί.
 */
export function RecordActionBarProvider({ children }: { readonly children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const slot = useMemo<RecordActionBarSlot>(() => ({ host }), [host]);
  return (
    <RecordActionBarContext.Provider value={slot}>
      {children}
      <footer
        ref={setHost}
        data-record-action-bar=""
        className={cn(
          'sticky bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-[var(--z-index-sticky)] empty:hidden',
          'rounded-xl border bg-background p-2 shadow-lg',
        )}
      />
    </RecordActionBarContext.Provider>
  );
}
