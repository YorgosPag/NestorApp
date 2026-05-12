/**
 * ADR-344 Phase 8 — Toolbar toggle for the spell-check decoration.
 *
 * Drives the `dxfSpellCheck` ProseMirror plugin via the
 * `setSpellCheckEnabled` TipTap command. State is persisted in
 * `localStorage` under `dxf-text-spell-enabled` so the user's preference
 * survives reloads without a new Zustand store (MVP per ADR plan).
 *
 * The toggle is purely a UX surface — the actual decoration logic lives
 * in `text-engine/edit/spell-check-extension.ts`.
 */
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { useTranslation } from '@/i18n';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const STORAGE_KEY = 'dxf-text-spell-enabled' as const;

function readStoredPreference(defaultValue: boolean): boolean {
  if (typeof window === 'undefined') return defaultValue;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return defaultValue;
  return raw === 'true';
}

interface ToggleProps {
  readonly editor: Editor | null;
  readonly defaultEnabled?: boolean;
}

export const SpellCheckToggle: React.FC<ToggleProps> = ({ editor, defaultEnabled = true }) => {
  const { t } = useTranslation(['textSpell']);
  const [enabled, setEnabled] = useState<boolean>(() => readStoredPreference(defaultEnabled));

  useEffect(() => {
    if (!editor) return;
    editor.commands.setSpellCheckEnabled(enabled);
  }, [editor, enabled]);

  const handleToggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      }
      return next;
    });
  }, []);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleToggle}
          aria-pressed={enabled}
          className={`text-xs px-2 py-1 rounded border ${
            enabled
              ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-400'
              : 'bg-transparent border-zinc-300 dark:border-zinc-700'
          }`}
        >
          <span aria-hidden="true">{enabled ? '✓ ' : ''}</span>
          {t('textSpell:toolbar.toggle')}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {enabled ? t('textSpell:toolbar.toggleOff') : t('textSpell:toolbar.toggleOn')}
      </TooltipContent>
    </Tooltip>
  );
};
