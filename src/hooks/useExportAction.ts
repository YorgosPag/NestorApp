'use client';

/**
 * @fileoverview **Η κατάσταση μιας εξαγωγής αρχείου** — `idle` · `busy` · `failed`, για **κάθε** κουμπί που γράφει αρχείο
 * στον δίσκο του ανθρώπου: XLSX των καρτελών κτιρίου (ADR-898 Φ4β) · PDF πληροφοριακού υπολογισμού (ADR-947 Φ2β). Μία
 * μηχανή, όχι μία ανά οθόνη.
 * @related `components/building-management/shared/SpaceExportButton.tsx` · `components/objective-value/ObjectiveValuePdfButton.tsx`
 * @module hooks/useExportAction
 *
 * 🔑 **Ποτέ σιωπηλό κλικ**: όσο γράφεται το αρχείο το κουμπί λέει ότι δουλεύει και δεν ξαναπατιέται (δεύτερο κλικ =
 *   δεύτερο αρχείο στον δίσκο)· σε αποτυχία μένει **λόγος** στην οθόνη και καταγραφή στο log.
 * 🔑 Προάχθηκε από τις καρτέλες κτιρίου όταν ήρθε ο δεύτερος καταναλωτής (N.0.2) — ίδια συμπεριφορά, γενική θέση.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useExportAction');

export type ExportStatus = 'idle' | 'busy' | 'failed';

export interface ExportAction {
  readonly status: ExportStatus;
  readonly trigger: () => void;
}

/** @param run η εξαγωγή — διαβάζεται τη στιγμή του κλικ, άρα εξάγει ό,τι δείχνει η οθόνη **τότε**. */
export function useExportAction(run: () => Promise<void>): ExportAction {
  const [status, setStatus] = useState<ExportStatus>('idle');
  const busy = useRef(false);
  const mounted = useRef(true);
  const latestRun = useRef(run);
  latestRun.current = run;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const trigger = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    setStatus('busy');
    latestRun.current()
      .then(() => {
        if (mounted.current) setStatus('idle');
      })
      .catch((cause: unknown) => {
        logger.warn('Η εξαγωγή αρχείου απέτυχε', { error: cause instanceof Error ? cause.message : String(cause) });
        if (mounted.current) setStatus('failed');
      })
      .finally(() => {
        busy.current = false;
      });
  }, []);

  return { status, trigger };
}
