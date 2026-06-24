'use client';

/**
 * ADR-408 Φ7 — conductor-count editor ("#wires") for the MEP Circuit ribbon.
 *
 * Leaf widget (ADR-040): reads the active circuit from `useMepCircuitEditorStore`
 * + `useMepSystemStore` and edits its per-circuit `MepSystemParams.conductors`
 * (hot / neutral / ground) through the undoable `UpdateMepSystemParamsCommand`
 * (generic param patch — zero new command). The home-run tick marks re-draw
 * automatically (`MepWireRenderer` reads `path.conductors` via the routing SSoT).
 *
 * Lifecycle mirrors `RibbonMepCircuitNameWidget`: typing is debounced and flagged
 * `isDragging` so keystrokes coalesce into ONE undo step; blur / Enter flush
 * immediately; Esc reverts the draft. Each field commits independently, reading
 * the other two from the current params so they never go stale.
 *
 * @see ./RibbonMepCircuitNameWidget.tsx — lifecycle template
 * @see ../../../bim/mep-systems/mep-wire-conductor-ticks.ts (the drawn result)
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
import { DEFAULT_CONDUCTORS, isElectricalSystemParams, type ConductorBreakdown } from '../../../bim/types/mep-system-types';

type ConductorField = keyof ConductorBreakdown;

const FIELDS: readonly { readonly key: ConductorField; readonly labelKey: string }[] = [
  { key: 'hot', labelKey: 'ribbon.commands.mepConductors.hot' },
  { key: 'neutral', labelKey: 'ribbon.commands.mepConductors.neutral' },
  { key: 'ground', labelKey: 'ribbon.commands.mepConductors.ground' },
];

const MIN_CONDUCTORS = 0;
const MAX_CONDUCTORS = 12;
/** Debounce window for live commit while typing (coalesced into 1 undo step). */
const COMMIT_DEBOUNCE_MS = DXF_TIMING.ui.COMMIT_DEBOUNCE_SLOW; // ADR-516

const clamp = (n: number): number => Math.max(MIN_CONDUCTORS, Math.min(MAX_CONDUCTORS, n));

export function RibbonMepCircuitConductorsWidget(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const { execute } = useCommandHistory();
  const activeSystemId = useMepCircuitEditorStore((s) => s.activeSystemId);
  const systems = useMepSystemStore((s) => s.systems);

  const active = useMemo(
    () => systems.find((s) => s.id === activeSystemId) ?? null,
    [systems, activeSystemId],
  );
  // Conductors are an electrical-circuit feature; ignore pipe networks (Φ9).
  const params = active && isElectricalSystemParams(active.params) ? active.params : null;
  const committed: ConductorBreakdown = params?.conductors ?? DEFAULT_CONDUCTORS;

  const [draft, setDraft] = useState<Record<ConductorField, string>>({
    hot: String(committed.hot),
    neutral: String(committed.neutral),
    ground: String(committed.ground),
  });
  const focusedRef = useRef<ConductorField | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resync the draft on circuit change / external edit — never while editing.
  useEffect(() => {
    if (focusedRef.current === null) {
      setDraft({ hot: String(committed.hot), neutral: String(committed.neutral), ground: String(committed.ground) });
    }
  }, [committed.hot, committed.neutral, committed.ground]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => clearTimer, [clearTimer]);

  const commit = useCallback(
    (field: ConductorField, raw: string, isDragging: boolean) => {
      if (!active || !params) return;
      const parsed = parseInt(raw, 10);
      if (Number.isNaN(parsed)) return; // mid-edit empty / invalid → skip
      const base = params.conductors ?? DEFAULT_CONDUCTORS;
      const value = clamp(parsed);
      if (value === base[field]) return; // no-op
      execute(
        new UpdateMepSystemParamsCommand(
          active.id,
          { ...params, conductors: { ...base, [field]: value } },
          params,
          isDragging,
        ),
      );
    },
    [active, params, execute],
  );

  const onChange = useCallback(
    (field: ConductorField) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setDraft((d) => ({ ...d, [field]: value }));
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        commit(field, value, true);
      }, COMMIT_DEBOUNCE_MS);
    },
    [clearTimer, commit],
  );

  const onBlur = useCallback(
    (field: ConductorField) => () => {
      focusedRef.current = null;
      clearTimer();
      commit(field, draft[field], false);
    },
    [clearTimer, commit, draft],
  );

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }, []);

  if (!active || !params) return null;

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">{t('ribbon.commands.mepConductors.label')}</span>
      <span className="dxf-ribbon-widget-compact">
        {FIELDS.map(({ key, labelKey }) => {
          const fieldLabel = t(labelKey);
          return (
            <label key={key} className="dxf-ribbon-combobox-label">
              {fieldLabel}
              <input
                className={cn('dxf-ribbon-wall-length-input', colors.bg.primary)}
                type="number"
                min={MIN_CONDUCTORS}
                max={MAX_CONDUCTORS}
                step={1}
                autoComplete="off"
                value={draft[key]}
                onChange={onChange(key)}
                onFocus={() => { focusedRef.current = key; }}
                onBlur={onBlur(key)}
                onKeyDown={onKeyDown}
                aria-label={fieldLabel}
              />
            </label>
          );
        })}
      </span>
    </span>
  );
}
