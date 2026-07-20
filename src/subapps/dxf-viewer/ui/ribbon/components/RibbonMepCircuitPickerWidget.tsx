'use client';

/**
 * ADR-408 Φ6 — circuit picker for the MEP Circuit contextual ribbon.
 *
 * Leaf widget (ADR-040): resolves the circuits the primary-selected entity
 * touches (fixture → its one circuit, panel → the circuits it feeds) and lets
 * the user choose which one the Circuit-Properties panel edits. One candidate →
 * a read-only label; several (a panel feeding multiple circuits) → a dropdown
 * that sets `useMepCircuitEditorStore.activeSystemId`. The store keeps a valid
 * pick across re-renders (reconciled by `useMepCircuitEditorSync`).
 *
 * @see ../../../bim/mep-systems/mep-circuit-editor.ts
 * @see ./RibbonWallDimensionWidget.tsx — dropdown pattern template
 */

import React, { useCallback, useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { RibbonCompactDropdown } from './RibbonCompactDropdown';
import { useLivePrimaryEntity } from '../../../systems/selection/useLiveSelectedEntity';
import { useMepSystemStore } from '../../../bim/mep-systems/mep-system-store';
import { useMepCircuitEditorStore } from '../../../bim/mep-systems/mep-circuit-editor-store';
import { resolveManagedSystems } from '../../../bim/mep-systems/mep-circuit-editor';
import { isPipeSystemParams } from '../../../bim/types/mep-system-types';

export function RibbonMepCircuitPickerWidget(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const systems = useMepSystemStore((s) => s.systems);
  const activeSystemId = useMepCircuitEditorStore((s) => s.activeSystemId);
  const setActiveSystemId = useMepCircuitEditorStore((s) => s.setActiveSystemId);
  // ΖΩΝΤΑΝΗ ανάγνωση (SSoT) — το προηγούμενο `useMemo([levelManager,
  // universalSelection, systems])` πάγωνε την οντότητα στο mount (τα δύο πρώτα
  // deps είναι σταθερά refs) → ο επιλογέας κρατούσε τα κυκλώματα της ΠΡΩΤΗΣ
  // επιλογής (ADR-547 changelog 2026-07-20).
  const entity = useLivePrimaryEntity();

  const candidates = useMemo(
    () => (entity ? resolveManagedSystems([entity], systems) : []),
    [entity, systems],
  );

  const activeName = useMemo(
    () => candidates.find((c) => c.id === activeSystemId)?.params.name
      ?? candidates[0]?.params.name
      ?? '',
    [candidates, activeSystemId],
  );

  const onPick = useCallback(
    (systemId: string) => setActiveSystemId(systemId),
    [setActiveSystemId],
  );

  if (candidates.length === 0) return null;
  // System-agnostic widget (ADR-408 Φ13): the same picker serves electrical
  // circuits and plumbing pipe networks. Adapt only the label to the active
  // system's domain so a water network never reads "Circuit".
  const active = candidates.find((c) => c.id === activeSystemId) ?? candidates[0]!;
  const label = isPipeSystemParams(active.params)
    ? t('ribbon.commands.mepCircuit.networkPicker')
    : t('ribbon.commands.mepCircuit.circuitPicker');

  if (candidates.length === 1) {
    return (
      <span className="dxf-ribbon-combobox-row">
        <span className="dxf-ribbon-combobox-label">{label}</span>
        <span className="dxf-ribbon-wall-length-value">{activeName}</span>
      </span>
    );
  }

  return (
    <RibbonCompactDropdown
      label={label}
      triggerContent={activeName}
      items={candidates.map((circuit) => ({
        key: circuit.id,
        onSelect: () => onPick(circuit.id),
        content: circuit.params.name,
      }))}
    />
  );
}
