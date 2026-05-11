/**
 * ADR-344 Phase 7.D — Create / edit dialog for user text templates.
 *
 * Radix Dialog (ADR-001 — never EnterpriseComboBox). Layout:
 *   ┌── header ─────────────────────────────┐
 *   │ Title + Close                         │
 *   ├── body ───────────────────────────────┤
 *   │  ┌── form ──────────┐ ┌── preview ──┐ │
 *   │  │ name             │ │ canvas      │ │
 *   │  │ category (Select)│ │             │ │
 *   │  │ content textarea │ │             │ │
 *   │  │ unknown chips    │ │             │ │
 *   │  └──────────────────┘ └─────────────┘ │
 *   │             ┌── placeholder picker ─┐ │
 *   ├── footer ─────────────────────────────┤
 *   │ Cancel | Submit                        │
 *   └────────────────────────────────────────┘
 *
 * Validation is client-side first (empty name / over-long name / empty
 * content); server-side Zod is the authoritative gate (Phase 7.B). Unknown
 * placeholders are surfaced as warning chips, not errors — the resolver
 * leaves them as literals so the architect can see and fix them.
 */
'use client';

import React, { useCallback, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useTranslation } from '@/i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TEXT_TEMPLATE_NAME_MAX,
  type TextTemplate,
  type TextTemplateCategory,
} from '@/subapps/dxf-viewer/text-engine/templates';
import { TextTemplatePreview } from '../preview/TextTemplatePreview';
import { useTextTemplatePreviewScope } from '../hooks/useTextTemplatePreviewScope';
import { PlaceholderPicker } from '../PlaceholderPicker';
import { useEditorState } from './useEditorState';

const CATEGORIES: readonly TextTemplateCategory[] = [
  'title-block',
  'stamp',
  'revision',
  'notes',
  'scale-bar',
  'custom',
];

export interface EditorSubmissionPayload {
  readonly name: string;
  readonly category: TextTemplateCategory;
  readonly content: ReturnType<ReturnType<typeof useEditorState>['buildSubmissionContent']>;
  readonly contentChanged: boolean;
}

interface EditorDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (next: boolean) => void;
  /** `null` → create flow. */
  readonly seed: TextTemplate | null;
  readonly onSubmit: (payload: EditorSubmissionPayload) => Promise<void>;
  readonly previewLocale?: 'el' | 'en';
}

export const TextTemplateEditorDialog: React.FC<EditorDialogProps> = ({
  open,
  onOpenChange,
  seed,
  onSubmit,
  previewLocale = 'el',
}) => {
  const { t } = useTranslation(['textTemplates']);
  const scope = useTextTemplatePreviewScope(previewLocale);
  const state = useEditorState({ seed, open });
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    if (state.isDirty && !window.confirm(t('textTemplates:editor.dirtyConfirm'))) return;
    onOpenChange(false);
  }, [state.isDirty, onOpenChange, t]);

  const handleSubmit = useCallback(async () => {
    if (state.nameError || state.contentError) return;
    setSubmitting(true);
    setServerError(null);
    try {
      await onSubmit({
        name: state.name.trim(),
        category: state.category,
        content: state.buildSubmissionContent(),
        contentChanged: state.contentChanged,
      });
      onOpenChange(false);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }, [state, onSubmit, onOpenChange]);

  const previewTemplate: TextTemplate = {
    id: seed?.id ?? 'preview',
    companyId: seed?.companyId ?? null,
    name: state.name || t('textTemplates:editor.previewPlaceholderName'),
    category: state.category,
    content: state.buildSubmissionContent(),
    placeholders: [],
    isDefault: false,
    createdAt: seed?.createdAt ?? null,
    updatedAt: seed?.updatedAt ?? null,
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-[60]" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] w-[min(1100px,95vw)] max-h-[90vh] overflow-hidden bg-white dark:bg-zinc-950 rounded shadow-xl flex flex-col"
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            handleClose();
          }}
          onPointerDownOutside={(e) => {
            e.preventDefault();
            handleClose();
          }}
        >
          <Dialog.Title className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 text-base font-semibold">
            {seed ? t('textTemplates:editor.title.edit') : t('textTemplates:editor.title.create')}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            {seed ? t('textTemplates:editor.title.edit') : t('textTemplates:editor.title.create')}
          </Dialog.Description>

          <section className="flex flex-1 min-h-0 overflow-hidden">
            <form
              className="flex-1 flex flex-col gap-3 p-4 overflow-auto"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSubmit();
              }}
            >
              <label className="flex flex-col gap-1 text-sm">
                <span>{t('textTemplates:editor.name.label')}</span>
                <input
                  type="text"
                  value={state.name}
                  onChange={(e) => state.setName(e.target.value)}
                  placeholder={t('textTemplates:editor.name.placeholder')}
                  maxLength={TEXT_TEMPLATE_NAME_MAX}
                  className="rounded border px-2 py-1"
                />
                {state.nameError ? (
                  <span className="text-xs text-red-600">
                    {t(`textTemplates:editor.name.error.${state.nameError}`, {
                      max: TEXT_TEMPLATE_NAME_MAX,
                    })}
                  </span>
                ) : null}
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span>{t('textTemplates:editor.category.label')}</span>
                <Select
                  value={state.category}
                  onValueChange={(v) => state.setCategory(v as TextTemplateCategory)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {t(`textTemplates:manager.category.${c}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="flex flex-col gap-1 text-sm flex-1 min-h-0">
                <span>{t('textTemplates:editor.content.label')}</span>
                <textarea
                  ref={state.textareaRef}
                  value={state.contentText}
                  onChange={(e) => state.setContentText(e.target.value)}
                  className="rounded border px-2 py-1 font-mono text-xs min-h-[160px] flex-1"
                />
                {state.contentError ? (
                  <span className="text-xs text-red-600">
                    {t(`textTemplates:editor.content.error.${state.contentError}`)}
                  </span>
                ) : null}
                {state.unknownPlaceholders.length > 0 ? (
                  <span className="text-xs text-amber-700">
                    {t('textTemplates:editor.content.helpUnknown', {
                      tokens: state.unknownPlaceholders.join(', '),
                    })}
                  </span>
                ) : null}
              </label>

              {serverError ? (
                <p className="text-xs text-red-700" role="alert">
                  {serverError}
                </p>
              ) : null}
            </form>

            <aside aria-label={t('textTemplates:editor.previewAriaLabel')} className="w-[360px] shrink-0 border-l border-zinc-200 dark:border-zinc-800 flex flex-col">
              <h4 className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                {t('textTemplates:editor.previewAriaLabel')}
              </h4>
              <div className="flex-1 min-h-0">
                <TextTemplatePreview template={previewTemplate} scope={scope} />
              </div>
            </aside>

            <PlaceholderPicker onInsert={state.insertAtCaret} />
          </section>

          <footer className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-end gap-2">
            <button
              type="button"
              className="text-sm px-3 py-1.5 rounded border"
              onClick={handleClose}
              disabled={submitting}
            >
              {t('textTemplates:editor.cancel')}
            </button>
            <button
              type="button"
              className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-50"
              onClick={() => void handleSubmit()}
              disabled={submitting || state.nameError !== null || state.contentError !== null}
            >
              {submitting ? t('textTemplates:editor.submitting') : t('textTemplates:editor.submit')}
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
