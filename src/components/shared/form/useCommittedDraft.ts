'use client';

/**
 * **Το πρόχειρο κείμενο ενός πεδίου που εκπέμπει όταν ο άνθρωπος ΤΕΛΕΙΩΣΕΙ** (blur), όχι σε κάθε πλήκτρο.
 *
 * @related `components/shared/common-charges/CommonChargesFields.tsx` (ποσό κοινοχρήστων) ·
 *   `components/shared/energy-certificate/EnergyCertificateFields.tsx` (kWh · CO₂)
 *
 * 🔑 **Γιατί όχι `onChange` ανά πλήκτρο**: το «12» καθ' οδόν προς το «120» δεν είναι απάντηση — και εκεί που κάθε
 * απάντηση αποθηκεύεται αμέσως («Βελτίωσε την αγγελία σου») θα έγραφε τρεις φορές, με τρεις γραμμές ιστορικού.
 *
 * 🔑 **Εκπέμπει ΜΟΝΟ έγκυρη, διαφορετική τιμή.** Άκυρο πρόχειρο μένει στο πεδίο με σήμανση· η αποθηκευμένη αλήθεια
 * δεν αλλάζει, και δεν «διορθώνεται» σιωπηλά σε κάτι που ο άνθρωπος δεν έγραψε.
 *
 * Εξήχθη στον **δεύτερο** καταναλωτή (ADR-777 §8.94): το ίδιο σώμα υπήρχε μέσα στα πεδία των κοινοχρήστων (N.18).
 */

import { useEffect, useState } from 'react';

/** Τι διάβασε ο αναλυτής από το πρόχειρο: τιμή (ή «τίποτα δηλωμένο»), ή άκυρο. */
export type DraftReading<Value> = { readonly ok: true; readonly value: Value | null } | { readonly ok: false };

export interface CommittedDraft {
  readonly draft: string;
  readonly setDraft: (draft: string) => void;
  readonly invalid: boolean;
  /** Κάλεσέ το στο blur. */
  readonly commit: () => void;
}

/**
 * @param value η αποθηκευμένη αλήθεια — όταν αλλάξει απ' έξω (listener · επαναφορά φόρμας), το πεδίο την ακολουθεί
 * @param toDraft **σταθερή** συνάρτηση (επίπεδο module): η αλήθεια ως κείμενο πεδίου
 * @param parse **σταθερή** συνάρτηση: το κείμενο ως τιμή, `null` για κενό, ή άκυρο
 */
export function useCommittedDraft<Value>(
  value: Value | null,
  toDraft: (value: Value | null) => string,
  parse: (draft: string) => DraftReading<Value>,
  onCommit: (value: Value | null) => void,
): CommittedDraft {
  const [draft, setDraft] = useState(() => toDraft(value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setDraft(toDraft(value));
    setInvalid(false);
  }, [value, toDraft]);

  const commit = () => {
    const reading = parse(draft);
    setInvalid(!reading.ok);
    if (reading.ok && reading.value !== value) onCommit(reading.value);
  };

  return { draft, setDraft, invalid, commit };
}
