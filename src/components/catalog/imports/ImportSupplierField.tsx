'use client';

/**
 * @fileoverview **Ο προμηθευτής μιας παρτίδας PDF και η μνήμη του** (ADR-923 §5.5.2 Β5.2): επαφή-προμηθευτής, «μάθε από αυτή την
 *   παρτίδα», ρητή «Εφαρμογή μνήμης», «αναίρεση όλων από μνήμη», και η λίστα της μνήμης.
 * @module components/catalog/imports/ImportSupplierField
 *
 * 🔑 **Καμία σιωπηλή εγγραφή** (Απόφαση 4): ο ορισμός προμηθευτή δεν αγγίζει σελίδες που διαβάστηκαν· η μνήμη μπαίνει σε αυτές **μόνο**
 *    με το κουμπί, και ο άνθρωπος βλέπει μετά τι έγινε (γραμμές · αρνήσεις με λόγο · όριο).
 * 🔑 Επαφή μόνο από την **ΜΙΑ** αυστηρή αναζήτηση (`ContactSearchManager`)· ο διακομιστής ξαναρωτά την ύπαρξη (ξένη ≡ ανύπαρκτη).
 * ⚠️ Τεμπέλικη **επιφάνεια** (`import-surfaces.tsx`): η αναζήτηση επαφών φέρνει όλη την υπηρεσία επαφών και τα κλειδιά της — όριο της
 *    κλειστότητας του route slice (CHECK 3.34), όπως στο `PricingPartyPicker`.
 */

import React, { useState } from 'react';
import { BrainCircuit, History, Undo2 } from 'lucide-react';

import { ContactSearchManager } from '@/components/contacts/relationships/ContactSearchManager';
import { Button } from '@/components/ui/button';
import { SwitchField } from '../shared/SwitchField';
import { LINE_REFUSAL_KEYS, useImportText } from './import-text';
import { LabelMemoryPanel } from './LabelMemoryPanel';
import type { ImportSupplierFieldProps, MemoryActionReport } from './supplier-field-props';

function MemoryReport({ report }: { readonly report: MemoryActionReport }) {
  const { t } = useImportText();
  const { outcome } = report;
  return (
    <section className="flex flex-col gap-1 text-xs" role="status" aria-live="polite">
      <p className="m-0">{t(report.action === 'apply' ? 'batch.memoryApplied' : 'batch.memoryUndone', { count: outcome.lines })}</p>
      {outcome.values > 0 ? <p className="m-0">{t(report.action === 'apply' ? 'batch.memoryValuesApplied' : 'batch.memoryValuesUndone', { count: outcome.values })}</p> : null}
      {outcome.limitReached ? <p className="m-0 text-destructive">{t('batch.memoryLimit')}</p> : null}
      {outcome.refused.length > 0 ? (
        <ul className="m-0 list-none p-0 text-muted-foreground">
          {outcome.refused.map((entry) => (
            <li key={`${entry.page}:${entry.table}`}>{t('batch.memoryRefusedTable', { page: entry.page, table: entry.table, reason: t(LINE_REFUSAL_KEYS[entry.reason]) })}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function MemoryActions(props: ImportSupplierFieldProps & { readonly onOpenList: () => void }) {
  const { t } = useImportText();
  const { hints, busy, memoryBusy, onMemory, onOpenList } = props;
  const disabled = busy || memoryBusy;
  return (
    <section className="flex flex-col gap-1" aria-label={t('batch.memoryOpen')}>
      <span className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onOpenList}><History className="mr-1 h-3 w-3" aria-hidden />{t('batch.memoryOpen')}</Button>
        <Button type="button" size="sm" disabled={disabled} onClick={() => onMemory('apply')}><BrainCircuit className="mr-1 h-3 w-3" aria-hidden />{t('batch.memoryApply')}</Button>
        {hints && hints.fromMemory + hints.valuesFromMemory > 0 ? (
          <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => onMemory('undo')}>
            <Undo2 className="mr-1 h-3 w-3" aria-hidden />{t('batch.memoryUndoAll', { count: hints.fromMemory + hints.valuesFromMemory })}
          </Button>
        ) : null}
      </span>
      <p className="m-0 text-xs text-muted-foreground">{t('batch.memoryApplyHint')}</p>
      {hints && hints.applicable > 0 ? <p className="m-0 text-xs">{t('batch.memoryKnown', { count: hints.applicable })}</p> : null}
      {hints && hints.legacyLines > 0 ? <p className="m-0 text-xs text-muted-foreground">{t('batch.memoryLegacy', { count: hints.legacyLines })}</p> : null}
      {memoryBusy ? <p className="m-0 text-xs text-muted-foreground" role="status">{t('batch.memoryWorking')}</p> : null}
      {props.report && !memoryBusy ? <MemoryReport report={props.report} /> : null}
    </section>
  );
}

export function ImportSupplierField(props: ImportSupplierFieldProps) {
  const { t } = useImportText();
  const { supplierContactId, learnLabels, busy, onSupplier, onLearn } = props;
  const [listOpen, setListOpen] = useState(false);
  return (
    <section className="flex flex-col gap-2" aria-label={t('batch.supplier')}>
      <ContactSearchManager selectedContactId={supplierContactId ?? ''} label={t('batch.supplier')} disabled={busy}
        onContactSelect={(contact) => { const next = contact?.id ?? null; if (next !== supplierContactId) onSupplier(next); }} />
      <p className="m-0 text-xs text-muted-foreground">{t('batch.supplierHint')}</p>
      {supplierContactId ? (
        <>
          <SwitchField label={t('batch.supplierLearn')} hint={t('batch.supplierLearnHint')} checked={learnLabels} disabled={busy} onChange={onLearn} />
          <MemoryActions {...props} onOpenList={() => setListOpen(true)} />
          {listOpen ? <LabelMemoryPanel supplierContactId={supplierContactId} onClose={() => setListOpen(false)} onFailure={props.onFailure} /> : null}
        </>
      ) : null}
    </section>
  );
}
