/**
 * ADR-344 Phase 8 — Custom dictionary Manager (Q6 industry standard:
 * Word / Google Docs / AutoCAD / VS Code all ship a Manager UI).
 *
 * Composes the three leaves (`CustomDictionaryList`,
 * `CustomDictionaryEditorDialog`, `CustomDictionaryDeleteDialog`) and
 * orchestrates the data hooks. Action buttons are visible-but-disabled
 * for non-admin users (Q4 pattern → show + disabled + tooltip).
 *
 * Permission gating:
 *   - VIEW (list)  → any tenant member (`dxf:dictionary:view`)
 *   - CREATE       → anyone with `dxf:text:edit` (low bar — small action)
 *   - EDIT / DELETE → `dxf:dictionary:manage` (admin-only)
 *
 * Mirrors role check in `text-edit-capabilities.ts`: admin-tier roles
 * (super_admin / admin / company_admin) can manage; everyone else can
 * still add their own terms via the editor dialog but cannot edit /
 * delete entries created by colleagues.
 */
'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n';
import { useUserRole } from '@/auth/contexts/UserRoleContext';
import { useCanEditText } from '@/subapps/dxf-viewer/hooks/useCanEditText';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { SerializedCustomDictionaryEntry } from '@/app/api/dxf/custom-dictionary/_helpers';
import { CustomDictionaryList } from './CustomDictionaryList';
import { CustomDictionaryEditorDialog } from './CustomDictionaryEditorDialog';
import { CustomDictionaryDeleteDialog } from './CustomDictionaryDeleteDialog';
import {
  useCustomDictionary,
  useCustomDictionaryMutations,
} from './hooks/useCustomDictionary';

const ADMIN_ROLES = new Set(['super_admin', 'admin', 'company_admin']);

export const CustomDictionaryManager: React.FC = () => {
  const { t } = useTranslation(['textSpell']);
  const { user } = useUserRole();
  const companyId = user?.companyId ?? null;
  const role = user?.role ?? null;
  const capabilities = useCanEditText();
  const canManage = role !== null && ADMIN_ROLES.has(role);
  const canCreate = capabilities.canEdit;

  const { entries, loading, error, refresh, setEntriesLocal } = useCustomDictionary(companyId);
  const mutations = useCustomDictionaryMutations({ entries, setEntries: setEntriesLocal });

  const [editor, setEditor] = useState<{
    open: boolean;
    seed: SerializedCustomDictionaryEntry | null;
  }>({ open: false, seed: null });
  const [deleteTarget, setDeleteTarget] = useState<SerializedCustomDictionaryEntry | null>(null);

  const openCreate = useCallback(() => setEditor({ open: true, seed: null }), []);
  const openEdit = useCallback(
    (entry: SerializedCustomDictionaryEntry) => setEditor({ open: true, seed: entry }),
    [],
  );
  const closeEditor = useCallback(() => setEditor({ open: false, seed: null }), []);
  const openDelete = useCallback(
    (entry: SerializedCustomDictionaryEntry) => setDeleteTarget(entry),
    [],
  );
  const closeDelete = useCallback(() => setDeleteTarget(null), []);

  const handleSubmit = useCallback(
    async (payload: { term: string; language: SerializedCustomDictionaryEntry['language'] }) => {
      if (editor.seed) {
        const patch: { term?: string; language?: SerializedCustomDictionaryEntry['language'] } = {};
        if (payload.term !== editor.seed.term) patch.term = payload.term;
        if (payload.language !== editor.seed.language) patch.language = payload.language;
        if (Object.keys(patch).length === 0) return;
        await mutations.update(editor.seed.id, patch);
        return;
      }
      await mutations.create(payload);
    },
    [editor.seed, mutations],
  );

  const handleDeleteConfirm = useCallback(
    async (target: SerializedCustomDictionaryEntry) => {
      await mutations.remove(target.id);
    },
    [mutations],
  );

  const addButton = useMemo(() => {
    const disabled = !canCreate || companyId === null;
    const button = (
      <button
        type="button"
        disabled={disabled}
        onClick={openCreate}
        className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-50"
      >
        {t('textSpell:manager.addButton')}
      </button>
    );
    if (!canCreate && capabilities.denyReason) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{button}</span>
            </TooltipTrigger>
            <TooltipContent>{t(capabilities.denyReason)}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return button;
  }, [canCreate, capabilities.denyReason, companyId, openCreate, t]);

  return (
    <main className="flex flex-col gap-4 p-4">
      <header className="flex items-end justify-between gap-2">
        <hgroup className="flex flex-col">
          <h1 className="text-lg font-semibold">{t('textSpell:manager.title')}</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t('textSpell:manager.subtitle')}
          </p>
        </hgroup>
        {addButton}
      </header>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error.message}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500">…</p>
      ) : (
        <CustomDictionaryList
          entries={entries}
          canManage={canManage}
          onEdit={openEdit}
          onDelete={openDelete}
        />
      )}

      {companyId !== null ? (
        <CustomDictionaryEditorDialog
          open={editor.open}
          seed={editor.seed}
          companyId={companyId}
          onOpenChange={(next) => (next ? null : closeEditor())}
          onSubmit={async (payload) => {
            await handleSubmit(payload);
            await refresh();
          }}
        />
      ) : null}

      <CustomDictionaryDeleteDialog
        open={deleteTarget !== null}
        target={deleteTarget}
        onOpenChange={(next) => (next ? null : closeDelete())}
        onConfirm={handleDeleteConfirm}
      />
    </main>
  );
};
