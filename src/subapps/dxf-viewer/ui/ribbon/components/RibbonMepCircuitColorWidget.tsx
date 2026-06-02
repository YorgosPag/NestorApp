'use client';

/**
 * ADR-408 Φ6 — circuit colour editor for the MEP Circuit contextual ribbon.
 *
 * Leaf widget (ADR-040): reads the active circuit from `useMepCircuitEditorStore`
 * + `useMepSystemStore`, edits its System Colour through the **centralized**
 * `ColorDialogTrigger` (`EnterpriseColorDialog` — the same picker as the DXF
 * crosshair/grid/opening-tag colours, hex in/out). The colour is the System's
 * own SSoT (`MepSystemParams.color`); changing it flows through the undoable
 * `UpdateMepSystemParamsCommand` and colour-by-system repaints automatically
 * (2D leaf reads the store, 3D `use-bim3d-vg-resync`). The panel-source stays
 * its equipment colour — only members repaint.
 *
 * @see ../../color/EnterpriseColorDialog
 * @see ../components/OpeningTagStyleColorWidget — pattern template
 */

import React, { useCallback, useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ColorDialogTrigger } from '../../color/EnterpriseColorDialog';
import { useCommandHistory } from '../../../core/commands';
import { UpdateMepSystemParamsCommand } from '../../../core/commands/entity-commands/UpdateMepSystemParamsCommand';
import { useMepSystemStore } from '../../../bim/mep-systems/mep-system-store';
import { useMepCircuitEditorStore } from '../../../bim/mep-systems/mep-circuit-editor-store';
import { systemColor } from '../../../bim/mep-systems/mep-system-color';

export function RibbonMepCircuitColorWidget(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const { execute } = useCommandHistory();
  const activeSystemId = useMepCircuitEditorStore((s) => s.activeSystemId);
  const systems = useMepSystemStore((s) => s.systems);

  const active = useMemo(
    () => systems.find((s) => s.id === activeSystemId) ?? null,
    [systems, activeSystemId],
  );
  const hex = active ? systemColor(active) : '#000000';

  const handleChange = useCallback(
    (color: string) => {
      if (!active || color === active.params.color) return;
      execute(
        new UpdateMepSystemParamsCommand(
          active.id,
          { ...active.params, color },
          active.params,
        ),
      );
    },
    [active, execute],
  );

  if (!active) return null;
  const label = t('ribbon.commands.mepCircuit.color');

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">{label}</span>
      <span className="dxf-ribbon-widget-compact">
        <ColorDialogTrigger
          value={hex}
          onChange={handleChange}
          label={hex}
          title={label}
          alpha={false}
          modes={['hex', 'rgb', 'hsl']}
          palettes={['dxf', 'semantic', 'material']}
          recent
          eyedropper
        />
      </span>
    </span>
  );
}
