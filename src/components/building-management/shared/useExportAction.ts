'use client';

/**
 * @fileoverview **Η κατάσταση μιας εξαγωγής** (ADR-898 Φ4β) — `idle` · `busy` · `failed`, για **κάθε** κουμπί εξαγωγής των
 * καρτελών κτιρίου (Μονάδες · Αποθήκες · Στάθμευση · Αντικειμενική). Μία μηχανή, όχι μία ανά καρτέλα.
 * @related `SpaceExportButton.tsx` (η παρουσίαση) · `useSpaceTableExport.ts`
 * @module components/building-management/shared/useExportAction
 *
 * 🔑 **Ποτέ σιωπηλό κλικ**: όσο γράφεται το αρχείο το κουμπί λέει «Εξαγωγή…» και δεν ξαναπατιέται (δεύτερο κλικ = δεύτερο
 *   αρχείο στον δίσκο)· σε αποτυχία μένει **λόγος** στην οθόνη και καταγραφή στο log.
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
        logger.warn('Η εξαγωγή XLSX απέτυχε', { error: cause instanceof Error ? cause.message : String(cause) });
        if (mounted.current) setStatus('failed');
      })
      .finally(() => {
        busy.current = false;
      });
  }, []);

  return { status, trigger };
}
