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
 * ADR-801 Φάση 3 — και οι δύο ερωτήσεις πάνε στον **ΕΝΑ** κριτή
 * (`lib/auth/authority.ts`) μέσω του PEP `useCapability`.
 *
 * 🔴 Μέχρι 2026-08-25 εδώ ζούσε `ADMIN_ROLES = new Set(['super_admin',
 * 'admin', 'company_admin'])`, κρινόμενο πάνω στο `useUserRole().user.role` —
 * τιμή με **τρεις** μόνο δυνατές καταστάσεις (`'admin'`·`'authenticated'`·
 * `'public'`) που παράγεται από **λίστα email**. Δηλαδή τα `'super_admin'` και
 * `'company_admin'` του συνόλου **δεν μπορούσαν να πυροδοτήσουν ποτέ**, και
 * διαχειριστής εκτός της λίστας email έπαιρνε άρνηση σιωπηλά.
 */
'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n';
import { useAuth } from '@/auth/hooks/useAuth';
import { useCapability } from '@/auth/hooks/useCapability';
import { useCanEditText } from '@/subapps/dxf-viewer/hooks/useCanEditText';
import { isGranted } from '@/types/capability-authority';
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

export const CustomDictionaryManager: React.FC = () => {
  // ⚠️ Το `auth` δηλώνεται ρητά: ο `denyReason` είναι κλειδί **εκείνου** του
  //    namespace (`auth:capability.denyReason.*`) και χωρίς τη δήλωση θα
  //    έβγαινε ωμό στην οθόνη (CHECK 3.34 / 3.51).
  const { t } = useTranslation(['textSpell', 'auth']);
  const { user } = useAuth();
  const companyId = user?.companyId ?? null;
  const capabilities = useCanEditText();
  const manageGate = useCapability('dxf:dictionary:manage');
  const canManage = isGranted(manageGate.verdict);
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
        className="text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50"
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
          <p className="text-sm text-muted-foreground">
            {t('textSpell:manager.subtitle')}
          </p>
        </hgroup>
        {addButton}
      </header>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error.message}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">…</p>
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
