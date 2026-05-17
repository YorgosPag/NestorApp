'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  subscribeLayerStateStore,
  getLayerStateStoreSnapshot,
} from '../../../stores/LayerStateStore';
import { ManageRow } from './LayerStateManageRow';
import type { LayerStateDropdownActions } from './useLayerStateDropdown';
import type { LayerStateContextMenuActions } from './LayerStateContextMenu';
import type { LayerState } from '../../../types/layer-state';

export interface LayerStateManagePanelProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly actions: LayerStateDropdownActions;
}

type SortCol = 'name' | 'updatedAt';
type SortDir = 'asc' | 'desc';

export function LayerStateManagePanel({
  open,
  onOpenChange,
  actions,
}: LayerStateManagePanelProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const snapshot = React.useSyncExternalStore(
    subscribeLayerStateStore,
    getLayerStateStoreSnapshot,
    getLayerStateStoreSnapshot,
  );
  const allStates = snapshot.states;

  const [search, setSearch] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState('');
  const [sortCol, setSortCol] = React.useState<SortCol>('updatedAt');
  const [sortDir, setSortDir] = React.useState<SortDir>('desc');
  const [selectedIds, setSelectedIds] = React.useState<ReadonlySet<string>>(new Set());
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = React.useState<string | null>(null);
  const [draftName, setDraftName] = React.useState('');
  const [draftCategory, setDraftCategory] = React.useState('');

  const categories = React.useMemo(
    () => [...new Set(allStates.map((s) => s.category).filter(Boolean) as string[])].sort(),
    [allStates],
  );

  const filtered = React.useMemo(
    () => filterAndSort(allStates, search, categoryFilter, sortCol, sortDir),
    [allStates, search, categoryFilter, sortCol, sortDir],
  );

  const toggleSort = (col: SortCol): void => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('asc'); }
  };

  const toggleSelect = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (): void => {
    setSelectedIds(
      selectedIds.size === filtered.length ? new Set() : new Set(filtered.map((s) => s.id)),
    );
  };

  const commitRename = (id: string): void => {
    if (draftName.trim()) actions.rename(id, draftName.trim());
    setEditingId(null);
  };

  const commitCategory = (id: string): void => {
    actions.updateCategory(id, draftCategory);
    setEditingCategoryId(null);
  };

  const handleBulkDelete = (): void => {
    const ids = [...selectedIds];
    actions.bulkDelete(ids);
    setSelectedIds(new Set());
    toast(t('layerState.manage.toastBulkDeleted', { count: ids.length }));
  };

  const contextActions = React.useMemo<LayerStateContextMenuActions>(
    () => ({
      onRename: (id) => {
        const s = allStates.find((x) => x.id === id);
        setDraftName(s?.name ?? '');
        setEditingId(id);
      },
      onEditCategory: (id) => {
        const s = allStates.find((x) => x.id === id);
        setDraftCategory(s?.category ?? '');
        setEditingCategoryId(id);
      },
      onDuplicate: (id) => {
        const suffix = `(${t('layerState.manage.contextMenu.duplicate').toLowerCase()})`;
        const copy = actions.duplicate(id, suffix);
        if (copy) toast(t('layerState.manage.toastDuplicated', { name: copy.name }));
      },
      onDelete: (id) => actions.remove(id),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allStates, actions, t],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" data-testid="layer-state-manage-panel">
        <DialogHeader>
          <DialogTitle>{t('layerState.manage.title')}</DialogTitle>
        </DialogHeader>
        <ManageToolbar
          search={search}
          onSearch={setSearch}
          categories={categories}
          categoryFilter={categoryFilter}
          onCategoryFilter={setCategoryFilter}
          t={t}
        />
        {selectedIds.size > 0 && (
          <BulkActionBar
            count={selectedIds.size}
            onDelete={handleBulkDelete}
            onClear={() => setSelectedIds(new Set())}
            t={t}
          />
        )}
        <div className="overflow-auto max-h-[55vh]">
          <table className="w-full text-xs border-collapse">
            <ManageGridHeader
              sortCol={sortCol}
              sortDir={sortDir}
              allSelected={filtered.length > 0 && selectedIds.size === filtered.length}
              someSelected={selectedIds.size > 0 && selectedIds.size < filtered.length}
              onToggleAll={toggleSelectAll}
              onSort={toggleSort}
              t={t}
            />
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    {t('layerState.manage.empty')}
                  </td>
                </tr>
              )}
              {filtered.map((s) => (
                <ManageRow
                  key={s.id}
                  entry={s}
                  isSelected={selectedIds.has(s.id)}
                  isEditingName={editingId === s.id}
                  isEditingCategory={editingCategoryId === s.id}
                  draftName={draftName}
                  draftCategory={draftCategory}
                  onToggleSelect={() => toggleSelect(s.id)}
                  onRestore={() => actions.smartRestore(s.id)}
                  onStartRename={() => { setDraftName(s.name); setEditingId(s.id); }}
                  onCommitRename={() => commitRename(s.id)}
                  onCancelRename={() => setEditingId(null)}
                  onChangeName={setDraftName}
                  onStartCategory={() => { setDraftCategory(s.category ?? ''); setEditingCategoryId(s.id); }}
                  onCommitCategory={() => commitCategory(s.id)}
                  onCancelCategory={() => setEditingCategoryId(null)}
                  onChangeCategory={setDraftCategory}
                  onDelete={() => actions.remove(s.id)}
                  contextActions={contextActions}
                  t={t}
                />
              ))}
            </tbody>
          </table>
        </div>
        <footer className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
          {filtered.length} / {allStates.length}
        </footer>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

