'use client';

/**
 * Το κλείδωμα ποσότητας/μονάδας ενός RFQ (ADR-327 §8.5 Β) — optimistic, με επαναφορά.
 *
 * - **Optimistic**: ο διακόπτης αλλάζει αμέσως (Gmail-style)· το `PATCH` ακολουθεί.
 * - **Τελευταίος κερδίζει**: κάθε αλλαγή στέλνει ΟΛΟ το αντικείμενο· απάντηση παλαιότερου αιτήματος αγνοείται.
 * - **Επαναφορά**: σε σφάλμα γυρνά στην τελευταία τιμή που **επιβεβαίωσε** ο server — ποτέ σε ενδιάμεση.
 * - **Ένας ιδιοκτήτης**: ο γονέας παίρνει το ενημερωμένο RFQ (`onSaved`) ώστε η επόμενη τοποθέτηση να μη διαβάσει μπαγιάτικη τιμή.
 *
 * @module subapps/procurement/hooks/useRfqResponseLock
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type { RFQ, RfqResponseLock } from '../types/rfq';
import { resolveResponseLock } from '../utils/rfq-response-lock';

export interface RfqResponseLockState {
  lock: RfqResponseLock;
  saving: boolean;
  setLock: (patch: Partial<RfqResponseLock>) => Promise<void>;
}

export function useRfqResponseLock(
  rfq: Pick<RFQ, 'id' | 'responseLock'>,
  onSaved: (rfq: RFQ) => void,
  onError: (error: unknown) => void,
): RfqResponseLockState {
  const [lock, setLockState] = useState<RfqResponseLock>(() => resolveResponseLock(rfq));
  const [saving, setSaving] = useState(false);
  const confirmed = useRef<RfqResponseLock>(lock);
  const latest = useRef(0);

  // Ο γονέας ξαναφόρτωσε το RFQ (π.χ. μετά από ανάθεση) — η επιβεβαιωμένη τιμή είναι η δική του.
  useEffect(() => {
    const fromServer = resolveResponseLock(rfq);
    confirmed.current = fromServer;
    setLockState(fromServer);
  }, [rfq]);

  const setLock = useCallback(async (patch: Partial<RfqResponseLock>) => {
    const next = { ...lock, ...patch };
    const seq = ++latest.current;
    setLockState(next);
    setSaving(true);
    try {
      const saved = await apiClient.patch<RFQ>(API_ROUTES.RFQS.BY_ID(rfq.id), { responseLock: next });
      if (seq !== latest.current) return;
      confirmed.current = resolveResponseLock(saved);
      onSaved(saved);
    } catch (error) {
      if (seq !== latest.current) return;
      setLockState(confirmed.current);
      onError(error);
    } finally {
      if (seq === latest.current) setSaving(false);
    }
  }, [lock, rfq.id, onSaved, onError]);

  return { lock, saving, setLock };
}
