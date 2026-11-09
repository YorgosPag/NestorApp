'use client';

/**
 * @fileoverview **Η μνήμη ετικετών ενός προμηθευτή** (ADR-923 §5.5.2 Β5.2): ό,τι έμαθαν οι εγκρίσεις —ετικέτα γραμμής → απόφαση, με
 *   πόσες εγκρίσεις τη στήριξαν— με «Ξέχνα» ανά ετικέτα και «Άδειασμα μνήμης» (Akeneo SDM: διαγραφή μίας, άδειασμα όλων).
 * @module components/catalog/imports/LabelMemoryPanel
 *
 * 🔑 **Ανεξάρτητο από παρτίδα** (μόνο `supplierContactId`): μπαίνει και αλλού (π.χ. καρτέλα επαφής) χωρίς δεύτερο αντίγραφο.
 * 🔑 Η διαγραφή είναι **αισιόδοξη** με επαναφορά σε αποτυχία· το άδειασμα ζητά επιβεβαίωση **μέσα** στον διάλογο, ποτέ `window.confirm`.
 * 🔑 Σύγκρουση (δύο αποφάσεις) και «ανενεργή» (ιδιότητα που δεν υπάρχει πια) φαίνονται με λέξη· τίποτα δεν εξαφανίζεται σιωπηλά.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { catalogFailureOf, type CatalogFailure } from '@/services/catalog/catalog-failure';
import { clearLabelMemory, deleteLabelMemory, fetchLabelMemory } from '@/services/catalog/catalog-import-api.client';
import type { ImportLabelMemoryWire, LabelMemoryListView } from '@/subapps/catalog/types/catalog-import-requests';
import { IMPORT_LABEL_MEMORY_LIST_LIMIT } from '@/subapps/catalog/vocabulary/catalog-import';
import { useImportText } from './import-text';
import { useLineDecisionText, type LineDecisionText } from './line-decision-text';
import type { LabelMemoryPanelProps } from './supplier-field-props';

function MemoryEntry({ entry, text, disabled, onForget }: { readonly entry: ImportLabelMemoryWire; readonly text: LineDecisionText; readonly disabled: boolean; readonly onForget: () => void }) {
  const { t } = useImportText();
  const inactive = entry.decisions.some(({ decision }) => !text.known(decision));
  return (
    <li className="flex flex-col gap-1 rounded-md border border-border p-2">
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{entry.printedLabel} · {entry.unitCode ?? t('memory.noUnit')}</span>
        <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={onForget}><Trash2 className="mr-1 h-3 w-3" aria-hidden />{t('memory.forget')}</Button>
      </span>
      <ul className="m-0 list-none p-0 text-xs text-muted-foreground">
        {entry.decisions.map((item) => <li key={JSON.stringify(item.decision)}>{t('review.memory.option', { decision: text.of(item.decision), count: item.count })}</li>)}
      </ul>
      <span className="flex flex-wrap gap-1">
        {entry.decisions.length > 1 ? <Badge variant="warning">{t('memory.conflict')}</Badge> : null}
        {inactive ? <Badge variant="muted">{t('memory.inactive')}</Badge> : null}
      </span>
    </li>
  );
}

function useMemoryList(supplierContactId: string, notify: (failure: CatalogFailure) => void) {
  const [list, setList] = useState<LabelMemoryListView | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    fetchLabelMemory(supplierContactId).then((view) => { if (live) setList(view); }).catch((cause) => notify(catalogFailureOf(cause)));
    return () => { live = false; };
  }, [notify, supplierContactId]);
  const forget = useCallback(async (entry: ImportLabelMemoryWire) => {
    setList((current) => current && { ...current, entries: current.entries.filter((item) => item.id !== entry.id) });
    try {
      await deleteLabelMemory(entry.id, entry.revision);
    } catch (cause) {
      setList((current) => current && { ...current, entries: [...current.entries, entry] });
      notify(catalogFailureOf(cause));
    }
  }, [notify]);
  const clear = useCallback(async (): Promise<number | null> => {
    setBusy(true);
    try {
      const { deleted } = await clearLabelMemory(supplierContactId);
      setList({ entries: [], truncated: false });
      return deleted;
    } catch (cause) {
      notify(catalogFailureOf(cause));
      return null;
    } finally {
      setBusy(false);
    }
  }, [notify, supplierContactId]);
  return { list, busy, forget, clear };
}

export function LabelMemoryPanel({ supplierContactId, onClose, onFailure }: LabelMemoryPanelProps) {
  const { t } = useImportText();
  const text = useLineDecisionText();
  const { list, busy, forget, clear } = useMemoryList(supplierContactId, onFailure);
  const [confirming, setConfirming] = useState(false);
  const [cleared, setCleared] = useState<number | null>(null);
  const runClear = async () => { setConfirming(false); setCleared(await clear()); };
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('memory.title')}</DialogTitle>
          <DialogDescription>{t('memory.lead')}</DialogDescription>
        </DialogHeader>
        {list === null ? <p className="m-0 text-sm text-muted-foreground" role="status">{t('memory.loading')}</p> : null}
        {list && list.entries.length === 0 ? <p className="m-0 text-sm text-muted-foreground">{t('memory.empty')}</p> : null}
        {list?.truncated ? <p className="m-0 text-xs text-muted-foreground">{t('memory.truncated', { limit: IMPORT_LABEL_MEMORY_LIST_LIMIT })}</p> : null}
        {cleared !== null ? <p className="m-0 text-xs" role="status">{t('memory.cleared', { count: cleared })}</p> : null}
        {list && list.entries.length > 0 ? (
          <ul className="m-0 flex max-h-96 list-none flex-col gap-2 overflow-auto p-0">
            {list.entries.map((entry) => <MemoryEntry key={entry.id} entry={entry} text={text} disabled={busy} onForget={() => void forget(entry)} />)}
          </ul>
        ) : null}
        {confirming ? <p className="m-0 text-sm text-destructive" role="alert">{t('memory.clearConfirm')}</p> : null}
        <DialogFooter>
          {confirming ? (
            <>
              <Button type="button" variant="outline" onClick={() => setConfirming(false)}>{t('memory.cancel')}</Button>
              <Button type="button" variant="destructive" disabled={busy} onClick={() => void runClear()}>{t('memory.clearYes')}</Button>
            </>
          ) : (
            <>
              {list && list.entries.length > 0 ? <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirming(true)}>{t('memory.clear')}</Button> : null}
              <Button type="button" onClick={onClose}>{t('memory.close')}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
