/**
 * ADR-344 Phase 8 — Delete confirmation modal for custom dictionary entries.
 *
 * Radix AlertDialog with the cancel button as default focus to make a
 * mis-click safe (industry pattern: Figma, Linear, Notion, Vercel).
 * Optimistic delete happens at the call site (mutation hook); this dialog
 * only confirms intent.
 */
'use client';

import React, { useState } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useTranslation } from '@/i18n';
import type { SerializedCustomDictionaryEntry } from '@/app/api/dxf/custom-dictionary/_helpers';

interface DeleteDialogProps {
  readonly open: boolean;
  readonly target: SerializedCustomDictionaryEntry | null;
  readonly onOpenChange: (next: boolean) => void;
  readonly onConfirm: (target: SerializedCustomDictionaryEntry) => Promise<void>;
}

export const CustomDictionaryDeleteDialog: React.FC<DeleteDialogProps> = ({
  open,
  target,
  onOpenChange,
  onConfirm,
}) => {
  const { t } = useTranslation(['textSpell']);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!target) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(target);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('textSpell:errors.generic'));
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
            {t('textSpell:deleteDialog.title')}
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-zinc-600 dark:text-zinc-400">
            {t('textSpell:deleteDialog.message', { term: target?.term ?? '' })}
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
                {t('textSpell:deleteDialog.cancel')}
              </button>
            </AlertDialog.Cancel>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleConfirm()}
              className="text-sm px-3 py-1.5 rounded bg-red-600 text-white disabled:opacity-50"
            >
              {t('textSpell:deleteDialog.confirm')}
            </button>
          </footer>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};
