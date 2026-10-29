'use client';

/**
 * @fileoverview **Ο επεξεργαστής συνθήκης έκπτωσης** — κοινό · ομάδα · ισχύς · κανόνας, με αισιόδοξη αποθήκευση
 *   (ADR-923 §5.11 «3δ» Τμήμα 2).
 * @related discount-condition-draft.ts (η επικύρωση = του γραφέα + ασάφεια) · ConditionScopeFields.tsx · DiscountRuleField.tsx ·
 *   PriceListEditor.tsx (το ίδιο ιδίωμα: `useDefinitionDraft` + `saveDefinition` + `EditorFooter`)
 * @module components/catalog/pricing/DiscountConditionEditor
 *
 * 🔑 **Id από τον πελάτη, επαληθευμένο από τον διακομιστή** (Γ5 · ADR-866 επίπεδο Β): η συνθήκη δεν έχει κωδικό, άρα το id
 *    γεννιέται **εδώ**, μία φορά ανά συνεδρία επεξεργαστή — η αισιόδοξη και η αποθηκευμένη εγγραφή είναι η **ίδια**, η επιλογή
 *    δεν αναβοσβήνει.
 * 🔑 **Το πρόχειρο φαίνεται στον πίνακα** (`onDraft`) σε κάθε πλήκτρο — και η **ασάφεια** λέγεται εδώ, πριν από την αποθήκευση,
 *    με σύνδεσμο που ανοίγει τη συγκρουόμενη συνθήκη (ποτέ ένα 422 μετά το κλικ).
 */

import React, { useEffect, useMemo, useState } from 'react';

import type { CatalogOptimistic } from '@/hooks/catalog/useCatalogOptimistic';
import { generateCatalogDiscountConditionId } from '@/services/enterprise-id-convenience';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { DiscountConditionDefinition } from '@/subapps/catalog/types/price-list';
import type { CustomerGroupWire, DiscountConditionWire, DiscountGroupWire } from '@/subapps/catalog/types/pricing-views';
import { deleteDefinition, optimisticWire, saveDefinition } from '../shared/catalog-actions';
import { IssueSummary, type IssueLocation } from '../shared/CatalogIssues';
import { useCatalogAccess, useCatalogText } from '../shared/catalog-ui-hooks';
import { EditorFooter } from '../shared/EditorFooter';
import { NEW_SELECTION } from '../shared/use-catalog-selection';
import { useDefinitionDraft } from '../shared/use-definition-draft';
import { ConditionScopeFields } from './ConditionScopeFields';
import { conditionDefinitionOf, conditionDraftIssues, emptyConditionDraft, type ConditionSeed } from './discount-condition-draft';
import { DiscountRuleField } from './DiscountRuleField';
import type { DiscountWords } from './use-discount-words';

export interface DiscountConditionEditorProps {
  /** `null` = νέα συνθήκη, γεννημένη από το `seed`. */
  readonly record: DiscountConditionWire | null;
  readonly seed: ConditionSeed;
  readonly ops: CatalogOptimistic<DiscountConditionWire>;
  readonly discountGroups: readonly DiscountGroupWire[];
  readonly customerGroups: readonly CustomerGroupWire[];
  readonly words: DiscountWords;
  /** Το πρόχειρο, για τον πίνακα (ζωντανή θέση + ασάφεια). */
  readonly onDraft: (definition: DiscountConditionDefinition) => void;
  readonly onCreated: (id: string) => void;
  readonly onDeleted: () => void;
  /** Άνοιγμα μιας άλλης συνθήκης (ο σύνδεσμος της ασάφειας). */
  readonly onOpen: (id: string) => void;
  readonly reportDirty: (dirty: boolean) => void;
}

