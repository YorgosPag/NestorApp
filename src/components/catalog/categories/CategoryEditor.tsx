'use client';

/**
 * @fileoverview **Επεξεργαστής κατηγορίας** — ετικέτα, κωδικός, αντιστοίχιση ΑΤΟΕ (ADR-923 §5.2 · §5.8 · Φάση 1γ).
 * @module components/catalog/categories/CategoryEditor
 *
 * 🔑 Ο γονέας και η θέση **δεν** αλλάζουν από εδώ — μόνο με σύρσιμο/πληκτρολόγιο στο δέντρο (ένας δρόμος για τη δομή,
 *    όπως ο γραφέας: `move` χωριστά από `update`).
 * 🔑 Διαγράφεται μόνο **φύλλο** (ο γραφέας αρνείται κατηγορία με παιδιά): το κουμπί το λέει, δεν αφήνει να γίνει 409.
 * 🔑 ΑΤΟΕ = **αντιστοίχιση**, όχι νέα ταξινομία (ADR-923 §5.8).
 */

import React, { useEffect, useMemo } from 'react';
import { FolderPlus } from 'lucide-react';

import { Input } from '@/components/ui/input';
import type { CatalogOptimistic } from '@/hooks/catalog/useCatalogOptimistic';
import { DEFAULT_LANGUAGE } from '@/i18n/languages';
import type { LocalizedText } from '@/i18n/localized-text';
import type { CategoryRecord } from '@/services/catalog/catalog-api.client';
import { IssueCollector } from '@/subapps/catalog/schema/catalog-issues';
import type { CatalogCategoryMappings } from '@/subapps/catalog/types/category';
import { hasAnyLocalizedText } from '@/i18n/localized-text';
import { isCatalogCode } from '@/subapps/catalog/vocabulary/catalog-limits';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { CatalogCodeField, CatalogField } from '../shared/CatalogFormFields';
import { EditorFooter } from '../shared/EditorFooter';
import { LocalizedTextField } from '../shared/LocalizedTextField';
import { useDefinitionDraft } from '../shared/use-definition-draft';
import { orderKeyAtEnd } from '../shared/catalog-ordering';
import { createCategory, deleteCategory, updateCategory } from './category-actions';

interface CategoryDraft {
  readonly code: string;
  readonly labels: LocalizedText;
  readonly mappings: CatalogCategoryMappings;
}

const EMPTY: CategoryDraft = { code: '', labels: {}, mappings: { atoeCode: null } };

interface CategoryEditorProps {
  /** `null` = νέα κατηγορία κάτω από τον `parentId`. */
  readonly record: CategoryRecord | null;
  readonly parentId: string | null;
  readonly categories: readonly CategoryRecord[];
  readonly ops: CatalogOptimistic<CategoryRecord>;
  readonly canManage: boolean;
  readonly onCreated: (id: string) => void;
  readonly onAddChild: (parentId: string) => void;
  readonly onDeleted: () => void;
  readonly reportDirty: (dirty: boolean) => void;
}

function validateCategoryDraft(draft: CategoryDraft, codesTaken: ReadonlySet<string>, isNew: boolean) {
  const collector = new IssueCollector();
  if (isNew && !isCatalogCode(draft.code)) collector.add('invalidCode', 'code');
  if (isNew && codesTaken.has(draft.code)) collector.add('duplicateCode', 'code', { code: draft.code });
  if (!hasAnyLocalizedText(draft.labels)) collector.add('labelRequired', 'labels');
  return collector.issues;
}

function useCategoryEditor({ record, categories, reportDirty }: CategoryEditorProps) {
  const base = useMemo<CategoryDraft>(() => (record ? { code: record.code, labels: record.labels, mappings: record.mappings } : EMPTY), [record]);
  const editor = useDefinitionDraft(base, record?.id ?? 'new', record?.revision ?? null);
  useEffect(() => reportDirty(editor.unsaved), [editor.unsaved, reportDirty]);
  const codes = useMemo(() => new Set(categories.map((category) => category.code)), [categories]);
  const clientIssues = useMemo(() => validateCategoryDraft(editor.draft, codes, record === null), [editor.draft, codes, record]);
  const issues = editor.dirty || editor.serverIssues.length > 0 ? [...clientIssues, ...editor.serverIssues] : [];
  return { editor, clientIssues, issues };
}

export function CategoryEditor(props: CategoryEditorProps) {
  const { record, parentId, categories, ops, canManage, onCreated, onAddChild, onDeleted } = props;
  const { t } = useCatalogText();
  const { editor, clientIssues, issues } = useCategoryEditor(props);
  const { draft, update } = editor;
  const disabled = !canManage;
  const hasChildren = record !== null && categories.some((category) => category.parentId === record.id);
  const save = () => {
    const settle = editor.beginSave<CategoryRecord>((saved) => { if (!record) onCreated(saved.id); });
    if (record) {
      updateCategory(ops, record, editor.baseRevision ?? record.revision, { labels: draft.labels, mappings: draft.mappings }, settle);
      return;
    }
    const siblings = categories.filter((category) => category.parentId === parentId);
    createCategory(ops, categories, { ...draft, parentId, orderKey: orderKeyAtEnd(siblings) }, settle);
  };
  const remove = record && !hasChildren ? () => { deleteCategory(ops, record); onDeleted(); } : undefined;
  return (
    <section className="flex flex-col">
      <section className="flex flex-col gap-4 p-4">
        <LocalizedTextField label={t('common.labels')} value={draft.labels} disabled={disabled} issues={issues} path="labels" onChange={(labels) => update({ ...draft, labels })} />
        <CatalogCodeField value={draft.code} locked={record !== null} disabled={disabled} suggestFrom={draft.labels[DEFAULT_LANGUAGE] ?? ''} issues={issues} onChange={(code) => update({ ...draft, code })} />
        <CatalogField label={t('categories.atoe')} hint={t('categories.atoeHint')}>
          {({ id, describedBy }) => (
            <Input id={id} aria-describedby={describedBy} className="font-mono" disabled={disabled} value={draft.mappings.atoeCode ?? ''}
              onChange={(event) => update({ ...draft, mappings: { atoeCode: event.target.value.trim().length > 0 ? event.target.value.trim() : null } })} />
          )}
        </CatalogField>
        {record && hasChildren ? <p className="m-0 text-xs text-muted-foreground">{t('categories.deleteLeafOnly')}</p> : null}
      </section>
      <EditorFooter
        editor={editor}
        issues={clientIssues}
        authority="schema"
        onSave={save}
        onDelete={remove}
        record={record}
        extraAction={record && canManage ? { icon: FolderPlus, label: t('categories.addChild'), onClick: () => onAddChild(record.id) } : null}
      />
    </section>
  );
}