type Tf = { t: (k: string, opts?: Record<string, unknown>) => string };

function ManageToolbar({
  search, onSearch, categories, categoryFilter, onCategoryFilter, t,
}: { search: string; onSearch: (v: string) => void; categories: string[]; categoryFilter: string; onCategoryFilter: (v: string) => void } & Tf): React.ReactElement {
  return (
    <div className="flex gap-2 py-2">
      <div className="relative flex-1">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={t('layerState.manage.searchPlaceholder')}
          className="w-full h-8 pl-7 pr-3 rounded border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          data-testid="manage-search"
        />
      </div>
      <select
        value={categoryFilter}
        onChange={(e) => onCategoryFilter(e.target.value)}
        className="h-8 px-2 rounded border border-border bg-background text-xs focus:outline-none"
        data-testid="manage-category-filter"
      >
        <option value="">{t('layerState.manage.categoryFilterAll')}</option>
        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}

function BulkActionBar({
  count, onDelete, onClear, t,
}: { count: number; onDelete: () => void; onClear: () => void } & Tf): React.ReactElement {
  return (
    <div className="flex items-center gap-2 rounded border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs" data-testid="manage-bulk-bar">
      <span>{t('layerState.manage.bulkBar.selected', { count })}</span>
      <button type="button" onClick={onDelete} className="flex items-center gap-1 rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-destructive hover:bg-destructive/20" data-testid="manage-bulk-delete">
        <Trash2 className="h-3.5 w-3.5" aria-hidden />{t('layerState.manage.bulkBar.delete')}
      </button>
      <button type="button" onClick={onClear} className="inline-flex items-center justify-center h-5 w-5 rounded hover:bg-muted ml-auto" aria-label="Clear selection">
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}

function ManageGridHeader({
  sortCol, sortDir, allSelected, someSelected, onToggleAll, onSort, t,
}: { sortCol: SortCol; sortDir: SortDir; allSelected: boolean; someSelected: boolean; onToggleAll: () => void; onSort: (c: SortCol) => void } & Tf): React.ReactElement {
  return (
    <thead className="border-b border-border text-left text-muted-foreground">
      <tr>
        <th className="w-8 px-2 py-1.5">
          <input type="checkbox" checked={allSelected} ref={(el) => { if (el) el.indeterminate = someSelected; }} onChange={onToggleAll} data-testid="manage-select-all" />
        </th>
        <SortTh col="name" label={t('layerState.manage.column.name')} sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
        <th className="px-2 py-1.5 font-medium">{t('layerState.manage.column.category')}</th>
        <th className="px-2 py-1.5 font-medium">{t('layerState.manage.column.tags')}</th>
        <SortTh col="updatedAt" label={t('layerState.manage.column.updated')} sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
        <th className="w-20 px-2 py-1.5 font-medium">{t('layerState.manage.column.actions')}</th>
      </tr>
    </thead>
  );
}

function SortTh({ col, label, sortCol, sortDir, onSort }: { col: SortCol; label: string; sortCol: SortCol; sortDir: SortDir; onSort: (c: SortCol) => void }): React.ReactElement {
  const active = sortCol === col;
  return (
    <th className="px-2 py-1.5">
      <button type="button" onClick={() => onSort(col)} className="flex items-center gap-1 font-medium hover:text-foreground">
        {label}{active ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
      </button>
    </th>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function filterAndSort(
  states: ReadonlyArray<LayerState>,
  search: string,
  category: string,
  sortCol: SortCol,
  sortDir: SortDir,
): LayerState[] {
  const q = search.toLowerCase();
  const result = states.filter(
    (s) => (!q || s.name.toLowerCase().includes(q)) && (!category || s.category === category),
  );
  return [...result].sort((a, b) => {
    const va = sortCol === 'name' ? a.name : a.updatedAt;
    const vb = sortCol === 'name' ? b.name : b.updatedAt;
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  });
}
