'use client';

/**
 * @fileoverview **ΟΤΑΝ Ο ΣΥΝΔΕΣΜΟΣ ΔΕΝ ΣΤΕΚΕΙ** — έξι λόγοι, έξι διαφορετικά μηνύματα.
 * @related ADR-777 §8.33 · services/mandate/mandate-consent.service.ts
 * @module components/mandate/MandateConsentRefusal
 *
 * 🔴 **Ένα κοινό «κάτι πήγε στραβά» θα ήταν ΧΕΙΡΟΤΕΡΟ από σιωπή.** Ο άνθρωπος απέναντι
 * έχει **διαφορετική επόμενη κίνηση** σε κάθε περίπτωση: να ζητήσει νέο σύνδεσμο
 * (έληξε) · να ανοίξει το πιο πρόσφατο email (αντικαταστάθηκε) · να μην κάνει τίποτα
 * (η αγγελία δεν υπάρχει πια) · να υποψιαστεί (άκυρος). Ένα μήνυμα για τα τέσσερα
 * τον στέλνει να ρωτήσει τον μεσίτη — δηλαδή μεταθέτει σε άνθρωπο δουλειά που ήξερε
 * να κάνει η οθόνη.
 *
 * ⚠️ Ο λόγος **έρχεται ως κωδικός** από τον διακομιστή και γίνεται κλειδί i18n (N.11).
 * Καμία ελληνική συμβολοσειρά εδώ.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ConsentRejection } from '@/services/mandate/mandate-consent.service';

const NS = 'property-market';
const K = `${NS}:mandate.consent`;

export function MandateConsentRefusal({
  reason,
}: {
  reason: ConsentRejection;
}): React.ReactElement {
  const { t } = useTranslation([NS]);

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-lg border border-border bg-card p-6">
      <h1 className="text-lg font-semibold text-card-foreground">{t(`${K}.title`)}</h1>
      <p role="alert" className="text-sm text-muted-foreground">
        {t(`${K}.reason.${reason}`)}
      </p>
    </section>
  );
}
