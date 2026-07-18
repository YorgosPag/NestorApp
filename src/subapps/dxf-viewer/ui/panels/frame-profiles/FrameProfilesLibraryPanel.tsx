'use client';

/**
 * ADR-676 Phase 3 PILOT — Floating panel "Κάσες" (opening frame-profile user
 * library). Mirrors `MaterialsLibraryPanel.tsx` (ADR-363 §6.5.B) structure:
 * <section><header><LibraryFilterBar><main> cards + Radix AlertDialog
 * delete-confirm. List + inline rename + delete only — creation happens via
 * the ribbon "Αποθήκευση ως δικό μου" / "Duplicate & edit" widget
 * (`opening-frame-profile-library-widget.tsx`), so there is no editor
 * dialog here (unlike the materials panel).
 *
 * The shared `LibraryFilterBar` category slot carries the *scope* options
 * (user/company/project) — this pilot has no second dimension (e.g. role)
 * to filter by yet, so the dedicated `scopes` chip row is left unused.
 *
 * @see ../../ribbon/hooks/useOpeningFrameProfileLibrary.ts — the data hook
 * @see ../materials/MaterialsLibraryPanel.tsx — structural mirror
 * @see ../shared/LibraryFilterBar.tsx / ../shared/library-filter.ts
 * @see docs/centralized-systems/reference/adrs/ADR-676-opening-component-library.md
 */

import React, { useCallback, useMemo, useState } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useTranslation } from '@/i18n';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useAuth } from '@/auth/hooks/useAuth';
import { useCompanyId } from '@/hooks/useCompanyId';
import { LibraryFilterBar } from '../shared/LibraryFilterBar';
import {
  EMPTY_LIBRARY_FILTER,
  matchesLibraryFilter,
  type LibraryFilterState,
} from '../shared/library-filter';
import { useOpeningFrameProfileLibrary } from '../../ribbon/hooks/useOpeningFrameProfileLibrary';
import type { OpeningFrameProfilePresetDoc } from '../../../bim/types/opening-frame-profile';
import { FrameProfileCard } from './FrameProfileCard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FrameProfilesLibraryPanelProps {
  projectId?: string;
}

const SCOPES: readonly string[] = ['user', 'company', 'project'];

function scopeLabelKey(scope: string): string {
  switch (scope) {
    case 'company': return 'panels.frameProfiles.scopeCompany';
    case 'project': return 'panels.frameProfiles.scopeProject';
    default: return 'panels.frameProfiles.scopeUser';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FrameProfilesLibraryPanel({ projectId }: FrameProfilesLibraryPanelProps) {
  const { t } = useTranslation('dxf-viewer-panels');
  const colors = useSemanticColors();
  const { user } = useAuth();
  const companyResult = useCompanyId();
  const companyId = companyResult?.companyId;
  const userId = user?.uid;

  const { profiles, loading, update, remove } = useOpeningFrameProfileLibrary({
    companyId,
    userId,
    projectId,
  });

  const [filter, setFilter] = useState<LibraryFilterState>(EMPTY_LIBRARY_FILTER);
  const [deleteTarget, setDeleteTarget] = useState<OpeningFrameProfilePresetDoc | null>(null);

  const filtered = useMemo(
    () =>
      profiles.filter((p) =>
        matchesLibraryFilter({ names: [p.name], category: p.scope, scope: p.scope }, filter),
      ),
    [profiles, filter],
  );

  const scopeOptions = useMemo(
    () => SCOPES.map((s) => ({ value: s, label: t(scopeLabelKey(s)) })),
    [t],
  );

  const handleRename = useCallback(
    (id: string, name: string) => update(id, { name }),
    [update],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await remove(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, remove]);

  return (
    <section aria-label={t('panels.frameProfiles.title')} className="flex flex-col gap-2 h-full">
      <header className="flex items-center justify-between gap-1">
        <h3 className={`text-xs font-semibold uppercase tracking-wide ${colors.text.muted}`}>
          {t('panels.frameProfiles.title')}
        </h3>
      </header>

      <LibraryFilterBar
        value={filter}
        onChange={setFilter}
        searchPlaceholder={t('panels.frameProfiles.filter.search')}
        categories={scopeOptions}
        allCategoriesLabel={t('panels.frameProfiles.filter.allScopes')}
        ariaLabel={t('panels.frameProfiles.title')}
      />

      <main aria-busy={loading} className="flex flex-col gap-1 overflow-y-auto flex-1 min-h-0">
        {!loading && filtered.length === 0 && (
          <aside className={`text-xs ${colors.text.muted} text-center py-6`}>
            <p>{t('panels.frameProfiles.empty')}</p>
          </aside>
        )}
        {filtered.map((p) => (
          <FrameProfileCard
            key={p.id}
            profile={p}
            onRename={handleRename}
            onDelete={setDeleteTarget}
            t={t}
            colors={colors}
          />
        ))}
      </main>

      <DeleteConfirmDialog
        target={deleteTarget}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        t={t}
      />
    </section>
  );
}

// ─── DeleteConfirmDialog ──────────────────────────────────────────────────────

interface DeleteConfirmProps {
  target: OpeningFrameProfilePresetDoc | null;
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
            {t('panels.frameProfiles.delete.title')}
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-muted-foreground">
            {t('panels.frameProfiles.delete.description', { name: target?.name ?? '' })}
          </AlertDialog.Description>
          <footer className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <button type="button" className="px-3 py-1.5 text-sm rounded border hover:bg-accent" onClick={onCancel}>
                {t('panels.frameProfiles.cancel')}
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                type="button"
                className="px-3 py-1.5 text-sm rounded bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={onConfirm}
                aria-label={t('panels.frameProfiles.delete.confirm')}
              >
                {t('panels.frameProfiles.delete.confirm')}
              </button>
            </AlertDialog.Action>
          </footer>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
