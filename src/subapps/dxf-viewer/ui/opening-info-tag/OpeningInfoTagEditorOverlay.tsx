'use client';

/**
 * ADR-612 — Opening Info Tag inline numeric cell editor overlay.
 *
 * The numeric-cell counterpart of `TextEditorOverlay` (ADR-344): a lightweight,
 * absolutely-positioned `<input>` mounted over the canvas while the user edits ONE
 * cell of an `OpeningInfoTagEntity`. Reads its open-state from the canvas-anchored
 * `opening-info-tag-editor-store` (self-contained — no props); on commit it
 * dispatches ONE undoable `UpdateEntityCommand` through the SAME command bus the
 * text editor uses (`useCommandHistory().execute`), patching just the target cell's
 * field (`topText` / `bottomLeftText` / `bottomRightText`).
 *
 *   Enter / blur → commit    Esc → cancel
 *
 * Plain controlled numeric input (digits, one decimal point, optional leading
 * minus). No rich-text engine — the 3 values are free numeric strings.
 *
 * @see hooks/canvas/use-opening-info-tag-double-click.ts — the opener
 * @see state/opening-info-tag-editor-store.ts — the open-state SSoT
 * @see ui/text-toolbar/TextEditorOverlay.tsx — the sibling this mirrors
 */

import React, { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useCommandHistory } from '../../core/commands';
import { useLevels } from '../../systems/levels';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { UpdateEntityCommand } from '../../core/commands/entity-commands/UpdateEntityCommand';
import { openingInfoTagCellField } from '../../bim/opening-info-tag/opening-info-tag-geometry';
import { useInlineEditorKeys } from '../inline-editor/use-inline-editor-keys';
import {
  closeOpeningInfoTagCellEditor,
  useOpeningInfoTagEditorStore,
  type OpeningInfoTagEditorState,
} from '../../state/opening-info-tag-editor-store';

/** Accept digits, at most one decimal point, and an optional leading minus. */
const NUMERIC_DRAFT = /^-?\d*\.?\d*$/;

export function OpeningInfoTagEditorOverlay(): React.ReactElement | null {
  const state = useOpeningInfoTagEditorStore();
  if (!state) return null;
  // Key remounts the input with a fresh draft whenever the target cell changes.
  return <OpeningInfoTagCellInput key={`${state.entityId}:${state.cell}`} state={state} />;
}

function OpeningInfoTagCellInput({ state }: { readonly state: OpeningInfoTagEditorState }): React.ReactElement {
  const { t } = useTranslation('dxf-viewer');
  const { execute } = useCommandHistory();
  const { currentLevelId, getLevelScene, setLevelScene } = useLevels();
  const [value, setValue] = useState<string>(state.initialText);

  const handleCommit = useCallback(() => {
    if (!currentLevelId || value === state.initialText) {
      closeOpeningInfoTagCellEditor();
      return;
    }
    const sceneManager = createLevelSceneManagerAdapter(getLevelScene, setLevelScene, currentLevelId);
    const patch = { [openingInfoTagCellField(state.cell)]: value };
    execute(new UpdateEntityCommand(state.entityId, patch, sceneManager));
    closeOpeningInfoTagCellEditor();
  }, [currentLevelId, getLevelScene, setLevelScene, execute, state, value]);

  // Keyboard semantics (Enter commits · Esc through the ADR-364 escape-bus) and the commit-once
  // guard live in the shared SSoT — the table-cell editor runs the exact same 15 lines (N.18).
  const { commit, onKeyDown } = useInlineEditorKeys({
    id: 'opening-info-tag-cell-editor',
    onCommit: handleCommit,
    onCancel: closeOpeningInfoTagCellEditor,
  });

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    if (NUMERIC_DRAFT.test(next)) setValue(next);
  }, []);

  return (
    <input
      type="text"
      inputMode="decimal"
      autoFocus
      value={value}
      placeholder={t('opening.infoTag.editorPlaceholder')}
      aria-label={t('opening.infoTag.editorPlaceholder')}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onBlur={commit}
      onFocus={(e) => e.currentTarget.select()}
      className={cn(
        'fixed z-40 box-border text-center',
        'rounded border border-primary bg-background text-foreground',
        'outline-none focus:ring-2 focus:ring-primary',
      )}
      style={{
        left: state.anchorRect.x,
        top: state.anchorRect.y,
        width: state.anchorRect.width,
        height: state.anchorRect.height,
      }}
    />
  );
}
