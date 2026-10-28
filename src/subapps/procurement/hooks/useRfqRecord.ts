'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RFQ } from '../types/rfq';

interface UseRfqRecordResult {
  rfq: RFQ | null;
  /** Το όνομα του έργου του RFQ, για τον υπότιτλο της κεφαλίδας· `null` όσο δεν είναι γνωστό. */
  projectName: string | null;
  /** Αντικατάσταση μετά από αποθήκευση (π.χ. ρύθμιση RFQ) — χωρίς δεύτερο αίτημα. */
  setRfq: (rfq: RFQ | null) => void;
  refetch: () => Promise<void>;
}

/**
 * **Η εγγραφή ΕΝΟΣ RFQ** (+ το όνομα του έργου του) για τη σελίδα λεπτομερειών (ADR-327).
 *
 * Ήταν inline στο `RfqDetailClient`· εξήχθη ώστε η φόρτωση να έχει **έναν** ιδιοκτήτη.
 * 🔑 Αριθμός αιτήματος: απάντηση που έρχεται **μετά** από νεότερο αίτημα (γρήγορο `refetch` μετά από
 * ανάθεση/αλλαγή κατάστασης) απορρίπτεται — ποτέ παλιό RFQ πάνω από νεότερο.
 * Αποτυχία ⇒ σιωπηλά: η σελίδα αποδίδεται με τον εναλλακτικό τίτλο και χωρίς υπότιτλο έργου.
 */
export function useRfqRecord(rfqId: string): UseRfqRecordResult {
  const [rfq, setRfq] = useState<RFQ | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const refetch = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const res = await fetch(`/api/rfqs/${rfqId}`);
      if (!res.ok || seq !== requestSeq.current) return;
      const json = await res.json();
      const rfqData = (json?.data ?? null) as RFQ | null;
      if (seq !== requestSeq.current) return;
      setRfq(rfqData);
      if (!rfqData?.projectId) return;
      const pRes = await fetch(`/api/projects/${rfqData.projectId}`).catch(() => null);
      if (!pRes?.ok) return;
      const pJson = await pRes.json().catch(() => ({}));
      if (seq === requestSeq.current) setProjectName((pJson?.data?.name as string | undefined) ?? null);
    } catch {
      // silent — page renders without project name subtitle
    }
  }, [rfqId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { rfq, projectName, setRfq, refetch };
}
