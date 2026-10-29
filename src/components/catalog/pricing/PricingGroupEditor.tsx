'use client';

/**
 * @fileoverview **Ο ένας επεξεργαστής ομάδας τιμολόγησης** — ομάδα έκπτωσης **ή** ομάδα πελατών (ADR-923 §5.11 «3δ» Τμήμα 2).
 * @related pricing-group-draft.ts (η επικύρωση = του γραφέα) · server/catalog/pricing-group-writer.server.ts (ένας γραφέας) ·
 *   CustomerGroupMembers.tsx (τα μέλη, μόνο για ομάδα πελατών)
 * @module components/catalog/pricing/PricingGroupEditor
 *
 * 🔑 **Ίδιο σχήμα, ίδιος γραφέας, ένας επεξεργαστής** — το είδος είναι παράμετρος, όχι δεύτερο αρχείο (N.18). Η αποστολή
 *    διαλέγει ουρά ανά είδος (`submitGroup`) ώστε οι τύποι να μένουν ακριβείς χωρίς καμία μετατροπή.
 * 🔑 Η διαγραφή ομάδας που χρησιμοποιείται την αρνείται ο γραφέας (`inUse`)· η ουρά επαναφέρει την ομάδα και η ειδοποίηση
 *    το λέει — η οθόνη δεν μαντεύει χρήσεις που δεν βλέπει (γραμμές τιμοκαταλόγων).
 */

import React, { useEffect, useMemo } from 'react';

import { DEFAULT_LANGUAGE } from '@/i18n/languages';
import type { CatalogOutcome } from '@/hooks/catalog/useCatalogOptimistic';
import type { PricingGroupKind } from '@/subapps/catalog/vocabulary/pricing';
import { deleteDefinition, newEntityKey, optimisticWire, saveDefinition } from '../shared/catalog-actions';
import { CatalogCodeField } from '../shared/CatalogFormFields';
import { useCatalogAccess, useCatalogText } from '../shared/catalog-ui-hooks';
import { EditorFooter } from '../shared/EditorFooter';
import { LocalizedTextField } from '../shared/LocalizedTextField';
import { NEW_SELECTION } from '../shared/use-catalog-selection';
import { useDefinitionDraft, useShownIssues } from '../shared/use-definition-draft';
import { emptyGroupDraft, groupDraftIssues, groupDraftOf, type PricingGroupDefinition, type PricingGroupWire } from './pricing-group-draft';
import { PRICING_GROUP_HINT_KEYS } from './pricing-labels';
import type { DiscountsWorkspace } from './use-discounts-workspace';

type GroupQueues = Pick<DiscountsWorkspace, 'discountGroups' | 'customerGroups'>;

interface GroupSubmission {
  readonly existing: PricingGroupWire | null;
  readonly definition: PricingGroupDefinition;
  readonly optimistic: PricingGroupWire;
  readonly baseRevision: number | null;
  readonly onSettled: (outcome: CatalogOutcome<PricingGroupWire>) => void;
}

/** Η αποστολή στην ουρά του είδους — ίδιο σώμα, ακριβής τύπος ανά κλάδο. */
function submitGroup(queues: GroupQueues, kind: PricingGroupKind, submission: GroupSubmission): void {
  if (kind === 'discountGroup') saveDefinition(queues.discountGroups, { kind, ...submission });
  else saveDefinition(queues.customerGroups, { kind, ...submission });
}

function removeGroup(queues: GroupQueues, kind: PricingGroupKind, record: PricingGroupWire): void {
  if (kind === 'discountGroup') deleteDefinition(queues.discountGroups, kind, record);
  else deleteDefinition(queues.customerGroups, kind, record);
}

export interface PricingGroupEditorProps {
  readonly kind: PricingGroupKind;
  /** `null` = νέα ομάδα. */
  readonly record: PricingGroupWire | null;
  /** Οι ομάδες **του ίδιου είδους** — για τον διπλό κωδικό. */
  readonly siblings: readonly PricingGroupWire[];
  readonly queues: GroupQueues;
  readonly onCreated: (code: string) => void;
  readonly onDeleted: () => void;
  readonly reportDirty: (dirty: boolean) => void;
}

function useGroupEditor({ record, siblings, reportDirty }: PricingGroupEditorProps) {
  const base = useMemo(() => (record ? groupDraftOf(record) : emptyGroupDraft()), [record]);
  const editor = useDefinitionDraft(base, record?.id ?? NEW_SELECTION, record?.revision ?? null);
  useEffect(() => reportDirty(editor.unsaved), [editor.unsaved, reportDirty]);
  const clientIssues = useMemo(
    () => groupDraftIssues(editor.draft, siblings, record, editor.created),
    [editor.draft, siblings, record, editor.created],
  );
  return { editor, issues: useShownIssues(editor, clientIssues), clientIssues };
}

export function PricingGroupEditor(props: PricingGroupEditorProps) {
  const { kind, record, queues, onCreated, onDeleted } = props;
  const { t } = useCatalogText();
  const { editor, issues, clientIssues } = useGroupEditor(props);
  const disabled = useCatalogAccess('pricing') !== 'granted';
  const save = () =>
    submitGroup(queues, kind, {
      existing: record,
      definition: editor.draft,
      optimistic: optimisticWire(editor.draft, record, newEntityKey(editor.draft.code)),
      baseRevision: editor.baseRevision,
      onSettled: editor.beginSave<PricingGroupWire>((saved) => { if (!record) onCreated(saved.code); }),
    });
  const remove = record ? () => { removeGroup(queues, kind, record); onDeleted(); } : undefined;
  return (
    <section className="flex flex-col">
      <section className="flex flex-col gap-4 p-4">
        <p className="m-0 text-sm text-muted-foreground">{t(PRICING_GROUP_HINT_KEYS[kind])}</p>
        <LocalizedTextField label={t('common.labels')} value={editor.draft.labels} disabled={disabled} issues={issues} path="labels"
          onChange={(labels) => editor.update({ ...editor.draft, labels })} />
        <CatalogCodeField value={editor.draft.code} locked={record !== null} disabled={disabled} suggestFrom={editor.draft.labels[DEFAULT_LANGUAGE] ?? ''}
          issues={issues} onChange={(code) => editor.update({ ...editor.draft, code })} />
      </section>
      <EditorFooter editor={editor} issues={clientIssues} authority="pricing" onSave={save} onDelete={remove} record={record} />
    </section>
  );
}
