'use client';

/**
 * ADR-408 Φ6 — circuit rename field for the MEP Circuit contextual ribbon.
 *
 * Leaf widget (ADR-040): reads the active circuit from `useMepCircuitEditorStore`
 * + `useMepSystemStore` and renames it through the undoable
 * `UpdateMepSystemParamsCommand`. Typing is debounced and flagged `isDragging`
 * so mid-type keystrokes merge into ONE undo step (Revit "rename" = single
 * action); blur / Enter flush immediately (isDragging=false), ESC reverts the
 * draft. Mirrors `RibbonWallDimensionWidget`'s edit lifecycle, minus the numeric
 * stepper/presets.
 *
 * @see ./RibbonWallDimensionWidget.tsx — lifecycle template
 * @see ../../../core/commands/entity-commands/UpdateMepSystemParamsCommand
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useCommandHistory } from '../../../core/commands';
import { DXF_TIMING } from '../../../config/dxf-timing';
import { UpdateMepSystemParamsCommand } from '../../../core/commands/entity-commands/UpdateMepSystemParamsCommand';
import { useMepSystemStore } from '../../../bim/mep-systems/mep-system-store';
import { useMepCircuitEditorStore } from '../../../bim/mep-systems/mep-circuit-editor-store';
import { useEscapeHandler, ESC_PRIORITY } from '../../../systems/escape-bus';

/** Debounce window for live commit while typing (coalesced into 1 undo step). */
const COMMIT_DEBOUNCE_MS = DXF_TIMING.ui.COMMIT_DEBOUNCE_SLOW; // ADR-516

export function RibbonMepCircuitNameWidget(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const { execute } = useCommandHistory();
  const activeSystemId = useMepCircuitEditorStore((s) => s.activeSystemId);
  const systems = useMepSystemStore((s) => s.systems);

  const active = useMemo(
    () => systems.find((s) => s.id === activeSystemId) ?? null,
    [systems, activeSystemId],
  );
  const committedName = active?.params.name ?? '';

  const [draft, setDraft] = useState<string>(committedName);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusedRef = useRef<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset draft on circuit change / external rename — never while editing.
  useEffect(() => {
    if (!focusedRef.current) setDraft(committedName);
  }, [committedName]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => clearTimer, [clearTimer]);

  const commit = useCallback(
    (name: string, isDragging: boolean) => {
      if (!active) return;
      const next = name.trim();
      if (!next || next === active.params.name) return; // empty / no-op → skip
      execute(
        new UpdateMepSystemParamsCommand(
          active.id,
          { ...active.params, name: next },
          active.params,
          isDragging,
        ),
      );
    },
    [active, execute],
  );

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setDraft(value);
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        commit(value, true);
      }, COMMIT_DEBOUNCE_MS);
    },
    [clearTimer, commit],
  );

  const onBlur = useCallback(() => {
    focusedRef.current = false;
    clearTimer();
    commit(draft, false);
  }, [clearTimer, commit, draft]);

  useEscapeHandler({
    id: 'ribbon-mep-circuit-name',
    priority: ESC_PRIORITY.POPOVER_DROPDOWN,
    allowWhenEditable: true,
    canHandle: () => focusedRef.current,
    handle: () => {
      clearTimer();
      setDraft(committedName);
      inputRef.current?.blur();
      return true;
    },
  });

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }, []);

  if (!active) return null;
  const label = t('ribbon.commands.mepCircuit.name');

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">{label}</span>
      <span className="dxf-ribbon-widget-compact">
        <input
          ref={inputRef}
          className={cn('dxf-ribbon-wall-length-input', colors.bg.primary)}
          type="text"
          autoComplete="off"
          value={draft}
          onChange={onChange}
          onFocus={() => { focusedRef.current = true; }}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          aria-label={label}
        />
      </span>
    </span>
  );
}
