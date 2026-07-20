'use client';

/**
 * ADR-408 Φ7 — read-only circuit indicator on the MEP fixture (device) tab.
 *
 * Leaf widget (ADR-040): surfaces *which* circuit the primary-selected fixture
 * belongs to — its name plus a colour swatch in the System's colour — mirroring
 * Revit's device "Electrical Circuits" read-out. Editing the circuit (rename /
 * colour / members) lives in the panel-centric Circuit tab, reached via the
 * sibling "Edit Circuit" button; this widget is purely informational.
 *
 * Self-hides (returns null) when the fixture belongs to no circuit, so the
 * "Κύκλωμα" panel is inert for an un-wired fixture. Reads the same `activeSystemId`
 * the Φ6 sync already reconciles from the selection — no bespoke resolution.
 *
 * @see ./RibbonMepCircuitPickerWidget.tsx — sibling picker (manage tab)
 * @see ../../../bim/mep-systems/mep-circuit-editor.ts
 */

import React, { useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useLivePrimaryEntity } from '../../../systems/selection/useLiveSelectedEntity';
import { useMepSystemStore } from '../../../bim/mep-systems/mep-system-store';
import { useMepCircuitEditorStore } from '../../../bim/mep-systems/mep-circuit-editor-store';
import { resolveManagedSystems } from '../../../bim/mep-systems/mep-circuit-editor';
import { systemColor } from '../../../bim/mep-systems/mep-system-color';

export function RibbonMepFixtureCircuitWidget(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const systems = useMepSystemStore((s) => s.systems);
  const activeSystemId = useMepCircuitEditorStore((s) => s.activeSystemId);
  // ΖΩΝΤΑΝΗ ανάγνωση (SSoT) — το προηγούμενο memo πάγωνε τη συσκευή στο mount
  // (σταθερά context refs) → έδειχνε το κύκλωμα της ΠΡΩΤΗΣ επιλογής
  // (ADR-547 changelog 2026-07-20).
  const entity = useLivePrimaryEntity();

  // The circuit(s) the selected fixture belongs to (Revit single-circuit ⇒ one).
  const circuit = useMemo(() => {
    if (!entity) return null;
    const candidates = resolveManagedSystems([entity], systems);
    return candidates.find((c) => c.id === activeSystemId) ?? candidates[0] ?? null;
  }, [entity, systems, activeSystemId]);

  if (!circuit) return null;
  const label = t('ribbon.commands.mepFixtureEditor.circuit.label');

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">{label}</span>
      <span className="dxf-ribbon-wall-length-value flex items-center gap-1">
        <span
          aria-hidden="true"
          className="inline-block w-2.5 h-2.5 rounded-full border border-black/20"
          style={{ backgroundColor: systemColor(circuit) }}
        />
        {circuit.params.name}
      </span>
    </span>
  );
}
