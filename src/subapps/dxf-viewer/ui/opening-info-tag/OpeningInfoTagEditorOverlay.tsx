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

import React, { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useCommandHistory } from '../../core/commands';
import { useLevels } from '../../systems/levels';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { UpdateEntityCommand } from '../../core/commands/entity-commands/UpdateEntityCommand';
import { openingInfoTagCellField } from '../../bim/opening-info-tag/opening-info-tag-geometry';
import { useEscapeHandler } from '../../systems/escape-bus/useEscapeHandler';
import { ESC_PRIORITY } from '../../systems/escape-bus/escape-priority';
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
  const committedRef = useRef(false);

  const commit = useCallback(() => {
    if (committedRef.current) return;
    committedRef.current = true;
    if (!currentLevelId || value === state.initialText) {
      closeOpeningInfoTagCellEditor();
      return;
    }
    const sceneManager = createLevelSceneManagerAdapter(getLevelScene, setLevelScene, currentLevelId);
    const patch = { [openingInfoTagCellField(state.cell)]: value };
    execute(new UpdateEntityCommand(state.entityId, patch, sceneManager));
    closeOpeningInfoTagCellEditor();
  }, [currentLevelId, getLevelScene, setLevelScene, execute, state, value]);

  const cancel = useCallback(() => {
    if (committedRef.current) return;
    committedRef.current = true;
    closeOpeningInfoTagCellEditor();
  }, []);

  // ADR-364 — Esc cancels the cell edit through the centralized escape-bus (MODAL_DIALOG priority,
  // like TextEditorOverlay; `allowWhenEditable` since the numeric input holds focus), mirroring
  // every other DXF ESC dispatch. Never an inline `e.key === 'Escape'` branch (escape-command-bus
  // SSoT / CHECK 3.7). The handler is registered only while this input is mounted (edit in flight).
  useEscapeHandler({
    id: 'opening-info-tag-cell-editor',
    priority: ESC_PRIORITY.MODAL_DIALOG,
    allowWhenEditable: true,
    canHandle: () => true,
    handle: () => {
      cancel();
      return true;
    },
  });

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    if (NUMERIC_DRAFT.test(next)) setValue(next);
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Enter commits; Esc-to-cancel is routed through the escape-bus (ADR-364) above.
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      }
    },
    [commit],
  );

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
