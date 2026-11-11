/**
 * usePaymentConfirmationWatch — όσο περιμένουμε επιβεβαίωση online πληρωμής, ξαναδιαβάζει σιωπηλά την όψη
 * (ADR-ACC-030 §5). Η επιβεβαίωση έρχεται από το webhook του παρόχου στον διακομιστή· η σελίδα απλώς ρωτά.
 *
 * Ρυθμός: κάθε 3″ το πρώτο λεπτό (η συνήθης επιβεβαίωση), μετά κάθε 15″, και σταματά στα 15′ (η συμφιλίωση του
 * διακομιστή συνεχίζει μόνη της). Σταματά αμέσως μόλις η όψη πει «εξοφλήθηκε» (`active = false`).
 *
 * @module components/shared/pages/invoice-payment/usePaymentConfirmationWatch
 */

'use client';

import { useEffect, useState } from 'react';

const FAST_INTERVAL_MS = 3_000;
const SLOW_INTERVAL_MS = 15_000;
const FAST_PHASE_MS = 60_000;
const GIVE_UP_MS = 15 * 60_000;

/** `slow` ⇒ η επιβεβαίωση αργεί πέρα από τη φάση των λίγων δευτερολέπτων (μήνυμα «μην πληρώσετε ξανά»). */
export function usePaymentConfirmationWatch(active: boolean, refresh: () => Promise<void>): { readonly slow: boolean } {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!active) return undefined;
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const tick = async () => {
      const elapsed = Date.now() - startedAt;
      if (cancelled || elapsed > GIVE_UP_MS) return;
      setSlow(elapsed > FAST_PHASE_MS);
      await refresh();
      if (!cancelled) timer = setTimeout(tick, elapsed > FAST_PHASE_MS ? SLOW_INTERVAL_MS : FAST_INTERVAL_MS);
    };
    timer = setTimeout(tick, FAST_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [active, refresh]);

  return { slow };
}
