'use client';

/**
 * @fileoverview **Ο επεξεργαστής τιμοκαταλόγου** — πρόχειρο · ζωντανή επικύρωση · αισιόδοξη αποθήκευση (ADR-923 §5.11 «3δ»).
 * @related PriceListGeneralTab.tsx (τα πεδία) · price-list-draft.ts (η επικύρωση = του γραφέα) ·
 *   measurements/MeasurementFamilyEditor.tsx (το ίδιο ιδίωμα: `useDefinitionDraft` + `saveDefinition` + `EditorFooter`)
 * @module components/catalog/pricing/PriceListEditor
 *
 * 🔑 **`authority="pricing"`**: το υποσέλιδο ρωτά τη **δική** του δικαιοδοσία — όποιος βλέπει τιμές χωρίς δικαίωμα
 *    συντήρησης βλέπει «μόνο ανάγνωση» με τον σωστό λόγο (SAP VK13 ≠ VK11).
 * 🔑 Ανέγγιχτη φόρμα δεν «κοκκινίζει»: τα ευρήματα φαίνονται από την πρώτη πληκτρολόγηση ή την απάντηση του γραφέα.
 */

import React, { useEffect, useMemo } from 'react';

import type { CatalogOptimistic } from '@/hooks/catalog/useCatalogOptimistic';
import type { PriceListDefinition } from '@/subapps/catalog/types/price-list';
import type { CustomerGroupWire, PriceListWire } from '@/subapps/catalog/types/pricing-views';
import { deleteDefinition, newEntityKey, optimisticWire, saveDefinition } from '../shared/catalog-actions';
import { useCatalogAccess } from '../shared/catalog-ui-hooks';
import { EditorFooter } from '../shared/EditorFooter';
import { NEW_SELECTION } from '../shared/use-catalog-selection';
import { useDefinitionDraft } from '../shared/use-definition-draft';
import { emptyPriceListDraft, priceListDraftIssues, priceListDraftOf } from './price-list-draft';
import { PriceListGeneralTab } from './PriceListGeneralTab';

export interface PriceListEditorProps {
  /** `null` = νέος τιμοκατάλογος. */
  readonly record: PriceListWire | null;
  readonly lists: readonly PriceListWire[];
  readonly hasVersions: boolean;
  readonly customerGroups: readonly CustomerGroupWire[];
  readonly ops: CatalogOptimistic<PriceListWire>;
  readonly onCreated: (code: string) => void;
  readonly onDeleted: () => void;
  readonly reportDirty: (dirty: boolean) => void;
}

function usePriceListEditor({ record, lists, hasVersions, customerGroups, reportDirty }: PriceListEditorProps) {
  const base = useMemo<PriceListDefinition>(() => (record ? priceListDraftOf(record) : emptyPriceListDraft()), [record]);
  const editor = useDefinitionDraft(base, record?.id ?? NEW_SELECTION, record?.revision ?? null);
  useEffect(() => reportDirty(editor.unsaved), [editor.unsaved, reportDirty]);
  const customerGroupIds = useMemo(() => new Set(customerGroups.map((group) => group.id)), [customerGroups]);
  const clientIssues = useMemo(
    () => priceListDraftIssues(editor.draft, { customerGroupIds, lists, record, hasVersions }),
    [editor.draft, customerGroupIds, lists, record, hasVersions],
  );
  const touched = editor.dirty || editor.serverIssues.length > 0;
  const issues = useMemo(() => (touched ? [...clientIssues, ...editor.serverIssues] : []), [touched, clientIssues, editor.serverIssues]);
  return { editor, issues, clientIssues };
}

export function PriceListEditor(props: PriceListEditorProps) {
  const { record, ops, hasVersions, customerGroups, onCreated, onDeleted } = props;
  const { editor, issues, clientIssues } = usePriceListEditor(props);
  const disabled = useCatalogAccess('pricing') !== 'granted';
  const save = () =>
    saveDefinition(ops, {
      kind: 'priceList',
      existing: record,
      definition: editor.draft,
      optimistic: optimisticWire(editor.draft, record, newEntityKey(editor.draft.code)),
      baseRevision: editor.baseRevision,
      onSettled: editor.beginSave<PriceListWire>((saved) => { if (!record) onCreated(saved.code); }),
    });
  const remove = record ? () => { deleteDefinition(ops, 'priceList', record); onDeleted(); } : undefined;
  return (
    <section className="flex flex-col">
      <PriceListGeneralTab
        draft={editor.draft}
        update={editor.update}
        issues={issues}
        isNew={record === null}
        meaningLocked={hasVersions}
        customerGroups={customerGroups}
        disabled={disabled}
      />
      <EditorFooter editor={editor} issues={clientIssues} authority="pricing" onSave={save} onDelete={remove} record={record} />
    </section>
  );
}
