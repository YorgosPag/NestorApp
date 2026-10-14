'use client';

/**
 * @fileoverview **«Συμπλήρωση από ΠΕΑ»** (ADR-777 §8.96) — ανέβασμα → ανάγνωση στον server → προεπισκόπηση.
 * @related `./useEnergyCertificateImportPorts.ts` (πού ανεβαίνει, ανά κάτοχο) ·
 *   `components/shared/energy-certificate/EnergyCertificateImport.tsx` (η οθόνη) ·
 *   `app/api/{properties,owner-properties}/[id]/energy-certificate-import` (η ανάγνωση)
 * @module hooks/energy-certificate/useEnergyCertificateImport
 *
 * 🔑 **Ένα κουμπί, μία πράξη για τον άνθρωπο** (ίδιο σχήμα με το ΠΚΑ, ADR-900 §3.8): το PDF ανεβαίνει από τον
 * κανονικό αγωγό στα «Έγγραφα» του ακινήτου και αμέσως διαβάζεται. Τίποτα δεν γράφεται στο μπλοκ εδώ — η πρόταση
 * περιμένει τον άνθρωπο.
 * ⚠️ **Μηδέν αγώνας δρόμου**: δεύτερο ανέβασμα πριν απαντήσει το πρώτο ⇒ μετρά ΜΟΝΟ το τελευταίο (μετρητής αιτήματος).
 * ⚠️ Το αίτημα περνά από τον `apiClient` (Idempotency-Key, CHECK 3.92).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { apiErrorBodyOf } from '@/lib/api/api-client-types';
import { apiClient } from '@/lib/api/enterprise-api-client';
import {
  isPeaImportRefusal,
  type EnergyCertificateImportPort,
  type PeaImportRefusal,
} from '@/lib/energy-certificate/pea-import-outcome';
import type { PeaProposal } from '@/lib/energy-certificate/pea-proposal';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useEnergyCertificateImport');

export type PeaImportErrorCode = PeaImportRefusal | 'UPLOAD_FAILED' | 'UNAVAILABLE';

export type EnergyCertificateImportState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'uploading' }
  | { readonly kind: 'reading' }
  | { readonly kind: 'review'; readonly proposal: PeaProposal }
  | { readonly kind: 'failed'; readonly code: PeaImportErrorCode };

export interface EnergyCertificateImportApi {
  readonly state: EnergyCertificateImportState;
  readonly start: (file: File) => Promise<void>;
  readonly dismiss: () => void;
}

function readFailureOf(error: unknown): PeaImportErrorCode {
  const code = apiErrorBodyOf(error)?.error;
  return isPeaImportRefusal(code) ? code : 'UNAVAILABLE';
}

export function useEnergyCertificateImport(port: EnergyCertificateImportPort | null): EnergyCertificateImportApi {
  const [state, setState] = useState<EnergyCertificateImportState>({ kind: 'idle' });
  const latest = useRef(0);
  useEffect(() => () => void (latest.current += 1), []);

  const start = useCallback(
    async (file: File): Promise<void> => {
      if (port === null) return;
      const request = (latest.current += 1);
      const settle = (next: EnergyCertificateImportState) => request === latest.current && setState(next);
      settle({ kind: 'uploading' });
      let fileId: string;
      try {
        fileId = await port.upload(file);
      } catch (error) {
        logger.warn('Το ΠΕΑ δεν ανέβηκε', { error: String(error) });
        return void settle({ kind: 'failed', code: 'UPLOAD_FAILED' });
      }
      settle({ kind: 'reading' });
      try {
        const body = await apiClient.post<{ proposal: PeaProposal }>(port.endpoint, { fileId });
        settle({ kind: 'review', proposal: body.proposal });
      } catch (error) {
        logger.warn('Το ΠΕΑ δεν διαβάστηκε', { fileId, error: String(error) });
        settle({ kind: 'failed', code: readFailureOf(error) });
      }
    },
    [port],
  );

  const dismiss = useCallback(() => {
    latest.current += 1;
    setState({ kind: 'idle' });
  }, []);

  return { state, start, dismiss };
}
