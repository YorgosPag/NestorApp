'use client';

/**
 * @fileoverview **Η σελίδα «Εισαγωγή»** (ADR-923 §5.5): οι παρτίδες του χώρου, νέα εισαγωγή, και η επιλεγμένη παρτίδα στη
 *   διεύθυνση (`?batch=<id>`), ώστε ο σύνδεσμος να ανοίγει ακριβώς τον έλεγχο που μένει.
 * @module components/catalog/imports/ImportsContent
 */

import React, { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { fetchImportBatches } from '@/services/catalog/catalog-import-api.client';
import type { ImportBatchWire } from '@/subapps/catalog/types/catalog-import-requests';
import { CatalogPageFrame } from '../shared/CatalogPageFrame';
import { useCatalogSelection } from '../shared/use-catalog-selection';
import { ImportBatchWorkspace } from './ImportBatchWorkspace';
import { BATCH_STATUS_KEYS, useImportText } from './import-text';
import { NewImportPanel } from './NewImportPanel';

// 🔴 ADR-744 §18 — ούτε το `catalog` ούτε το `catalog-import` είναι στο κέλυφος: χωρίς το slice, ωμά κλειδιά στο πρώτο καρέ.
import routeSlice from '@/i18n/generated/routes/o__workspace__catalog__imports.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

type LoadState = 'loading' | 'failed' | 'ready';

function useBatches() {
  const [batches, setBatches] = useState<readonly ImportBatchWire[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const reload = useCallback(async () => {
    try {
      setBatches(await fetchImportBatches());
      setState('ready');
    } catch {
      setState('failed');
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { batches, state, reload };
}

export function ImportsContent() {
  const { t } = useImportText();
  const { batches, state, reload } = useBatches();
  const selection = useCatalogSelection('batch');
  const [creating, setCreating] = useState(false);
  const open = (id: string) => {
    setCreating(false);
    selection.select(id);
    void reload();
  };
  return (
    <CatalogPageFrame
      title={t('page.title')}
      lead={t('page.lead')}
      state={state}
      actions={<Button type="button" onClick={() => { selection.select(null); setCreating(true); }}>{t('page.new')}</Button>}
    >
      {creating ? <NewImportPanel onReady={open} /> : null}
      {selection.selected ? <ImportBatchWorkspace batchId={selection.selected} /> : null}
      {!creating && !selection.selected ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {batches.length === 0 ? <li className="text-muted-foreground">{t('page.empty')}</li> : null}
          {batches.map((batch) => (
            <li key={batch.id}>
              <button type="button" className="flex w-full items-center justify-between gap-2 rounded-md border border-border p-2 text-left hover:bg-accent" onClick={() => open(batch.id)}>
                <span className="truncate">{batch.fileName}</span>
                <span className="text-sm text-muted-foreground">{t(BATCH_STATUS_KEYS[batch.status])}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </CatalogPageFrame>
  );
}
