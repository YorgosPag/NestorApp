/**
 * ADR-344 Phase 8 — Right-click context menu on a mis-spelled word.
 *
 * Shows the top-N nspell suggestions + an «Add to dictionary» action.
 * Industry pattern: Word / Google Docs / VS Code / AutoCAD all show
 * suggestion-first menus.
 *
 * The menu is positioned at the cursor; it auto-closes on outside click
 * or selection. Hover handling is delegated to the parent (the SpellCheck
 * extension exposes `findMisspellingAt` for translating a click pos into
 * a misspelling).
 */
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { useTranslation } from '@/i18n';
import { getSpellChecker, type SpellLanguage } from '@/subapps/dxf-viewer/text-engine/spell';
import { findMisspellingAt } from '@/subapps/dxf-viewer/text-engine/edit/spell-check-extension';
import {
  useCustomDictionaryMutations,
  useCustomDictionary,
} from '@/subapps/dxf-viewer/ui/text-dictionary/hooks/useCustomDictionary';

interface ContextMenuProps {
  readonly editor: Editor | null;
  readonly companyId: string | null;
  /** Trigger event from the editor: contextmenu fired at this ProseMirror pos. */
  readonly anchor: { x: number; y: number; docPos: number } | null;
  readonly onClose: () => void;
}

export const SpellCheckContextMenu: React.FC<ContextMenuProps> = ({
  editor,
  companyId,
  anchor,
  onClose,
}) => {
  const { t } = useTranslation(['textSpell']);
  const { entries, setEntriesLocal } = useCustomDictionary(companyId);
  const mutations = useCustomDictionaryMutations({ entries, setEntries: setEntriesLocal });
  const [suggestions, setSuggestions] = useState<readonly string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [misspelling, setMisspelling] = useState<
    | { from: number; to: number; word: string; language: SpellLanguage }
    | null
  >(null);

  useEffect(() => {
    if (!editor || !anchor) {
      setMisspelling(null);
      setSuggestions([]);
      return;
    }
    const found = findMisspellingAt(editor.state, anchor.docPos);
    setMisspelling(found);
    if (!found) {
      onClose();
      return;
    }
    setLoading(true);
    const checker = getSpellChecker({ languages: ['el', 'en'], initialCustomTerms: [] });
    void checker.suggest(found.word, found.language, 5).then(
      (next) => {
        setSuggestions(next);
        setLoading(false);
      },
      () => {
        setSuggestions([]);
        setLoading(false);
      },
    );
  }, [editor, anchor, onClose]);

  const handleReplace = useCallback(
    (replacement: string) => {
      if (!editor || !misspelling) return;
      editor
        .chain()
        .focus()
        .insertContentAt({ from: misspelling.from, to: misspelling.to }, replacement)
        .run();
      onClose();
    },
    [editor, misspelling, onClose],
  );

  const handleAddToDictionary = useCallback(async () => {
    if (!misspelling || !companyId) return;
    try {
      await mutations.create({ term: misspelling.word, language: misspelling.language });
      const checker = getSpellChecker({ languages: ['el', 'en'], initialCustomTerms: [] });
      await checker.addCustomWord({ term: misspelling.word, language: misspelling.language });
      editor?.commands.rebuildSpellDecorations();
    } catch (err) {
      // The Manager surfaces toast feedback; here we silently fall through.
    }
    onClose();
  }, [misspelling, companyId, mutations, editor, onClose]);

  if (!anchor || !misspelling) return null;

  return (
    <menu
      role="menu"
      style={{ position: 'fixed', left: anchor.x, top: anchor.y }}
      className="z-[80] min-w-[180px] bg-white dark:bg-zinc-950 border rounded shadow-md text-sm"
    >
      <li className="px-3 py-1.5 text-xs text-zinc-500 border-b">
        {t('textSpell:contextMenu.suggestions')} — «{misspelling.word}»
      </li>
      {loading ? (
        <li className="px-3 py-1.5 text-zinc-500">…</li>
      ) : suggestions.length === 0 ? (
        <li className="px-3 py-1.5 text-zinc-500">{t('textSpell:contextMenu.noSuggestions')}</li>
      ) : (
        suggestions.map((s) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => handleReplace(s)}
              className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              {s}
            </button>
          </li>
        ))
      )}
      <li className="border-t">
        <button
          type="button"
          disabled={!companyId}
          onClick={() => void handleAddToDictionary()}
          className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
        >
          {t('textSpell:contextMenu.addToDictionary')}
        </button>
      </li>
    </menu>
  );
};
