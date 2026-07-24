'use client';

/**
 * ADR-363 Phase 6.5.B / ADR-687 Φ8 — Floating panel "Διαχείριση Υλικών" (5η tab στο left sidebar).
 *
 * ΓΕΝΙΚΗ βιβλιοθήκη (Revit *Material Browser* / Cinema 4D *Content Browser* / ArchiCAD *Attribute
 * Manager*): δείχνει ΟΛΑ τα υλικά — built-in catalog (Τούβλο/Πέτρα/Ξύλο/…) + system/company/project
 * Firestore library + legacy μπογιές — μέσω του κοινού `buildMaterialLibraryEntries` (SSoT). Τα
 * Firestore υλικά έχουν CRUD· τα catalog/μπογιές είναι read-only reference cards με «Διπλασίασε»
 * (Revit «Duplicate»). Ξεχωριστό από την κάτω μπάρα «Υλικά όψης» (Ν.2) που δείχνει μόνο τη σκηνή.
 */

import React, { useState, useCallback, useMemo } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Plus } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { Button } from '@/components/ui/button';
import { useCompanyId } from '@/hooks/useCompanyId';
import { LibraryFilterBar } from '../shared/LibraryFilterBar';
import {
  EMPTY_LIBRARY_FILTER,
  matchesLibraryFilter,
  type LibraryFilterState,
} from '../shared/library-filter';
import { useAuth } from '@/auth/hooks/useAuth';
import type {
  BimMaterial,
  BimMaterialCategory,
  BimMaterialScope,
  SaveBimMaterialInput,
  UpdateBimMaterialPatch,
} from '../../../bim/types/bim-material-types';
import {
  catalogDefForMaterialId,
  flatColorDef,
  defToAppearance,
} from '../../../bim/materials/material-catalog-defs';
import {
  buildMaterialLibraryEntries,
  entryFilterScope,
  type LibraryEntry,
} from '../../../bim-3d/ui/material-library-index';
import { BIM_MATERIAL_MIME, serializeFaceAppearanceDrag } from '../../../bim-3d/ui/polygon-material-dnd';
import { MaterialSwatch } from '../../components/shared/MaterialSwatch';
import { useMaterialLibrary } from './hooks/useMaterialLibrary';
import {
  MaterialEditorDialog,
  type PendingPbrUpload,
} from './MaterialEditorDialog';
import { type MaterialEditorSeed } from './material-editor-form-model';
import { persistMaterialFromEditor } from './persist-material-from-editor';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MaterialsLibraryPanelProps {
  projectId?: string;
}

/** Οι κατηγορίες υλικού — ένας κατάλογος για dropdown + i18n. */
const CATEGORIES: readonly BimMaterialCategory[] = [
  'plaster', 'masonry', 'concrete', 'insulation', 'flooring',
  'window-frame', 'door-frame', 'paint', 'roofing', 'waterproofing', 'other',
];
/** Firestore scopes + ADR-687 Φ8 ψευδο-scopes (catalog/paint) για το scope φίλτρο της βιβλιοθήκης. */
const SCOPE_FILTERS: readonly (BimMaterialScope | 'catalog' | 'paint')[] = [
  'system', 'company', 'project', 'catalog', 'paint',
];

/**
 * ADR-687 Φ8 — seed για «Διπλασίασε»: catalog id → catalog def· μπογιά → flat χρώμα def· → appearance.
 * Ανοίγει τον editor create-mode με το πραγματικό χρώμα/γυαλάδα του καταλόγου (κατηγορία 'other',
 * ο χρήστης την αλλάζει). Το όνομα προ-συμπληρώνεται από την ετικέτα (και el/en — ο χρήστης το ρυθμίζει).
 */
