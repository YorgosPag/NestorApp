/**
 * ADR-344 Phase 7.D — Top-level text-template manager.
 *
 * Composes the four leaves (`TextTemplateList`, `TextTemplatePreview`,
 * `TextTemplateEditorDialog`, `TextTemplateDeleteDialog`) and orchestrates
 * the data hooks. Built-ins are imported synchronously; user templates
 * fetched via REST. CRUD goes through the optimistic mutations hook so
 * row updates feel instant (N.7 Google).
 *
 * Permission gating: `useCanEditText()` (Phase 5.B) hands us the
 * capability matrix. Buttons are visible but disabled when the user lacks
 * the matching capability (Q4 → show + disabled + tooltip).
 */
'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n';
import { useUserRole } from '@/auth/contexts/UserRoleContext';
import { useCanEditText } from '@/subapps/dxf-viewer/hooks/useCanEditText';
import type {
  TextTemplate,
  TextTemplateCategory,
} from '@/subapps/dxf-viewer/text-engine/templates';
import { TextTemplateList } from './TextTemplateList';
import { TextTemplatePreview } from './preview/TextTemplatePreview';
import { TextTemplateEditorDialog } from './editor/TextTemplateEditorDialog';
import { TextTemplateDeleteDialog } from './TextTemplateDeleteDialog';
import { useTextTemplates } from './hooks/useTextTemplates';
import {
  useTextTemplateMutations,
  type CreateTemplateInput,
  type UpdateTemplatePatch,
} from './hooks/useTextTemplateMutations';
import { useTextTemplatePreviewScope } from './hooks/useTextTemplatePreviewScope';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ManagerProps {
  readonly previewLocale?: 'el' | 'en';
}

type CategoryFilter = TextTemplateCategory | 'all';

export const TextTemplateManager: React.FC<ManagerProps> = ({ previewLocale = 'el' }) => {
  const { t } = useTranslation(['textTemplates']);
  const { user } = useUserRole();
  const companyId = user?.companyId ?? null;
  const capabilities = useCanEditText();
  const scope = useTextTemplatePreviewScope(previewLocale);

  const { builtIn, user: userTemplates, all, loading, error, refresh, setUserTemplatesLocal } =
    useTextTemplates(companyId);
  const mutations = useTextTemplateMutations({
    userTemplates,
    setUserTemplates: setUserTemplatesLocal,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ open: boolean; seed: TextTemplate | null }>({
    open: false,
    seed: null,
  });
  const [deleteTarget, setDeleteTarget] = useState<TextTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  const selected = useMemo(
    () => all.find((tpl) => tpl.id === selectedId) ?? null,
    [all, selectedId],
  );

  const openCreate = useCallback(() => setEditor({ open: true, seed: null }), []);
  const openEdit = useCallback((tpl: TextTemplate) => setEditor({ open: true, seed: tpl }), []);
  const closeEditor = useCallback(() => setEditor({ open: false, seed: null }), []);

  const handleSubmit = useCallback(
    async (payload: {
      readonly name: string;
      readonly category: TextTemplateCategory;
      readonly content: TextTemplate['content'];
      readonly contentChanged: boolean;
    }) => {
      if (editor.seed && !editor.seed.isDefault) {
        const patch: UpdateTemplatePatch = {};
        if (payload.name !== editor.seed.name) patch.name = payload.name;
        if (payload.category !== editor.seed.category) patch.category = payload.category;
        if (payload.contentChanged) patch.content = payload.content;
        if (Object.keys(patch).length === 0) return;
        await mutations.updateTemplate(editor.seed.id, patch);
        return;
      }
      const input: CreateTemplateInput = {
        name: payload.name,
        category: payload.category,
        content: payload.content,
      };
      const persisted = await mutations.createTemplate(input);
      setSelectedId(persisted.id);
    },
    [editor.seed, mutations],
  );

  const handleDuplicate = useCallback(
    async (tpl: TextTemplate) => {
      const dup = await mutations.duplicateTemplate(tpl);
      setSelectedId(dup.id);
    },
    [mutations],
  );

  const handleDeleteConfirm = useCallback(
    async (target: TextTemplate) => {
      await mutations.deleteTemplate(target.id);
      if (selectedId === target.id) setSelectedId(null);
    },
    [mutations, selectedId],
  );

  return (
    <article aria-label={t('textTemplates:manager.ariaLabel')} className="tt-manager flex flex-col h-full bg-white dark:bg-zinc-950">
      <header className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">{t('textTemplates:manager.title')}</h2>
        <span className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => void refresh()}
                className="text-xs px-2 py-1 rounded border"
              >
                {t('textTemplates:manager.refresh')}
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('textTemplates:manager.refresh')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled={!capabilities.canCreate}
                onClick={openCreate}
                className="text-xs px-2 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
              >
                {t('textTemplates:manager.newButton')}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {capabilities.canCreate
                ? t('textTemplates:manager.newButton')
                : t('textTemplates:manager.permission.requiresRole')}
            </TooltipContent>
          </Tooltip>
        </span>
      </header>

      {error ? (
        <p role="alert" className="text-xs text-red-700 px-3 py-1">
          {error}
        </p>
      ) : null}

      <section className="flex flex-1 min-h-0">
        <TextTemplateList
          builtIn={builtIn}
          user={userTemplates}
          selectedId={selectedId}
          onSelect={(tpl) => setSelectedId(tpl.id)}
          onDuplicate={(tpl) => void handleDuplicate(tpl)}
          onEdit={openEdit}
          onDelete={(tpl) => setDeleteTarget(tpl)}
          capabilities={capabilities}
          loading={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
        />
        <section
          aria-label={t('textTemplates:manager.previewAriaLabel')}
          className="flex-1 min-w-0 p-3 flex flex-col gap-2"
        >
          <header className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {selected
                ? selected.name
                : t('textTemplates:manager.previewEmptyTitle')}
            </h3>
            {selected ? (
              <span className="text-[11px] text-zinc-500">
                {t(`textTemplates:manager.category.${selected.category}`)} ·{' '}
                {t('textTemplates:manager.placeholdersCount', {
                  count: selected.placeholders.length,
                })}
              </span>
            ) : null}
          </header>
          <div className="flex-1 min-h-0 border border-zinc-200 dark:border-zinc-800 rounded">
            <TextTemplatePreview
              template={selected}
              scope={scope}
              emptyLabel={t('textTemplates:manager.previewEmptyLabel')}
            />
          </div>
        </section>
      </section>

      <TextTemplateEditorDialog
        open={editor.open}
        onOpenChange={(v) => (v ? null : closeEditor())}
        seed={editor.seed}
        onSubmit={handleSubmit}
        previewLocale={previewLocale}
      />
      <TextTemplateDeleteDialog
        open={deleteTarget !== null}
        target={deleteTarget}
        onOpenChange={(v) => (v ? null : setDeleteTarget(null))}
        onConfirm={handleDeleteConfirm}
      />
    </article>
  );
};
