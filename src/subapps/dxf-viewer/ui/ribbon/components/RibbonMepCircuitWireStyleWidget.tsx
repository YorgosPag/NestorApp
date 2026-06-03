'use client';

/**
 * ADR-408 Φ7 — wire-style ("Wiring Type") editor for the MEP Circuit ribbon.
 *
 * Leaf widget (ADR-040): reads the active circuit from `useMepCircuitEditorStore`
 * + `useMepSystemStore`, edits its per-circuit `MepSystemParams.wireStyle`
 * (`straight` / `orthogonal` / `arc`) through the **canonical** Radix
 * `@/components/ui/select` (ADR-001) — mirror of `BimPatternSelect`. The style is
 * the System's own SSoT; changing it flows through the undoable
 * `UpdateMepSystemParamsCommand` (generic param patch — zero new command) and the
 * home-run wires re-route automatically in 2D (`HomeRunWiresOverlay`) + 3D
 * (`use-bim3d-vg-resync`), since both renderers read `path.style` via
 * `buildWirePolyline`.
 *
 * @see ../../../bim/mep-systems/mep-wire-routing.ts (WireStyle SSoT)
 * @see ./RibbonMepCircuitColorWidget — sibling pattern template
 * @see ./BimStyleSelects — canonical Select usage template
 */

import React, { useCallback, useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useCommandHistory } from '../../../core/commands';
import { UpdateMepSystemParamsCommand } from '../../../core/commands/entity-commands/UpdateMepSystemParamsCommand';
import { useMepSystemStore } from '../../../bim/mep-systems/mep-system-store';
import { useMepCircuitEditorStore } from '../../../bim/mep-systems/mep-circuit-editor-store';
import type { WireStyle } from '../../../bim/mep-systems/mep-wire-routing';
import { isElectricalSystemParams } from '../../../bim/types/mep-system-types';

/** Selectable wire styles, in display order. */
const WIRE_STYLE_OPTIONS: readonly WireStyle[] = ['straight', 'orthogonal', 'arc'];

export function RibbonMepCircuitWireStyleWidget(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const { execute } = useCommandHistory();
  const activeSystemId = useMepCircuitEditorStore((s) => s.activeSystemId);
  const systems = useMepSystemStore((s) => s.systems);

  const active = useMemo(
    () => systems.find((s) => s.id === activeSystemId) ?? null,
    [systems, activeSystemId],
  );
  // Wire style is an electrical-circuit feature; ignore pipe networks (Φ9).
  const params = active && isElectricalSystemParams(active.params) ? active.params : null;
  const value: WireStyle = params?.wireStyle ?? 'straight';

  const handleChange = useCallback(
    (next: string) => {
      if (!active || !params || next === value) return;
      execute(
        new UpdateMepSystemParamsCommand(
          active.id,
          { ...params, wireStyle: next as WireStyle },
          params,
        ),
      );
    },
    [active, params, value, execute],
  );

  if (!active || !params) return null;
  const label = t('ribbon.commands.mepWireStyle.label');

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">{label}</span>
      <span className="dxf-ribbon-widget-compact">
        <Select value={value} onValueChange={handleChange}>
          <SelectTrigger size="sm" aria-label={label}>
            <SelectValue />
          </SelectTrigger>
          {/* w-auto overrides the popper's trigger-width lock so long Greek
              labels («Ορθογώνιο», «Τόξο») are never clipped. */}
          <SelectContent className="w-auto min-w-[9rem]">
            {WIRE_STYLE_OPTIONS.map((style) => (
              <SelectItem key={style} value={style} className="whitespace-nowrap">
                {t(`ribbon.commands.mepWireStyle.${style}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </span>
    </span>
  );
}
