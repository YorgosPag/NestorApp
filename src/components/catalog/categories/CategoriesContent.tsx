'use client';

/**
 * @fileoverview **Η σελίδα «Κατηγορίες» του καταλόγου** — τα δέντρα κατηγοριών (ADR-923 §5.2 · Φάση 1γ).
 * @module components/catalog/categories/CategoriesContent
 *
 * 🔑 Πολλά δέντρα: κάθε ρίζα είναι ένα δέντρο (Akeneo) — «Έντυπος κατάλογος 2026» και «Πλοήγηση βιτρίνας» χωριστά.
 * 🔑 **Μετακίνηση με σύρσιμο ή Alt+βέλη** (`SortableTree`), κριμένη από τον επικυρωτή του γραφέα πριν φύγει·
 *    **μετονομασία επί τόπου** με F2 ή διπλό κλικ (Finder/VS Code) — Enter αποθηκεύει, Esc ακυρώνει.
 * 🔑 Η επιλογή ζει στη διεύθυνση (`?category=<id>` · `new` · `new:<γονέας>` για υποκατηγορία).
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FolderTree, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SortableTree, type SortableTreeNode } from '@/components/ui/sortable/SortableTree';
import { useCatalogCollection, type CatalogLoadState } from '@/hooks/catalog/useCatalogCollection';
import { handleInlineRenameKey } from '@/lib/ui/inline-rename-keyboard';
import { useCatalogOptimistic, type CatalogOptimistic } from '@/hooks/catalog/useCatalogOptimistic';
import { byOrderKey } from '@/hooks/catalog/useCatalogLibrary';
import type { CategoryRecord } from '@/services/catalog/catalog-api.client';
import { useNotifications } from '@/providers/NotificationProvider';
import { useCatalogCanManage, useCatalogFailureNotice, useCatalogText } from '../shared/catalog-ui-hooks';
import { useIssueMessage } from '../shared/CatalogIssues';
import { CatalogPageFrame } from '../shared/CatalogPageFrame';
import { CatalogSplit } from '../shared/CatalogSplit';
import { NEW_SELECTION, useCatalogSelection } from '../shared/use-catalog-selection';
import { useUnsavedGuard } from '../shared/use-unsaved-guard';
import { categoryMoveIssues, moveCategory, updateCategory } from './category-actions';
import { CategoryEditor } from './CategoryEditor';

/** `new` = νέα ρίζα · `new:<id>` = νέα υποκατηγορία του `<id>`. */
const NEW_CHILD_PREFIX = `${NEW_SELECTION}:`;

function parseSelection(selected: string | null): { readonly isNew: boolean; readonly parentId: string | null; readonly id: string | null } {
  if (selected === NEW_SELECTION) return { isNew: true, parentId: null, id: null };
  if (selected?.startsWith(NEW_CHILD_PREFIX)) return { isNew: true, parentId: selected.slice(NEW_CHILD_PREFIX.length), id: null };
  return { isNew: false, parentId: null, id: selected };
}

function useCategories(): { readonly state: CatalogLoadState; readonly ops: CatalogOptimistic<CategoryRecord>; readonly sorted: readonly CategoryRecord[] } {
  const collection = useCatalogCollection('CATALOG_CATEGORIES');
  const ops = useCatalogOptimistic(collection.items, useCatalogFailureNotice());
  const sorted = useMemo(() => byOrderKey(ops.view), [ops.view]);
  return { state: collection.state, ops, sorted };
}

function InlineRename({ category, onDone, ops }: {
  readonly category: CategoryRecord;
  readonly onDone: () => void;
  readonly ops: CatalogOptimistic<CategoryRecord>;
}) {
  const { t, text, language } = useCatalogText();
  const [value, setValue] = useState(text(category.labels, category.code));
  // Enter και blur φτάνουν και τα δύο — η μετονομασία γράφεται ΜΙΑ φορά.
  const finished = useRef(false);
  const commit = () => {
    if (finished.current) return;
    finished.current = true;
    const trimmed = value.trim();
    if (trimmed.length > 0 && trimmed !== text(category.labels)) {
      updateCategory(ops, category, { labels: { ...category.labels, [language]: trimmed }, mappings: category.mappings });
    }
    onDone();
  };
  return (
    <Input
      autoFocus
      className="h-7"
      aria-label={t('categories.renameOf', { name: text(category.labels, category.code) })}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onBlur={commit}
      onKeyDown={(event) => handleInlineRenameKey(event, {
        onConfirm: commit,
        onCancel: () => { finished.current = true; onDone(); },
      })}
    />
  );
}

