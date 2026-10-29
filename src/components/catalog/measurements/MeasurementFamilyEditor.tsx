'use client';

/**
 * @fileoverview **Επεξεργαστής οικογένειας μέτρησης του χώρου** — ετικέτα, κωδικός, μονάδες, ζωντανή δοκιμή
 *   (ADR-923 §5.2 · Φάση 1γ).
 * @module components/catalog/measurements/MeasurementFamilyEditor
 *
 * 🔑 Επικύρωση **άμεσα** με τις συναρτήσεις του γραφέα (`validateMeasurementDraft`)· η ζωντανή δοκιμή τρέχει στο
 *    **πρόχειρο** — λάθος συντελεστής φαίνεται πριν αποθηκευτεί, όχι όταν τυπωθεί ο κατάλογος.
 * 🔑 Η οικογένεια του χώρου είναι **μη συγκρίσιμη** ως την έγκριση της πλατφόρμας (§17) — το λέμε εδώ, στο σημείο της
 *    απόφασης.
 */

import React, { useEffect, useMemo } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { DEFAULT_LANGUAGE } from '@/i18n/languages';
import type { CatalogOptimistic } from '@/hooks/catalog/useCatalogOptimistic';
import type { MeasurementFamilyRecord } from '@/services/catalog/catalog-api.client';
import { fromWorkspaceDefinition } from '@/subapps/catalog/measurement/measurement-registry';
import { deleteDefinition, newEntityKey, optimisticWire, saveDefinition } from '../shared/catalog-actions';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { CatalogCodeField, SwitchField } from '../shared/CatalogFormFields';
import { EditorFooter } from '../shared/EditorFooter';
import { LocalizedTextField } from '../shared/LocalizedTextField';
import { useDefinitionDraft, useShownIssues } from '../shared/use-definition-draft';
import { NEW_SELECTION } from '../shared/use-catalog-selection';
import { emptyMeasurementDraft, measurementDraftOf, validateMeasurementDraft } from './measurement-draft';
import { MeasurementConversionTester } from './MeasurementConversionTester';
import { MeasurementUnitsEditor } from './MeasurementUnitsEditor';

interface MeasurementFamilyEditorProps {
  /** `null` = νέα οικογένεια. */
  readonly record: MeasurementFamilyRecord | null;
  /** Κάποια ιδιότητα τη χρησιμοποιεί ⇒ append-only. */
  readonly inUse: boolean;
  readonly ops: CatalogOptimistic<MeasurementFamilyRecord>;
  readonly canManage: boolean;
  readonly onCreated: (code: string) => void;
  readonly onDeleted: () => void;
  readonly reportDirty: (dirty: boolean) => void;
}

function useMeasurementEditor({ record, inUse, reportDirty }: MeasurementFamilyEditorProps) {
  const base = useMemo(() => (record ? measurementDraftOf(record) : emptyMeasurementDraft()), [record]);
  const editor = useDefinitionDraft(base, record?.id ?? NEW_SELECTION, record?.revision ?? null);
  useEffect(() => reportDirty(editor.unsaved), [editor.unsaved, reportDirty]);
  const locked = inUse && record !== null;
  const clientIssues = useMemo(() => validateMeasurementDraft(editor.draft, locked ? base : null), [editor.draft, locked, base]);
  const issues = useShownIssues(editor, clientIssues);
  const lockedCodes = useMemo(() => new Set(locked ? base.units.map((unit) => unit.code) : []), [locked, base]);
  return { editor, issues, clientIssues, lockedCodes };
}

export function MeasurementFamilyEditor(props: MeasurementFamilyEditorProps) {
  const { record, ops, canManage, onCreated, onDeleted } = props;
  const { t } = useCatalogText();
  const { editor, issues, clientIssues, lockedCodes } = useMeasurementEditor(props);
  const { draft, update } = editor;
  const disabled = !canManage;
  const preview = useMemo(() => fromWorkspaceDefinition(draft), [draft]);
  const save = () =>
    saveDefinition(ops, {
      kind: 'measurementFamily',
      existing: record,
      definition: draft,
      optimistic: optimisticWire(draft, record, newEntityKey(draft.code)),
      baseRevision: editor.baseRevision,
      onSettled: editor.beginSave<MeasurementFamilyRecord>((saved) => { if (!record) onCreated(saved.code); }),
    });
  const remove = record ? () => { deleteDefinition(ops, 'measurementFamily', record); onDeleted(); } : undefined;
  return (
    <section className="flex flex-col">
      <section className="flex flex-col gap-4 p-4">
        <Alert><AlertDescription>{t('measurement.editor.notComparableHint')}</AlertDescription></Alert>
        <LocalizedTextField label={t('common.labels')} value={draft.labels} disabled={disabled} issues={issues} path="labels" onChange={(labels) => update({ ...draft, labels })} />
        <CatalogCodeField value={draft.code} locked={record !== null} disabled={disabled} suggestFrom={draft.labels[DEFAULT_LANGUAGE] ?? ''} issues={issues} onChange={(code) => update({ ...draft, code })} />
        <SwitchField label={t('measurement.editor.singleUnit')} hint={t('measurement.editor.singleUnitHint')} checked={draft.singleUnit} disabled={disabled || lockedCodes.size > 0} onChange={(singleUnit) => update({ ...draft, singleUnit })} />
        <MeasurementUnitsEditor draft={draft} onChange={update} issues={issues} lockedCodes={lockedCodes} disabled={disabled} />
        {draft.units.length > 0 && clientIssues.length === 0 ? <MeasurementConversionTester family={preview} /> : null}
      </section>
      <EditorFooter
        editor={editor}
        issues={clientIssues}
        authority="schema"
        onSave={save}
        onDelete={remove}
        record={record}
      />
    </section>
  );
}
