'use client';

/**
 * useInlineCellDraft — the spreadsheet cell contract (Google Sheets / Figma inspector):
 * type freely · **Enter** or leaving the cell commits · **Esc** restores the confirmed value.
 *
 * The draft follows the confirmed value while the cell is NOT being edited, so a server answer (or another
 * user's change after a conflict) shows up — but never overwrites what the human is typing right now.
 *
 * @module components/projects/tabs/project-budget/useInlineCellDraft
 * @see ADR-917 Φ3γ
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { handleInlineRenameKey } from '@/lib/ui/inline-rename-keyboard';

export interface InlineCellDraft {
  draft: string;
  setDraft: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

/** `commit(draft)` returns `false` when the draft is not acceptable ⇒ the confirmed text comes back. */
export function useInlineCellDraft(confirmedText: string, commit: (draft: string) => boolean): InlineCellDraft {
  const [draft, setDraft] = useState(confirmedText);
  const editing = useRef(false);

  useEffect(() => {
    if (!editing.current) setDraft(confirmedText);
  }, [confirmedText]);

  const finish = useCallback((save: boolean) => {
    editing.current = false;
    if (!save || draft === confirmedText || !commit(draft)) setDraft(confirmedText);
  }, [commit, confirmedText, draft]);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    handleInlineRenameKey(event, {
      onConfirm: () => input.blur(),
      onCancel: () => { finish(false); input.blur(); },
    });
  }, [finish]);

  return {
    draft,
    setDraft,
    onFocus: () => { editing.current = true; },
    onBlur: () => { if (editing.current) finish(true); },
    onKeyDown,
  };
}
