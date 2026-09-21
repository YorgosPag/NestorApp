'use client';

/**
 * @fileoverview **«ΚΑΤΙ ΠΗΓΕ ΣΤΡΑΒΑ — ΔΟΚΙΜΑΣΤΕ ΞΑΝΑ»** — μία γραφή, δύο οθόνες (ADR-867 Β9γ).
 * @related `NetworkThreadDirectoryBody` · `NetworkThreadScreen`
 * @module components/network-messaging/NetworkFailureNotice
 *
 * 🔑 **ΓΕΝΝΗΘΗΚΕ ΑΠΟ ΤΗΝ ΠΥΛΗ, ΜΕΣΑ ΣΤΟ ΙΔΙΟ COMMIT**: γράφοντας την οθόνη της συνομιλίας
 * αντέγραψα το μπλοκ βλάβης του καταλόγου. Το **CHECK 3.28** το ονόμασε (*9 γραμμές / 72 tokens*)
 * **πριν** μπει στο δέντρο — ακριβώς η περίπτωση που περιγράφει ο N.18: «κεντρικοποιείς το Α,
 * γράφεις Β ως δίδυμο». Ένα από τα δύο θα μάθαινε κάτι που το άλλο δεν θα μάθαινε.
 *
 * ⚠️ **Ο κωδικός μεταφράζεται ΕΔΩ, μία φορά**: το `NetworkFailure` είναι κλειστό σύνολο και ο
 * πίνακας `FAILURE_KEYS` το καλύπτει ολόκληρο — νέα τιμή χωρίς γραμμή **δεν μεταγλωττίζεται**.
 * ⚠️ **Καμία γεωμετρία**: το μήνυμα δεν ξέρει πού ζει (CHECK 3.63).
 */

import * as React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { NetworkFailure } from '@/services/network-messaging/network-thread.client';

import { DIRECTORY_KEYS, FAILURE_KEYS, NETWORK_NS } from './network-messaging-keys';

export interface NetworkFailureNoticeProps {
  readonly failure: NetworkFailure;
  readonly onRetry: () => void;
}

export function NetworkFailureNotice({ failure, onRetry }: NetworkFailureNoticeProps): React.ReactElement {
  const { t } = useTranslation([NETWORK_NS]);

  return (
    <section role="alert" className="flex flex-col items-start gap-2">
      <p className="m-0 text-sm text-destructive">{t(FAILURE_KEYS[failure])}</p>
      <button type="button" onClick={onRetry} className="text-sm font-medium text-foreground underline underline-offset-4">
        {t(DIRECTORY_KEYS.retry)}
      </button>
    </section>
  );
}
