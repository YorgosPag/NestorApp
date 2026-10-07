'use client';

/**
 * **«Είναι αποσυρμένη η εγγραφή που δείχνω;»** — η ερώτηση που κάνει κάθε φύλλο πριν προσφέρει γραφή.
 *
 * Το πλαίσιο λεπτομερειών ενός αποσυρμένου ακινήτου ανοίγει **πλήρες και κλειδωμένο** (ADR-329 §3.9):
 * ίδια tabs, ίδια δεδομένα, καμία πράξη. Το κλείδωμα **ρωτιέται**, δεν περνιέται χέρι-χέρι — ένα prop
 * που ταξιδεύει από την επιφάνεια ως το κουμπί ξεχάστηκε πέντε φορές στο ADR-840 §6.
 *
 * 🔑 **Χωριστό από το `isReadOnly`**: εκείνο είναι **εξουσιοδότηση** (ρόλος, PDP, CHECK 3.68) και δείχνει
 * μειωμένη όψη. Αυτό είναι **κατάσταση της εγγραφής** και δείχνει την πλήρη όψη, ανενεργή. Η σύνθεση είναι
 * μονότονη: γράφεις μόνο αν ο ρόλος επιτρέπει **και** `useRetiredKind() === null`.
 *
 * ⚠️ **Δεν είναι φύλακας.** Φύλακας είναι ο διακομιστής (`requirePropertyInTenantScope` με `intent:'write'`
 * ⇒ 409 `ENTITY_RETIRED`) και οι κανόνες αρχείων (`parentPropertyIsLive`). Εδώ ζει μόνο το «μην προσφέρεις
 * κουμπί που θα αρνηθεί ο διακομιστής».
 *
 * @module lib/firestore/retired-record-context
 * @enterprise ADR-281 — SSOT Soft-Delete System · ADR-329 §3.9
 */

import React, { createContext, useContext } from 'react';

import { retiredKindOf, type MaybeTrashed, type RetiredKind } from './trashed-status';

/** Έξω από provider η απάντηση είναι «ζωντανή εγγραφή»: καμία οθόνη δεν κλειδώνει επειδή ξέχασε να τυλιχτεί. */
const RetiredRecordContext = createContext<RetiredKind | null>(null);

interface RetiredRecordProviderProps {
  /** Η εγγραφή που δείχνει το υποδέντρο. Η απόσυρση **παράγεται** από αυτήν — ποτέ δεύτερη σημαία. */
  readonly record: MaybeTrashed | null | undefined;
  readonly children: React.ReactNode;
}

export function RetiredRecordProvider({ record, children }: RetiredRecordProviderProps): React.ReactElement {
  return (
    <RetiredRecordContext.Provider value={retiredKindOf(record)}>
      {children}
    </RetiredRecordContext.Provider>
  );
}

/** Σε ποια απόσυρση είναι η εγγραφή του υποδέντρου — `null` για ζωντανή (ή εκτός provider). */
export function useRetiredKind(): RetiredKind | null {
  return useContext(RetiredRecordContext);
}
