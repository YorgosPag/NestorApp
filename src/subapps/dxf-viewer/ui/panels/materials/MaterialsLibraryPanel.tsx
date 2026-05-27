'use client';

/**
 * ADR-363 Phase 6.5.B — Floating panel "Υλικά" (5η tab στο left sidebar).
 * List + filter + search + CRUD modal. System materials read-only.
 */

import React, { useState, useCallback, useMemo } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Plus } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useAuth } from '@/auth/hooks/useAuth';
import type {
  BimMaterial,
  BimMaterialCategory,
  BimMaterialScope,
  SaveBimMaterialInput,
  UpdateBimMaterialPatch,
} from '../../../bim/types/bim-material-types';
import { useMaterialLibrary } from './hooks/useMaterialLibrary';
import { MaterialEditorDialog } from './MaterialEditorDialog';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MaterialsLibraryPanelProps {
  projectId?: string;
}

type ScopeFilter = BimMaterialScope | 'all';
type CategoryFilter = BimMaterialCategory | 'all';

// ─── Component ────────────────────────────────────────────────────────────────

export function MaterialsLibraryPanel({ projectId }: MaterialsLibraryPanelProps) {
  const { t } = useTranslation('bim-materials');
  const colors = useSemanticColors();
  const { user } = useAuth();
  const companyResult = useCompanyId();
  const companyId = companyResult?.companyId;
  const userId = user?.uid;

  const { materials, loading, save, update, remove } = useMaterialLibrary({ companyId, userId, projectId });

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BimMaterial | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<BimMaterial | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return materials.filter((m) => {
      if (categoryFilter !== 'all' && m.category !== categoryFilter) return false;
      if (scopeFilter !== 'all' && m.scope !== scopeFilter) return false;
      if (q && !m.nameEl.toLowerCase().includes(q) && !m.nameEn.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [materials, search, categoryFilter, scopeFilter]);

  const openCreate = useCallback(() => { setEditTarget(undefined); setEditorOpen(true); }, []);
  const openEdit = useCallback((m: BimMaterial) => { setEditTarget(m); setEditorOpen(true); }, []);
  const closeEditor = useCallback(() => setEditorOpen(false), []);

  const handleSave = useCallback(async (
    payload: SaveBimMaterialInput | UpdateBimMaterialPatch,
    mode: 'create' | 'edit',
  ) => {
    if (mode === 'create') {
      await save(payload as SaveBimMaterialInput);
    } else if (editTarget) {
      await update(editTarget.id, payload as UpdateBimMaterialPatch);
    }
    setEditorOpen(false);
  }, [save, update, editTarget]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await remove(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, remove]);

  const CATEGORIES: BimMaterialCategory[] = [
    'plaster', 'masonry', 'concrete', 'insulation', 'flooring',
    'window-frame', 'door-frame', 'paint', 'roofing', 'waterproofing', 'other',
  ];
  const SCOPE_FILTERS: ScopeFilter[] = ['all', 'system', 'company', 'project'];

  return (
    <section aria-label={t('list.title')} className="flex flex-col gap-2 h-full">
      <header className="flex items-center justify-between gap-1">
        <h3 className={`text-xs font-semibold uppercase tracking-wide ${colors.text.muted}`}>
          {t('list.title')}
        </h3>
        <Button variant="ghost" size="sm" onClick={openCreate} className="h-6 px-2 text-xs gap-1">
          <Plus size={12} />
        </Button>
      </header>

      <nav className="flex flex-col gap-1.5" aria-label={t('list.filtersAriaLabel')}>
        <input
          type="search"
          placeholder={t('list.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`w-full text-xs px-2 py-1 rounded ${colors.border.default} border ${colors.bg.primary} ${colors.text.primary} focus:outline-none focus:ring-1 focus:ring-ring`}
        />
        <div className="flex gap-1">
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}>
            <SelectTrigger size="sm" className="text-xs h-6 flex-1">
              <SelectValue placeholder={t('list.allCategories')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('list.allCategories')}</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{t(`categories.${c}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-0.5">
            {SCOPE_FILTERS.map((sc) => (
              <button
                key={sc}
                type="button"
                onClick={() => setScopeFilter(sc)}
                className={[
                  'text-xs px-1.5 py-0.5 rounded transition-colors',
                  scopeFilter === sc
                    ? 'bg-primary text-primary-foreground'
                    : `${colors.bg.secondary} ${colors.text.muted} hover:${colors.bg.hover}`,
                ].join(' ')}
              >
                {t(`scopes.${sc}`)}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="flex flex-col gap-1 overflow-y-auto flex-1 min-h-0">
        {loading && (
          <p className={`text-xs ${colors.text.muted} text-center py-4`}>
            {t('list.loading')}
          </p>
        )}
        {!loading && filtered.length === 0 && (
          <aside className={`text-xs ${colors.text.muted} text-center py-6 flex flex-col gap-1`}>
            <p>{t('list.emptyList')}</p>
            {materials.length === 0 && <p className="opacity-70">{t('list.emptyHint')}</p>}
          </aside>
        )}
        {filtered.map((m) => (
          <MaterialCard
            key={m.id}
            material={m}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
            t={t}
            colors={colors}
          />
        ))}
      </main>

      <MaterialEditorDialog
        open={editorOpen}
        mode={editTarget ? 'edit' : 'create'}
        initial={editTarget}
        projectId={projectId}
        onSave={handleSave}
        onCancel={closeEditor}
      />

      <DeleteConfirmDialog
        target={deleteTarget}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        t={t}
      />
    </section>
  );
}

// ─── MaterialCard ─────────────────────────────────────────────────────────────

interface MaterialCardProps {
  material: BimMaterial;
  onEdit: (m: BimMaterial) => void;
  onDelete: (m: BimMaterial) => void;
  t: (k: string, opts?: Record<string, string>) => string;
  colors: ReturnType<typeof useSemanticColors>;
}

function scopeBadgeClass(
  scope: BimMaterialScope,
  colors: ReturnType<typeof useSemanticColors>,
): string {
  switch (scope) {
    case 'system': return `bg-muted ${colors.text.muted}`;
    case 'company': return `${colors.bg.infoSubtle} ${colors.text.info}`;
    case 'project': return `${colors.bg.successSubtle} ${colors.text.success}`;
  }
}

function MaterialCard({ material, onEdit, onDelete, t, colors }: MaterialCardProps) {
  const isBuiltin = material.builtin;
  return (
    <article
      className={[
        'flex flex-col gap-0.5 px-2 py-1.5 rounded cursor-pointer transition-colors',
        isBuiltin
          ? `${colors.bg.secondary} opacity-80`
          : `${colors.bg.secondary} hover:${colors.bg.hover}`,
      ].join(' ')}
      onClick={() => onEdit(material)}
      aria-label={t('list.cardAriaLabel', { name: material.nameEl })}
    >
      <header className="flex items-center justify-between gap-1">
        <span className={`text-xs font-medium truncate ${colors.text.primary}`}>{material.nameEl}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${scopeBadgeClass(material.scope, colors)}`}>
          {t(`list.${material.scope}Badge`)}
        </span>
      </header>
      <footer className="flex items-center gap-2 justify-between">
        <span className={`text-[10px] ${colors.text.muted} truncate`}>
          {t(`categories.${material.category}`)}
          {material.density != null && ` · ${material.density} kg/m³`}
        </span>
        {!isBuiltin && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(material); }}
            className={`text-[10px] ${colors.text.muted} hover:text-destructive transition-colors shrink-0`}
          >
            {t('delete.confirm')}
          </button>
        )}
      </footer>
    </article>
  );
}

// ─── DeleteConfirmDialog ──────────────────────────────────────────────────────

interface DeleteConfirmProps {
  target: BimMaterial | null;
  onConfirm: () => void;
  onCancel: () => void;
  t: (k: string, opts?: Record<string, string>) => string;
}

function DeleteConfirmDialog({ target, onConfirm, onCancel, t }: DeleteConfirmProps) {
  return (
    <AlertDialog.Root open={!!target} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <AlertDialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-lg shadow-xl p-6 max-w-sm w-full flex flex-col gap-4">
          <AlertDialog.Title className="text-sm font-semibold">
            {t('delete.title')}
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-muted-foreground">
            {t('delete.description', { name: target?.nameEl ?? '' })}
          </AlertDialog.Description>
          <footer className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <button type="button" className="px-3 py-1.5 text-sm rounded border hover:bg-accent" onClick={onCancel}>
                {t('delete.cancel')}
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button type="button" className="px-3 py-1.5 text-sm rounded bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onConfirm}>
                {t('delete.confirm')}
              </button>
            </AlertDialog.Action>
          </footer>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
