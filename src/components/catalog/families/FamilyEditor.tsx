'use client';

/**
 * @fileoverview **Επεξεργαστής οικογένειας προϊόντων** — καρτέλες Γενικά · Ιδιότητες · Παραλλαγές · Πίνακας · Κανόνες,
 *   διπλασιασμός (ADR-923 §5.2 · Φάση 1γ). Το κριτήριο εξόδου της Φάσης 1: το «Fan coil» ορίζεται **εδώ**, χωρίς κώδικα.
 * @module components/catalog/families/FamilyEditor
 *
 * 🔑 **Ένα έγγραφο, μία αποθήκευση** (όπως ένα αρχείο Figma): οι καρτέλες είναι όψεις του ίδιου προχείρου. Η επικύρωση
 *    τρέχει **ζωντανά** με τον `validateFamily` του γραφέα, απέναντι στη βιβλιοθήκη όπως είναι τώρα· κάθε καρτέλα
 *    δείχνει **πόσα** προβλήματα έχει, ώστε ο άνθρωπος να ξέρει πού να πάει.
 * 🔑 Ο κωδικός ελέγχεται και για σύγκρουση με άλλη οικογένεια **πριν** σταλεί (ο γραφέας θα απαντούσε 409).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Copy } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CatalogLibrary } from '@/hooks/catalog/useCatalogLibrary';
import type { CatalogOptimistic } from '@/hooks/catalog/useCatalogOptimistic';
import type { FamilyRecord } from '@/services/catalog/catalog-api.client';
import { IssueCollector, type CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { CatalogFamilyDefinition } from '@/subapps/catalog/types/family';
import { deleteDefinition, newEntityKey, optimisticWire, saveDefinition } from '../shared/catalog-actions';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { IssueSummary } from '../shared/CatalogIssues';
import { EditorFooter } from '../shared/EditorFooter';
import { isEditorSelf } from '../shared/editor-self';
import { useDefinitionDraft, useShownIssues } from '../shared/use-definition-draft';
import type { FamilyTabProps } from './AttributePicker';
import { FamilyAttributesTab } from './FamilyAttributesTab';
import { FamilyDuplicateDialog } from './FamilyDuplicateDialog';
import { emptyFamilyDraft, FAMILY_TABS, familyAttributes, familyDraftOf, issueCountByTab, storedFamilyOf, validateFamilyDraft, type FamilyTab } from './family-draft';
import { FamilyGeneralTab } from './FamilyGeneralTab';
import { FamilyRulesTab } from './FamilyRulesTab';
import { FamilyTableTab } from './FamilyTableTab';
import { FamilyVariantsTab } from './FamilyVariantsTab';

const TAB_KEYS: Readonly<Record<FamilyTab, string>> = {
  general: 'families.tabs.general',
  attributes: 'families.tabs.attributes',
  variants: 'families.tabs.variants',
  table: 'families.tabs.table',
  rules: 'families.tabs.rules',
};

export interface FamilyEditorProps {
  readonly record: FamilyRecord | null;
  readonly families: readonly FamilyRecord[];
  readonly library: CatalogLibrary;
  readonly ops: CatalogOptimistic<FamilyRecord>;
  readonly canManage: boolean;
  readonly onCreated: (id: string) => void;
  readonly onDeleted: () => void;
  readonly reportDirty: (dirty: boolean) => void;
}

function duplicateCodeIssue(
  draft: CatalogFamilyDefinition,
  record: FamilyRecord | null,
  families: readonly FamilyRecord[],
  created: CatalogFamilyDefinition | null,
): readonly CatalogIssue[] {
  const collector = new IssueCollector();
  const taken = families.some((family) => family.code === draft.code && !isEditorSelf(family, record, created));
  if (!record && taken) collector.add('duplicateCode', 'code', { code: draft.code });
  return collector.issues;
}

function useFamilyEditor({ record, families, library, reportDirty }: FamilyEditorProps) {
  const base = useMemo(() => (record ? familyDraftOf(record) : emptyFamilyDraft()), [record]);
  const editor = useDefinitionDraft(base, record?.id ?? 'new', record?.revision ?? null);
  useEffect(() => reportDirty(editor.unsaved), [editor.unsaved, reportDirty]);
  const clientIssues = useMemo(
    () => [
      ...validateFamilyDraft(editor.draft, library.attributeById, library.registry),
      ...duplicateCodeIssue(editor.draft, record, families, editor.created),
    ],
    [editor.draft, library.attributeById, library.registry, record, families, editor.created],
  );
  const issues = useShownIssues(editor, clientIssues);
  const inFamily = useMemo(() => familyAttributes(editor.draft, library.attributeById), [editor.draft, library.attributeById]);
  return { editor, clientIssues, issues, inFamily, counts: issueCountByTab(issues) };
}

export function FamilyEditor(props: FamilyEditorProps) {
  const { record, families, library, ops, canManage, onCreated, onDeleted } = props;
  const { t } = useCatalogText();
  const { editor, clientIssues, issues, inFamily, counts } = useFamilyEditor(props);
  const [tab, setTab] = useState<FamilyTab>('general');
  const [duplicating, setDuplicating] = useState(false);
  const tabProps: FamilyTabProps = { draft: editor.draft, update: editor.update, issues, disabled: !canManage, library, inFamily };
  const save = () => saveDefinition(ops, {
    kind: 'family',
    existing: record,
    definition: editor.draft,
    optimistic: optimisticWire(storedFamilyOf(editor.draft), record, newEntityKey(editor.draft.code)),
    baseRevision: editor.baseRevision,
    onSettled: editor.beginSave<FamilyRecord>((saved) => { if (!record) onCreated(saved.id); }),
  });
  const remove = record ? () => { deleteDefinition(ops, 'family', record); onDeleted(); } : undefined;
  return (
    <section className="flex flex-col">
      <Tabs value={tab} onValueChange={(next) => { const match = FAMILY_TABS.find((item) => item === next); if (match) setTab(match); }} className="flex flex-col gap-3 p-4">
        <TabsList className="flex-wrap justify-start">
          {FAMILY_TABS.map((item) => (
            <TabsTrigger key={item} value={item} className="gap-1.5">
              {t(TAB_KEYS[item])}
              {counts[item] > 0 ? <Badge variant="destructive" aria-label={t('families.tabIssues', { count: counts[item] })}>{counts[item]}</Badge> : null}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="general"><FamilyGeneralTab {...tabProps} codeLocked={record !== null} /></TabsContent>
        <TabsContent value="attributes"><FamilyAttributesTab {...tabProps} families={families} canManage={canManage} /></TabsContent>
        <TabsContent value="variants"><FamilyVariantsTab {...tabProps} /></TabsContent>
        <TabsContent value="table"><FamilyTableTab {...tabProps} /></TabsContent>
        <TabsContent value="rules"><FamilyRulesTab {...tabProps} /></TabsContent>
        <IssueSummary issues={editor.dirty ? clientIssues : []} title={t('editor.issuesTitle')} />
      </Tabs>
      <EditorFooter
        editor={editor}
        issues={clientIssues}
        authority="schema"
        onSave={save}
        onDelete={remove}
        record={record}
        extraAction={record && canManage ? { icon: Copy, label: t('families.duplicate.action'), onClick: () => setDuplicating(true), disabled: editor.dirty } : null}
      />
      {record ? <FamilyDuplicateDialog open={duplicating} onOpenChange={setDuplicating} source={record} families={families} ops={ops} onCreated={onCreated} /> : null}
    </section>
  );
}
