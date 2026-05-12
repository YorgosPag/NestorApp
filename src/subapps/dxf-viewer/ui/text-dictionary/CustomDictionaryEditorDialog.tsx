/**
 * ADR-344 Phase 8 — Add / edit dialog for a single custom dictionary entry.
 *
 * Radix Dialog + Radix Select. Validation mirrors the server-side Zod
 * (term: 1-80 chars, no whitespace) so the user sees inline feedback
 * before the round-trip. Submission feedback (duplicate / network) comes
 * back from the mutation hook.
 */
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
import { useTranslation } from '@/i18n';
import type { SpellLanguage } from '@/subapps/dxf-viewer/text-engine/spell';
import {
  CUSTOM_DICTIONARY_TERM_MAX,
  createCustomDictionaryEntryInputSchema,
} from '@/subapps/dxf-viewer/text-engine/spell/custom-dictionary.zod';
import type { SerializedCustomDictionaryEntry } from '@/app/api/dxf/custom-dictionary/_helpers';

interface EditorDialogProps {
  readonly open: boolean;
  readonly seed: SerializedCustomDictionaryEntry | null;
  readonly companyId: string;
  readonly onOpenChange: (next: boolean) => void;
  readonly onSubmit: (payload: { term: string; language: SpellLanguage }) => Promise<void>;
}

const LANGUAGES: readonly SpellLanguage[] = ['el', 'en'] as const;

export const CustomDictionaryEditorDialog: React.FC<EditorDialogProps> = ({
  open,
  seed,
  companyId,
  onOpenChange,
  onSubmit,
}) => {
  const { t } = useTranslation(['textSpell']);
  const [term, setTerm] = useState<string>('');
  const [language, setLanguage] = useState<SpellLanguage>('el');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTerm(seed?.term ?? '');
      setLanguage(seed?.language ?? 'el');
      setError(null);
    }
  }, [open, seed]);

  const validate = useCallback((): string | null => {
    const result = createCustomDictionaryEntryInputSchema.safeParse({
      companyId,
      term,
      language,
    });
    if (result.success) return null;
    const first = result.error.issues[0];
    if (!first) return t('textSpell:errors.generic');
    if (first.path.join('.') === 'term') {
      if (term.trim().length === 0) return t('textSpell:validation.termEmpty');
      if (term.length > CUSTOM_DICTIONARY_TERM_MAX) {
        return t('textSpell:validation.termTooLong', { max: CUSTOM_DICTIONARY_TERM_MAX });
      }
      if (term !== term.trim()) return t('textSpell:validation.termHasLeadingOrTrailingWhitespace');
      if (/\s/.test(term)) return t('textSpell:validation.termHasWhitespace');
    }
    return first.message;
  }, [companyId, term, language, t]);

  const handleSubmit = useCallback(async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ term, language });
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('textSpell:errors.generic');
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [validate, onSubmit, onOpenChange, term, language, t]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-[60]" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] w-[min(440px,92vw)] bg-white dark:bg-zinc-950 rounded shadow-xl p-4 flex flex-col gap-3"
          onEscapeKeyDown={() => onOpenChange(false)}
        >
          <Dialog.Title className="text-base font-semibold">
            {seed ? t('textSpell:editorDialog.editTitle') : t('textSpell:editorDialog.addTitle')}
          </Dialog.Title>

          <label className="flex flex-col gap-1 text-sm">
            <span>{t('textSpell:editorDialog.termLabel')}</span>
            <input
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={t('textSpell:editorDialog.termPlaceholder')}
              maxLength={CUSTOM_DICTIONARY_TERM_MAX}
              autoFocus
              className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-zinc-500">{t('textSpell:editorDialog.termHint')}</span>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span>{t('textSpell:editorDialog.languageLabel')}</span>
            <Select.Root value={language} onValueChange={(v) => setLanguage(v as SpellLanguage)}>
              <Select.Trigger className="inline-flex items-center justify-between border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <Select.Value />
                <Select.Icon>▾</Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content
                  position="popper"
                  className="z-[62] bg-white dark:bg-zinc-950 border rounded shadow-md"
                >
                  <Select.Viewport>
                    {LANGUAGES.map((lng) => (
                      <Select.Item
                        key={lng}
                        value={lng}
                        className="text-sm px-3 py-1.5 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none"
                      >
                        <Select.ItemText>{t(`textSpell:languages.${lng}`)}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </label>

          {error ? (
            <p className="text-xs text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <footer className="flex items-center justify-end gap-2 mt-1">
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={submitting}
                className="text-sm px-3 py-1.5 rounded border"
              >
                {t('textSpell:editorDialog.cancel')}
              </button>
            </Dialog.Close>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleSubmit()}
              className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-50"
            >
              {submitting ? t('textSpell:editorDialog.saving') : t('textSpell:editorDialog.save')}
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
