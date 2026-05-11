/**
 * ADR-344 Phase 7.D — Delete confirmation modal (Q3 → option α).
 *
 * Radix AlertDialog with the cancel button as the default focus to make a
 * mis-click safe (industry pattern: Figma, Linear, Notion, Vercel).
 * Optimistic delete happens at the call site (the mutation hook); this
 * dialog only confirms intent.
 */
'use client';

import React, { useState } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useTranslation } from '@/i18n';
import type { TextTemplate } from '@/subapps/dxf-viewer/text-engine/templates';

interface DeleteDialogProps {
  readonly open: boolean;
  readonly target: TextTemplate | null;
  readonly onOpenChange: (next: boolean) => void;
  readonly onConfirm: (target: TextTemplate) => Promise<void>;
}

export const TextTemplateDeleteDialog: React.FC<DeleteDialogProps> = ({
  open,
  target,
  onOpenChange,
  onConfirm,
}) => {
  const { t } = useTranslation(['textTemplates']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!target) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(target);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog.Root open={open && target !== null} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40 z-[60]" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] w-[min(420px,92vw)] bg-white dark:bg-zinc-950 rounded shadow-xl p-4 flex flex-col gap-3">
          <AlertDialog.Title className="text-base font-semibold">
            {t('textTemplates:manager.deletePrompt.title', { name: target?.name ?? '' })}
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-zinc-600 dark:text-zinc-400">
            {t('textTemplates:manager.deletePrompt.body')}
          </AlertDialog.Description>
          {error ? (
            <p className="text-xs text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <footer className="flex items-center justify-end gap-2 mt-1">
            <AlertDialog.Cancel asChild>
              <button
                type="button"
                autoFocus
                disabled={submitting}
                className="text-sm px-3 py-1.5 rounded border"
              >
                {t('textTemplates:manager.deletePrompt.cancel')}
              </button>
            </AlertDialog.Cancel>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleConfirm()}
              className="text-sm px-3 py-1.5 rounded bg-red-600 text-white disabled:opacity-50"
            >
              {submitting
                ? t('textTemplates:manager.deletePrompt.deleting')
                : t('textTemplates:manager.deletePrompt.confirm')}
            </button>
          </footer>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};
