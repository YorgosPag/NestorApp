'use client';

/**
 * ADR-915 §20 — «Ανάγνωση από το έγγραφο» στον διάλογο ελέγχου: η κατάσταση **ενός** αιτήματος ανάγνωσης.
 *
 * 🔑 **Καμία παλιά απάντηση πάνω σε νεότερη**: κάθε αίτημα παίρνει αριθμό· απάντηση που φτάνει αφού ο άνθρωπος ζήτησε
 *   ξανά (ή έκλεισε τον διάλογο) αγνοείται. Το `useRef` κρατά τον τρέχοντα αριθμό χωρίς επανασχεδίαση.
 * 🔑 Η όψη της υπόθεσης **δεν** ξαναφορτώνεται από εδώ: η εγγραφή των γεγονότων είναι εγγραφή αρχείου ⇒ το CDC σημαίνει
 *   την όψη (ADR-905 §6). Ο διάλογος δείχνει αμέσως ό,τι διαβάστηκε από την ίδια την απάντηση.
 *
 * @module hooks/useCaseDocumentText
 */

import { useCallback, useRef, useState } from 'react';
import type { CaseDocumentTextResult } from '@/lib/conveyance/case-document-text';
import { readCaseDocumentTextRequest } from '@/services/conveyance/conveyance-case-gateway';

export type CaseDocumentTextState =
  | { readonly status: 'idle' }
  | { readonly status: 'reading' }
  | { readonly status: 'done'; readonly result: CaseDocumentTextResult }
  | { readonly status: 'failed' };

const IDLE: CaseDocumentTextState = { status: 'idle' };

export function useCaseDocumentText(caseId: string) {
  const [state, setState] = useState<CaseDocumentTextState>(IDLE);
  const latest = useRef(0);

  const read = useCallback(async (itemId: string, fileId: string): Promise<CaseDocumentTextResult | null> => {
    const ticket = ++latest.current;
    setState({ status: 'reading' });
    try {
      const { result } = await readCaseDocumentTextRequest(caseId, itemId, fileId);
      if (ticket === latest.current) setState({ status: 'done', result });
      return ticket === latest.current ? result : null;
    } catch {
      if (ticket === latest.current) setState({ status: 'failed' });
      return null;
    }
  }, [caseId]);

  return { state, read };
}
