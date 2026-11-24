'use client';

/**
 * @fileoverview **Η ΤΙΜΗ ΤΟΥ ΕΓΓΡΑΦΟΥ, ΟΠΩΣ ΤΗ ΒΛΕΠΕΙ Ο ΑΝΘΡΩΠΟΣ** — μία προβολή για πίνακα **και** «Συμπλήρωση κενών»
 * (ADR-950 §8.12 · §8.14).
 * @module components/contacts/document-evidence/ContactEvidenceDocumentValue
 *
 * 🔴 2026-11-24 (ζωντανός έλεγχος): ο πίνακας έδειχνε το τηλέφωνο «231 055 9595» + «Τυπωμένο: 2310 55.95.95», ο διάλογος
 *    «2310 55.95.95» — **δύο** μορφές της ίδιας τιμής, επειδή η προβολή ζούσε **μέσα** στον πίνακα και ο διάλογος έγραφε τη
 *    δική του (`documentPrinted ?? documentDisplay`). Τώρα ζει εδώ, μία φορά· όποιος δείχνει γειωμένη τιμή την καλεί.
 *
 * Κανόνες (γειωμένη γραμμή):
 * - διορθωμένη οδός ⇒ «Μήπως {οδός}» + «Τυπωμένο: …»·
 * - τηλέφωνο ⇒ τυπική μορφή (libphonenumber) + «Τυπωμένο: …» — ποτέ οι τελείες της κάρτας, ποτέ το E.164 της φόρμας·
 * - αλλιώς ⇒ όπως **τυπώνεται** (όχι η μορφή της φόρμας: E.164 · κωδικός ΔΟΥ).
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { EvidenceRow } from '@/lib/contacts/contact-evidence-comparison';
import { readablePhone } from '@/lib/contact/channel-phone';

import { CONTACT_EVIDENCE_CORROBORATION_KEYS as CORROBORATION } from './contact-evidence-labels';

/** Η κανονική μορφή + «Τυπωμένο: …» από κάτω. Ίδιο ⇒ μία γραμμή. */
function WithPrinted({ main, printed }: { readonly main: string; readonly printed: string | null }) {
  const { t } = useTranslation('contacts-form');
  return (
    <span className="flex flex-col">
      <span>{main}</span>
      {printed !== null && printed !== main && (
        <span className="text-xs text-muted-foreground">{t(CORROBORATION.printed, { value: printed })}</span>
      )}
    </span>
  );
}

/** **Η γειωμένη τιμή μιας γραμμής** (`row.ungrounded === null`). Ο καλών χειρίζεται τη μη γειωμένη (λόγος + εναλλακτική). */
export function GroundedEvidenceValue({ row }: { readonly row: EvidenceRow }) {
  const { t } = useTranslation('contacts-form');
  if (row.correctedFrom !== null) {
    return <WithPrinted main={t(CORROBORATION.correctedStreet, { street: row.documentDisplay ?? '' })} printed={row.documentPrinted} />;
  }
  const phone = row.key === 'phone' && row.documentDisplay !== null ? readablePhone(row.documentDisplay) : null;
  if (phone !== null) return <WithPrinted main={phone} printed={row.documentPrinted} />;
  return <>{row.documentPrinted ?? row.documentDisplay}</>;
}