function duplicateSeed(entry: LibraryEntry): MaterialEditorSeed {
  const def = entry.color !== undefined
    ? flatColorDef(entry.color)
    : catalogDefForMaterialId(entry.materialId ?? entry.id);
  return { nameEl: entry.label, nameEn: entry.label, category: 'other', appearance: defToAppearance(def) };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MaterialsLibraryPanel({ projectId }: MaterialsLibraryPanelProps) {
  // ADR-687 Φ8 — `dxf-viewer-shell` ns φορτωμένο ρητά: ο index αντλεί τις catalog/μπογιά ετικέτες
  // από `dxf-viewer-shell:` (constructionMaterials/wallCovering) — αλλιώς θα φαινόταν το raw key.
  const { t } = useTranslation(['bim-materials', 'dxf-viewer-shell']);
  const colors = useSemanticColors();
  const { user } = useAuth();
  const companyResult = useCompanyId();
  const companyId = companyResult?.companyId;
  const userId = user?.uid;

  const { materials, loading, save, update, remove } = useMaterialLibrary({ companyId, userId, projectId });

  // ADR-687 Φ8 — γενική βιβλιοθήκη (catalog + Firestore + μπογιές) ως ΕΝΑ index (SSoT).
  const entries = useMemo(() => buildMaterialLibraryEntries(materials, t), [materials, t]);

  // ADR-652 M3 — το φιλτράρισμα βιβλιοθήκης είναι κοινό SSoT (το μοιράζεται με το palette
  // των block): ίδιο state, ίδιος pure κανόνας, ίδια μπάρα.
  const [filter, setFilter] = useState<LibraryFilterState>(EMPTY_LIBRARY_FILTER);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BimMaterial | undefined>(undefined);
  const [createSeed, setCreateSeed] = useState<MaterialEditorSeed | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<BimMaterial | null>(null);

  const filtered = useMemo(
    () =>
      entries.filter((e) =>
        matchesLibraryFilter(
          {
            names: e.bimMaterial ? [e.bimMaterial.nameEl, e.bimMaterial.nameEn] : [e.label],
            category: e.category ?? null,
            scope: entryFilterScope(e),
          },
          filter,
        ),
      ),
    [entries, filter],
  );

  const categoryOptions = useMemo(
    () => CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}`) })),
    [t],
  );
  const scopeOptions = useMemo(
    () => SCOPE_FILTERS.map((s) => ({ value: s, label: t(`scopes.${s}`) })),
    [t],
  );

  const openCreate = useCallback(() => {
    setEditTarget(undefined); setCreateSeed(undefined); setEditorOpen(true);
  }, []);
  const openEdit = useCallback((m: BimMaterial) => {
    setEditTarget(m); setCreateSeed(undefined); setEditorOpen(true);
  }, []);
  const openDuplicate = useCallback((entry: LibraryEntry) => {
    setEditTarget(undefined); setCreateSeed(duplicateSeed(entry)); setEditorOpen(true);
  }, []);
  const closeEditor = useCallback(() => setEditorOpen(false), []);

  const handleSave = useCallback(async (
    payload: SaveBimMaterialInput | UpdateBimMaterialPatch,
    mode: 'create' | 'edit',
    pendingThumbnail?: File | null,
    pendingPbr?: PendingPbrUpload | null,
  ) => {
    await persistMaterialFromEditor(
      { companyId, save, update }, payload, mode, editTarget?.id, pendingThumbnail, pendingPbr,
    );
    setEditorOpen(false);
  }, [save, update, editTarget, companyId]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await remove(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, remove]);

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

      <LibraryFilterBar
        value={filter}
        onChange={setFilter}
        searchPlaceholder={t('list.searchPlaceholder')}
        categories={categoryOptions}
        allCategoriesLabel={t('list.allCategories')}
        scopes={scopeOptions}
        allScopesLabel={t('scopes.all')}
        ariaLabel={t('list.filtersAriaLabel')}
      />

      <main className="flex flex-col gap-1 overflow-y-auto flex-1 min-h-0">
        {loading && (
          <p className={`text-xs ${colors.text.muted} text-center py-4`}>
            {t('list.loading')}
          </p>
        )}
        {!loading && filtered.length === 0 && (
          <aside className={`text-xs ${colors.text.muted} text-center py-6 flex flex-col gap-1`}>
            <p>{t('list.emptyList')}</p>
          </aside>
        )}
        {filtered.map((entry) => (
          <MaterialCard
            key={entry.id}
            entry={entry}
            onEdit={openEdit}
            onDuplicate={openDuplicate}
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
        seed={createSeed}
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
  entry: LibraryEntry;
  onEdit: (m: BimMaterial) => void;
  onDuplicate: (entry: LibraryEntry) => void;
  onDelete: (m: BimMaterial) => void;
  t: (k: string, opts?: Record<string, string>) => string;
  colors: ReturnType<typeof useSemanticColors>;
}

/** Badge class + i18n key ανά πηγή/scope της εγγραφής. */
function sourceBadge(
  entry: LibraryEntry,
  colors: ReturnType<typeof useSemanticColors>,
): { className: string; labelKey: string } {
  if (entry.source === 'catalog') return { className: `bg-muted ${colors.text.muted}`, labelKey: 'list.catalogBadge' };
  if (entry.source === 'paint') return { className: `bg-muted ${colors.text.muted}`, labelKey: 'list.paintBadge' };
  switch (entry.scope) {
    case 'company': return { className: `${colors.bg.infoSubtle} ${colors.text.info}`, labelKey: 'list.companyBadge' };
    case 'project': return { className: `${colors.bg.successSubtle} ${colors.text.success}`, labelKey: 'list.projectBadge' };
    default: return { className: `bg-muted ${colors.text.muted}`, labelKey: 'list.systemBadge' };
  }
}

function MaterialCard({ entry, onEdit, onDuplicate, onDelete, t, colors }: MaterialCardProps) {
  const isUser = entry.source === 'user';
  const readOnly = !entry.editable;
  const badge = sourceBadge(entry, colors);
  // Captured const → narrows into the delete-button closure without a non-null assertion.
  const deletableMat = entry.deletable ? entry.bimMaterial : undefined;

  const handleClick = () => {
    if (isUser && entry.bimMaterial) onEdit(entry.bimMaterial);
    else onDuplicate(entry);
  };

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(BIM_MATERIAL_MIME, serializeFaceAppearanceDrag(entry.apply));
        e.dataTransfer.effectAllowed = 'copy';
      }}
      className={[
        'flex flex-col gap-0.5 px-2 py-1.5 rounded cursor-grab active:cursor-grabbing transition-colors',
        readOnly ? `${colors.bg.secondary} opacity-80` : `${colors.bg.secondary} hover:${colors.bg.hover}`,
      ].join(' ')}
      onClick={handleClick}
      aria-label={t('list.cardAriaLabel', { name: entry.label })}
    >
      <header className="flex items-center gap-2">
        {/* ADR-687 Φ8 (Giorgio 2026-07-24) — μεγάλες μικρογραφίες (Revit Material Browser): 64px,
            αρκετά μεγαλύτερες από τα 36px της κάτω μπάρας «Υλικά όψης». */}
        <MaterialSwatch
          sphere
          materialId={entry.materialId}
          category={entry.category}
          thumbnailUrl={entry.thumbnailUrl}
          albedoUrl={entry.albedoUrl}
          appearance={entry.appearance}
          color={entry.color}
          className="!h-16 !w-16 rounded-md"
        />
        <span className={`text-xs font-medium truncate flex-1 ${colors.text.primary}`}>{entry.label}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${badge.className}`}>
          {t(badge.labelKey)}
        </span>
      </header>
      <footer className="flex items-center gap-2 justify-between">
        <span className={`text-[10px] ${colors.text.muted} truncate`}>
          {entry.category ? t(`categories.${entry.category}`) : t(badge.labelKey)}
          {entry.bimMaterial?.density != null && ` · ${entry.bimMaterial.density} kg/m³`}
        </span>
        {deletableMat && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(deletableMat); }}
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
