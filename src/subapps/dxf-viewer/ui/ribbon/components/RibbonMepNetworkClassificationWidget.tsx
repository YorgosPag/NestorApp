'use client';

/**
 * ADR-408 Φ-heating — classification ("System Type") editor for a plumbing
 * pipe-network (ύδρευση / θέρμανση).
 *
 * Leaf widget (mirror of `RibbonMepCircuitWireStyleWidget`): reads the active
 * system from `useMepCircuitEditorStore` + `useMepSystemStore`, narrows to the
 * pipe-network arm (`isPipeSystemParams`) and edits its
 * `MepSystemParams.systemClassification` through the **canonical** Radix
 * `@/components/ui/select` (ADR-001). The classification is the System's own SSoT;
 * changing it flows through the undoable `UpdateMepSystemParamsCommand` (generic
 * param patch — zero new command) and colour-by-system re-paints automatically in
 * 2D + 3D (both read the System colour).
 *
 * On a type change the colour follows the CIBSE/Revit convention
 * (`classificationDefaultColor`) ONLY when the user has not overridden it
 * (`isDefaultClassificationColor`) — a custom System Colour is preserved, exactly
 * as Revit keeps an overridden colour across a System Type change. Both updates are
 * bundled in one command (single undo).
 *
 * @see ./RibbonMepCircuitWireStyleWidget — sibling pattern template
 * @see ../../../bim/mep-systems/mep-system-color.ts (classification colour SSoT)
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
import {
  classificationDefaultColor,
  isDefaultClassificationColor,
} from '../../../bim/mep-systems/mep-system-color';
import type { PlumbingSystemClassification } from '../../../bim/types/mep-connector-types';
import { isPipeSystemParams } from '../../../bim/types/mep-system-types';

/** Selectable classifications, in display order (mirror `PlumbingSystemClassification`). */
const CLASSIFICATION_OPTIONS: readonly PlumbingSystemClassification[] = [
  'domestic-cold-water',
  'domestic-hot-water',
  'sanitary-drainage',
  'hydronic-supply',
  'hydronic-return',
];

export function RibbonMepNetworkClassificationWidget(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const { execute } = useCommandHistory();
  const activeSystemId = useMepCircuitEditorStore((s) => s.activeSystemId);
  const systems = useMepSystemStore((s) => s.systems);

  const active = useMemo(
    () => systems.find((s) => s.id === activeSystemId) ?? null,
    [systems, activeSystemId],
  );
  // Classification is a pipe-network feature; ignore electrical circuits.
  const params = active && isPipeSystemParams(active.params) ? active.params : null;
  const value: PlumbingSystemClassification = params?.systemClassification ?? 'domestic-cold-water';

  const handleChange = useCallback(
    (next: string) => {
      if (!active || !params || next === value) return;
      const classification = next as PlumbingSystemClassification;
      // Re-seed the colour from the new classification only when the current one is
      // a convention default (not a user override) — single-undo param patch.
      const nextColor = isDefaultClassificationColor(params.color)
        ? classificationDefaultColor(classification)
        : params.color;
      execute(
        new UpdateMepSystemParamsCommand(
          active.id,
          { ...params, systemClassification: classification, color: nextColor },
          params,
        ),
      );
    },
    [active, params, value, execute],
  );

  if (!active || !params) return null;
  const label = t('ribbon.commands.mepClassification.label');

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">{label}</span>
      <span className="dxf-ribbon-widget-compact">
        <Select value={value} onValueChange={handleChange}>
          <SelectTrigger size="sm" aria-label={label}>
            <SelectValue />
          </SelectTrigger>
          {/* w-auto overrides the popper's trigger-width lock so long Greek labels
              («Θέρμανση (προσαγωγή)») are never clipped. */}
          <SelectContent className="w-auto min-w-[11rem]">
            {CLASSIFICATION_OPTIONS.map((c) => (
              <SelectItem key={c} value={c} className="whitespace-nowrap">
                {t(`ribbon.commands.mepClassification.${c}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </span>
    </span>
  );
}
