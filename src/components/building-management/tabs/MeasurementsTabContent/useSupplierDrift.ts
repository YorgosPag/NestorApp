/**
 * useSupplierDrift — νέα απάντηση του προμηθευτή για δεμένες γραμμές (ADR-923 §5.12 Δ9).
 *
 * Ο ίδιος δρόμος για τη μία γραμμή της φόρμας και για όλο το κτίριο. Ξαναρωτά όταν αλλάξει το κλειδί, δηλαδή όταν αλλάξει γραμμή ή
 * εφαρμοστεί νέα τιμή. Αποτυχία ⇒ καμία ένδειξη: το στιγμιότυπο μένει όπως είναι, και μια βλάβη δικτύου δεν είναι απόκλιση.
 *
 * @module components/building-management/tabs/MeasurementsTabContent/useSupplierDrift
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import { reviewSupplierLines } from '@/services/catalog/supply-api.client';
import type { BoqSupplierDriftRow } from '@/subapps/catalog/types/supply-boq';

const logger = createModuleLogger('useSupplierDrift');
const NO_ROWS: readonly BoqSupplierDriftRow[] = [];

export interface SupplierDriftApi {
  readonly rows: readonly BoqSupplierDriftRow[];
  /** Ρητή νέα ερώτηση: η τιμή κινήθηκε ανάμεσα στον έλεγχο και την εφαρμογή. */
  readonly recheck: () => void;
}

export function useSupplierDrift(ids: readonly string[], key: string): SupplierDriftApi {
  const [rows, setRows] = useState<readonly BoqSupplierDriftRow[]>(NO_ROWS);
  const [round, setRound] = useState(0);
  const recheck = useCallback(() => setRound((current) => current + 1), []);
  const latestIds = useRef(ids);
  latestIds.current = ids;

  useEffect(() => {
    if (key === '') {
      setRows(NO_ROWS);
      return undefined;
    }
    let current = true;
    reviewSupplierLines(latestIds.current)
      .then((next) => { if (current) setRows(next); })
      .catch((error: unknown) => { logger.warn('Supplier drift review failed', { error }); });
    return () => { current = false; };
  }, [key, round]);

  return { rows, recheck };
}