function CategoryTreePanel({ sorted, ops, selectedId, canManage, onSelect }: {
  readonly sorted: readonly CategoryRecord[];
  readonly ops: CatalogOptimistic<CategoryRecord>;
  readonly selectedId: string | null;
  readonly canManage: boolean;
  readonly onSelect: (id: string) => void;
}) {
  const { t, text } = useCatalogText();
  const issueMessage = useIssueMessage();
  const { warning } = useNotifications();
  const [renaming, setRenaming] = useState<string | null>(null);
  const nodes: SortableTreeNode[] = useMemo(() => sorted.map((category) => ({ id: category.id, parentId: category.parentId, label: text(category.labels, category.code) })), [sorted, text]);
  const byId = useMemo(() => new Map(sorted.map((category) => [category.id, category])), [sorted]);
  if (sorted.length === 0) return <p className="m-0 px-2 text-sm text-muted-foreground">{t('categories.none')}</p>;
  return (
    <SortableTree
      nodes={nodes}
      selectedId={selectedId}
      onSelect={onSelect}
      disabled={!canManage}
      ariaLabel={t('pages.categories.title')}
      canMove={(move) => {
        const issues = categoryMoveIssues(sorted, move);
        if (issues.length > 0) warning(issueMessage(issues[0]));
        return issues.length === 0;
      }}
      onMove={(move) => moveCategory(ops, sorted, move)}
      onRename={canManage ? setRenaming : undefined}
      renderLabel={(node) => {
        const category = byId.get(node.id);
        if (category && renaming === node.id) return <InlineRename category={category} ops={ops} onDone={() => setRenaming(null)} />;
        return (
          <span className="flex min-w-0 items-baseline gap-2" onDoubleClick={() => canManage && setRenaming(node.id)}>
            <span className="truncate text-sm">{node.label}</span>
            {category ? <span className="truncate font-mono text-xs text-muted-foreground">{category.code}</span> : null}
            {ops.pendingKeys.has(node.id) ? <span className="text-xs text-muted-foreground">{t('common.saving')}</span> : null}
          </span>
        );
      }}
    />
  );
}

export function CategoriesContent() {
  const { t, text } = useCatalogText();
  const { state, ops, sorted } = useCategories();
  const canManage = useCatalogCanManage();
  const unsaved = useUnsavedGuard();
  const [selected, select] = useCatalogSelection('category');
  const choose = useCallback((value: string | null) => unsaved.guard(() => select(value)), [unsaved, select]);
  const { isNew, parentId, id } = parseSelection(selected);
  const record = id ? ops.settled.find((category) => category.id === id) ?? null : null;
  const parent = parentId ? sorted.find((category) => category.id === parentId) : undefined;
  const title = isNew ? (parent ? t('categories.newChildOf', { name: text(parent.labels, parent.code) }) : t('categories.newRoot')) : record ? text(record.labels, record.code) : '';
  return (
    <CatalogPageFrame
      title={t('pages.categories.title')}
      lead={t('pages.categories.lead')}
      state={state}
      actions={canManage ? <Button type="button" onClick={() => choose(NEW_SELECTION)}><Plus className="mr-1 h-4 w-4" aria-hidden />{t('categories.newRoot')}</Button> : null}
    >
      <CatalogSplit
        listLabel={t('pages.categories.title')}
        list={<CategoryTreePanel sorted={sorted} ops={ops} selectedId={id} canManage={canManage} onSelect={choose} />}
        open={(isNew && canManage) || record !== null}
        title={title}
        onClose={() => choose(null)}
        empty={{ icon: FolderTree, title: t('categories.emptyTitle'), description: t('categories.emptyDescription') }}
        details={(isNew && canManage) || record ? (
          <CategoryEditor
            key={selected ?? 'none'}
            record={record}
            parentId={parentId}
            categories={sorted}
            ops={ops}
            canManage={canManage}
            onCreated={(createdId) => select(createdId)}
            onAddChild={(id) => choose(`${NEW_CHILD_PREFIX}${id}`)}
            onDeleted={() => select(null)}
            reportDirty={unsaved.reportDirty}
          />
        ) : null}
      />
      {unsaved.dialog}
    </CatalogPageFrame>
  );
}