function useConditionEditor({ record, seed, ops, discountGroups, customerGroups, onDraft, reportDirty }: DiscountConditionEditorProps) {
  const base = useMemo(() => (record ? conditionDefinitionOf(record) : emptyConditionDraft(seed)), [record, seed]);
  const editor = useDefinitionDraft(base, record?.id ?? NEW_SELECTION, record?.revision ?? null);
  useEffect(() => reportDirty(editor.unsaved), [editor.unsaved, reportDirty]);
  useEffect(() => onDraft(editor.draft), [editor.draft, onDraft]);
  const clientIssues = useMemo(() => conditionDraftIssues(editor.draft, {
    discountGroupIds: new Set(discountGroups.map((group) => group.id)),
    customerGroupIds: new Set(customerGroups.map((group) => group.id)),
    conditions: ops.view,
    selfId: record?.id ?? null,
  }), [editor.draft, discountGroups, customerGroups, ops.view, record]);
  // Η ασάφεια φαίνεται ΑΜΕΣΑ (ακόμη και σε ανέγγιχτη φόρμα: το κελί είναι ήδη κόκκινο)· τα υπόλοιπα από την πρώτη αλλαγή.
  const touched = editor.dirty || editor.serverIssues.length > 0;
  const issues = useMemo(
    () => (touched ? [...clientIssues, ...editor.serverIssues] : clientIssues.filter((issue) => issue.code === 'discountConditionAmbiguous')),
    [touched, clientIssues, editor.serverIssues],
  );
  return { editor, issues, clientIssues };
}

/** Η ασάφεια ονομάζει την **άλλη** συνθήκη με λέξεις και την ανοίγει. */
function useConflictLocator(conditions: readonly DiscountConditionWire[], words: DiscountWords, onOpen: (id: string) => void) {
  const { t } = useCatalogText();
  return (issue: CatalogIssue): IssueLocation | null => {
    const id = issue.code === 'discountConditionAmbiguous' ? issue.params?.conditionId : undefined;
    const other = typeof id === 'string' ? conditions.find((condition) => condition.id === id) : undefined;
    if (!other) return null;
    return { label: t('pricing.discounts.editor.openConflict', { rule: words.rule(other.rule), period: words.period(other) }), onSelect: () => onOpen(other.id) };
  };
}

export function DiscountConditionEditor(props: DiscountConditionEditorProps) {
  const { record, ops, words, onCreated, onDeleted } = props;
  const { t } = useCatalogText();
  const { editor, issues, clientIssues } = useConditionEditor(props);
  const [newId] = useState(generateCatalogDiscountConditionId);
  const locate = useConflictLocator(ops.view, words, props.onOpen);
  const disabled = useCatalogAccess('pricing') !== 'granted';
  const id = record?.id ?? newId;
  const save = () =>
    saveDefinition(ops, {
      kind: 'discountCondition',
      existing: record,
      definition: editor.draft,
      id,
      optimistic: optimisticWire(editor.draft, record, id),
      baseRevision: editor.baseRevision,
      onSettled: editor.beginSave<DiscountConditionWire>((saved) => { if (!record) onCreated(saved.id); }),
    });
  const remove = record ? () => { deleteDefinition(ops, 'discountCondition', record); onDeleted(); } : undefined;
  const deleteName = record ? { labels: {}, code: `${words.audience(record.audience)} · ${words.period(record)}` } : null;
  const ambiguity = issues.filter((issue) => issue.code === 'discountConditionAmbiguous');
  return (
    <section className="flex flex-col">
      <section className="flex flex-col gap-4 p-4">
        <IssueSummary issues={ambiguity} title={t('pricing.discounts.editor.ambiguityTitle')} locate={locate} />
        <ConditionScopeFields draft={editor.draft} update={editor.update} discountGroups={props.discountGroups} customerGroups={props.customerGroups}
          disabled={disabled} issues={issues} />
        <DiscountRuleField rule={editor.draft.rule} onChange={(rule) => editor.update({ ...editor.draft, rule })} disabled={disabled} issues={issues} />
      </section>
      <EditorFooter editor={editor} issues={clientIssues} authority="pricing" onSave={save} onDelete={remove} record={deleteName} />
    </section>
  );
}
