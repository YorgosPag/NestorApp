'use client';

/**
 * @fileoverview **Νέες τιμές άξονα από τον έλεγχο** (ADR-923 §5.5.2 Β7): η κλήση, η κατάσταση αποθήκευσης και ο λόγος άρνησης. Η
 *   απάντηση είναι **όλη** η όψη (ξανασχεδιασμένη πρόταση), όπως στην απόφαση γραμμής· η οθόνη δεν μαντεύει ευρήματα.
 * @module components/catalog/imports/use-axis-options
 */

import { useCallback, useState } from 'react';

import { addImportAxisOptions } from '@/services/catalog/catalog-import-api.client';
import { catalogFailureOf, type CatalogFailure } from '@/services/catalog/catalog-failure';
import type { AddImportAxisOptionsRequest, ImportBatchDetailView } from '@/subapps/catalog/types/catalog-import-requests';
import type { ImportLineRefusal } from '@/subapps/catalog/vocabulary/catalog-import';

export interface AxisOptionsState {
  readonly saving: boolean;
  readonly refusal: ImportLineRefusal | null;
  /** `true` = γράφτηκαν και δέθηκαν· `false` = άρνηση ή αποτυχία (η αιτία στο `refusal` ή στην αποτυχία της παρτίδας). */
  readonly add: (request: AddImportAxisOptionsRequest) => Promise<boolean>;
  readonly clearRefusal: () => void;
  /** Ο ΕΝΑΣ ειδοποιητής της σελίδας, για την τεμπέλικη επιφάνεια (φόρτωση βιβλιοθήκης). */
  readonly reportFailure: (failure: CatalogFailure) => void;
}

export function useAxisOptions(
  batchId: string | null,
  accept: (view: ImportBatchDetailView) => void,
  setFailure: (failure: CatalogFailure | null) => void,
): AxisOptionsState {
  const [saving, setSaving] = useState(false);
  const [refusal, setRefusal] = useState<ImportLineRefusal | null>(null);
  const add = useCallback(async (request: AddImportAxisOptionsRequest): Promise<boolean> => {
    if (batchId === null) return false;
    setSaving(true);
    setRefusal(null);
    try {
      const result = await addImportAxisOptions(batchId, request);
      accept(result.view);
      if (result.outcome.kind === 'refused') setRefusal(result.outcome.reason);
      return result.outcome.kind === 'settled';
    } catch (cause) {
      setFailure(catalogFailureOf(cause));
      return false;
    } finally {
      setSaving(false);
    }
  }, [accept, batchId, setFailure]);
  const clearRefusal = useCallback(() => setRefusal(null), []);
  return { saving, refusal, add, clearRefusal, reportFailure: setFailure };
}
