'use client';

/**
 * ADR-408 Φ8 — Bridge μεταξύ του contextual MEP segment ribbon tab και του active
 * `MepSegmentEntity` params (σωλήνας / αεραγωγός, ΕΝΑ tab).
 *
 * Mirror του `useRibbonMepFixtureBridge`. Κάθε combobox change δρομολογείται μέσω
 * `UpdateMepSegmentParamsCommand` (undoable + geometry recompute atomically) και
 * εκπέμπει `bim:mep-segment-params-updated` ώστε ο `useMepSegmentPersistence` να
 * κάνει debounced auto-save (ο command δεν εκπέμπει — το persistence ακούει το
 * event).
 *
 * Το `domain` ΔΕΝ είναι editable εδώ (αλλάζει discipline/IFC/BOQ): απλώς gate-άρει
 * τη section-shape επιλογή — ένας σωλήνας είναι πάντα round. Οι διαστάσεις
 * εμφανίζονται για display μέσω `resolveSegmentSection` (defaults per domain).
 *
 * No-ops για commandKeys εκτός `MEP_SEGMENT_RIBBON_KEYS`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ8
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isMepSegmentEntity } from '../../../types/entities';
import type {
  MepSegmentEntity,
  MepSegmentParams,
  MepSegmentSectionKind,
} from '../../../bim/types/mep-segment-types';
import type { PlumbingSystemClassification } from '../../../bim/types/mep-connector-types';
import {
  resolveSegmentSection,
  resolveSegmentEndpointElevationsMm,
  deriveCenterlineElevationMm,
  derivePlanLengthMm,
  deriveSlopePercent,
  applySlopePercentToEndpoints,
  DEFAULT_SEGMENT_CENTERLINE_ELEVATION_MM,
} from '../../../bim/types/mep-segment-types';
import { mepSegmentToolBridgeStore } from './bridge/mep-segment-tool-bridge-store';
import { useCommandHistory, CompoundCommand } from '../../../core/commands';
import { UpdateMepSegmentParamsCommand } from '../../../core/commands/entity-commands/UpdateMepSegmentParamsCommand';
import { resolveConnectedElevationPatches } from '../../../bim/mep-segments/mep-elevation-propagation';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import {
  MEP_SEGMENT_RIBBON_KEYS,
  MEP_SEGMENT_RIBBON_KEYS_ACTIONS,
  MEP_SEGMENT_RIBBON_VISIBILITY_KEYS,
  isMepSegmentRibbonKey,
  isMepSegmentVisibilityKey,
} from './bridge/mep-segment-command-keys';
import { EventBus } from '../../../systems/events/EventBus';
import type { RibbonComboboxState, RibbonToggleState } from '../context/RibbonCommandContext';
import type { useLevels } from '../../../systems/levels';
import type { useUniversalSelection } from '../../../systems/selection';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

type UniversalSelectionLike = Pick<
  ReturnType<typeof useUniversalSelection>,
  'getPrimaryId'
>;

export interface UseRibbonMepSegmentBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonMepSegmentBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
  readonly onAction: (action: string) => void;
  readonly getPanelVisibility: (visibilityKey: string) => boolean;
}

const NULL_TOGGLE: RibbonToggleState = false;

/** Effective section kind: a pipe is always round regardless of stored value. */
function effectiveSectionKind(params: MepSegmentParams): MepSegmentSectionKind {
  return params.domain === 'pipe' ? 'round' : params.sectionKind;
}

export function useRibbonMepSegmentBridge(
  props: UseRibbonMepSegmentBridgeProps,
): RibbonMepSegmentBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');

  // ADR-408 Φ8 #2b — reactive read of the live segment tool (draw-time). Lets the
  // dual-mode bridge read/write the draw-time centreline override when no segment is
  // selected. Ribbon-level subscription (not a canvas micro-leaf) — ΕΚΤΟΣ ADR-040.
  const toolHandle = mepSegmentToolBridgeStore.use();

  const resolveSegment = useCallback((): MepSegmentEntity | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const e = scene.entities.find((x) => x.id === id);
    if (!e || !isMepSegmentEntity(e)) return null;
    return e;
  }, [levelManager, universalSelection]);

  const dispatchParams = useCallback(
    (segment: MepSegmentEntity, nextParams: MepSegmentParams): void => {
      if (!levelManager.currentLevelId) return;
      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateMepSegmentParamsCommand(segment.id, nextParams, segment.params, sm, false),
      );
      // The command does not emit — persistence auto-saves on this event.
      EventBus.emit('bim:mep-segment-params-updated', { segmentId: segment.id });
    },
    [executeCommand, levelManager],
  );

  /**
   * Dispatch an elevation edit with Revit-style connected propagation (Φ-B2a):
   * the edited z is propagated to all coincident pipe endpoints in the same node,
   * batched into ONE CompoundCommand (single undo). Each affected segment emits
   * the persistence event so every changed pipe auto-saves.
   */
  const dispatchElevationEdit = useCallback(
    (segment: MepSegmentEntity, editedNext: MepSegmentParams): void => {
      if (!levelManager.currentLevelId) return;
      const scene = levelManager.getLevelScene(levelManager.currentLevelId);
      const entities = scene?.entities ?? [];
      const patches = resolveConnectedElevationPatches(entities, segment, editedNext);
      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      const commands = patches.map(
        (p) => new UpdateMepSegmentParamsCommand(p.segment.id, p.nextParams, p.segment.params, sm, false),
      );
      executeCommand(
        commands.length === 1
          ? commands[0]!
          : new CompoundCommand('Update connected MEP elevations', commands),
      );
      // The command(s) do not emit — persistence auto-saves on these events.
      for (const p of patches) {
        EventBus.emit('bim:mep-segment-params-updated', { segmentId: p.segment.id });
      }
    },
    [executeCommand, levelManager],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      const segment = resolveSegment();
      if (!segment) {
        // ADR-408 Φ8 #2b — draw-time: show the live centreline elevation override
        // (Revit Options Bar "Offset"). The 3D placement hook reads this per click,
        // so changing it between the 2 clicks authors a riser/slope.
        if (
          toolHandle?.isActive &&
          commandKey === MEP_SEGMENT_RIBBON_KEYS.params.centerlineElevation
        ) {
          const mm = toolHandle.overrides.centerlineElevationMm ?? DEFAULT_SEGMENT_CENTERLINE_ELEVATION_MM;
          return { value: String(Math.round(mm)), options: [] };
        }
        // ADR-408 Φ14 (draw-time System Type) — surface the live classification
        // override (Revit Type Selector). The completion hook passes it into the new
        // pipe's params, so the committed run comes out in the system colour.
        if (
          toolHandle?.isActive &&
          commandKey === MEP_SEGMENT_RIBBON_KEYS.stringParams.classification
        ) {
          return { value: toolHandle.overrides.classification ?? '', options: [] };
        }
        return null;
      }
      if (commandKey === MEP_SEGMENT_RIBBON_KEYS.stringParams.sectionKind) {
        return { value: effectiveSectionKind(segment.params), options: [] };
      }
      if (commandKey === MEP_SEGMENT_RIBBON_KEYS.stringParams.classification) {
        // ADR-408 Φ14 — empty = unclassified (a plain water pipe drawn with the
        // generic pipe tool); the combobox simply shows no selection.
        return { value: segment.params.classification ?? '', options: [] };
      }
      if (!isMepSegmentRibbonKey(commandKey)) return null;
      const section = resolveSegmentSection(segment.params);
      if (commandKey === MEP_SEGMENT_RIBBON_KEYS.params.width) {
        return { value: String(Math.round(section.widthMm)), options: [] };
      }
      if (commandKey === MEP_SEGMENT_RIBBON_KEYS.params.height) {
        return { value: String(Math.round(section.heightMm)), options: [] };
      }
      if (commandKey === MEP_SEGMENT_RIBBON_KEYS.params.diameter) {
        return { value: String(Math.round(section.diameterMm ?? section.widthMm)), options: [] };
      }
      if (commandKey === MEP_SEGMENT_RIBBON_KEYS.params.slopePercent) {
        // ADR-408 Φ14 #2 — slope is DERIVED from the per-endpoint z (SSoT), never
        // the stale stored scalar; so it always matches the actual geometry.
        const e = resolveSegmentEndpointElevationsMm(segment.params);
        const slope = deriveSlopePercent(e.startMm, e.endMm, derivePlanLengthMm(segment.params));
        return { value: formatSlopePercentForCombobox(slope), options: [] };
      }
      const elev = resolveSegmentEndpointElevationsMm(segment.params);
      if (commandKey === MEP_SEGMENT_RIBBON_KEYS.params.centerlineElevation) {
        const mid = deriveCenterlineElevationMm(elev.startMm, elev.endMm);
        return { value: String(Math.round(mid)), options: [] };
      }
      if (commandKey === MEP_SEGMENT_RIBBON_KEYS.params.startElevation) {
        return { value: String(Math.round(elev.startMm)), options: [] };
      }
      if (commandKey === MEP_SEGMENT_RIBBON_KEYS.params.endElevation) {
        return { value: String(Math.round(elev.endMm)), options: [] };
      }
      return null;
    },
    [resolveSegment, toolHandle],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      const segment = resolveSegment();
      if (!segment) {
        // ADR-408 Φ8 #2b — draw-time: write the centreline elevation override on the
        // live tool. The 3D placement hook reads it per click → riser/slope when the
        // value differs between the two clicks. Sync read (no subscription needed).
        if (commandKey === MEP_SEGMENT_RIBBON_KEYS.params.centerlineElevation) {
          const numeric = Number.parseFloat(value);
          if (!Number.isNaN(numeric)) {
            mepSegmentToolBridgeStore.get()?.setParamOverrides({ centerlineElevationMm: numeric });
          }
        }
        // ADR-408 Φ14 (draw-time System Type) — write the classification override on
        // the live tool. The next pipe inherits it (completion → params → colour).
        if (commandKey === MEP_SEGMENT_RIBBON_KEYS.stringParams.classification) {
          mepSegmentToolBridgeStore.get()?.setParamOverrides({
            classification: value as PlumbingSystemClassification,
          });
        }
        return;
      }
      if (commandKey === MEP_SEGMENT_RIBBON_KEYS.stringParams.sectionKind) {
        // A pipe is always round — ignore an attempt to make it rectangular.
        if (segment.params.domain === 'pipe') return;
        const nextParams: MepSegmentParams = {
          ...segment.params,
          sectionKind: value as MepSegmentSectionKind,
        };
        dispatchParams(segment, nextParams);
        return;
      }
      if (commandKey === MEP_SEGMENT_RIBBON_KEYS.stringParams.classification) {
        // ADR-408 Φ14 — set the instance classification hint (drives colour while
        // standalone). Once the pipe joins a System, the System's colour wins.
        const nextParams: MepSegmentParams = {
          ...segment.params,
          classification: value as PlumbingSystemClassification,
        };
        dispatchParams(segment, nextParams);
        return;
      }
      if (!isMepSegmentRibbonKey(commandKey)) return;
      const numeric = Number.parseFloat(value);
      if (Number.isNaN(numeric)) return;
      // ADR-408 Φ14 #2 — a slope edit MOVES the end endpoint z (anchor start), then
      // routes through elevation propagation so connected pipes follow (Φ-B2a). The
      // per-endpoint z stays the single SSoT — never a naive scalar set.
      if (commandKey === MEP_SEGMENT_RIBBON_KEYS.params.slopePercent) {
        dispatchElevationEdit(segment, applySlopePercentToEndpoints(segment.params, numeric));
        return;
      }
      // Elevation edits touch the per-endpoint z's + the derived centreline cache
      // (Φ-A), not a single param field — handle them before the generic path.
      const elevParams = buildElevationParams(segment.params, commandKey, numeric);
      if (elevParams) {
        dispatchElevationEdit(segment, elevParams);
        return;
      }
      const field = NUMBER_KEY_TO_FIELD[commandKey];
      if (!field) return;
      const nextParams = { ...segment.params, [field]: numeric } as MepSegmentParams;
      dispatchParams(segment, nextParams);
    },
    [resolveSegment, dispatchParams, dispatchElevationEdit],
  );

  const onToggle = useCallback((_key: string, _next: boolean): void => {
    /* no-op */
  }, []);
  const getToggleState = useCallback((_key: string): RibbonToggleState => NULL_TOGGLE, []);

  const onAction = useCallback(
    (action: string): void => {
      // ADR-363 — «Κλείσιμο» handled centrally in routeRibbonAction (single SSoT).
      if (action !== MEP_SEGMENT_RIBBON_KEYS_ACTIONS.delete) return;
      const segment = resolveSegment();
      if (!segment) return;
      const confirmed = window.confirm(t('ribbon.commands.mepSegmentEditor.deleteConfirm'));
      if (!confirmed) return;
      EventBus.emit('bim:mep-segment-delete-requested', { segmentId: segment.id });
    },
    [resolveSegment, universalSelection, t],
  );

  const getPanelVisibility = useCallback(
    (visibilityKey: string): boolean => {
      if (!isMepSegmentVisibilityKey(visibilityKey)) return true;
      // ADR-408 Φ14 (draw-time System Type) — the "Σύστημα" panel must show BEFORE a
      // segment exists (Revit Type Selector), so it is resolved ahead of the
      // `!segment` early-return: visible while the pipe/drain-pipe tool is active
      // (domain === 'pipe' ⇒ excludes the duct tool) OR a pipe is selected.
      if (visibilityKey === MEP_SEGMENT_RIBBON_VISIBILITY_KEYS.pipeClassification) {
        if (toolHandle?.isActive) return toolHandle.domain === 'pipe';
        return resolveSegment()?.params.domain === 'pipe';
      }
      const segment = resolveSegment();
      if (!segment) return false;
      // ADR-408 Φ8 #2b — selection-only panels (per-endpoint start/end, actions) are
      // shown whenever a segment is selected (hidden during draw-time via !segment).
      if (visibilityKey === MEP_SEGMENT_RIBBON_VISIBILITY_KEYS.selectionOnly) return true;
      const effective = effectiveSectionKind(segment.params);
      if (visibilityKey === MEP_SEGMENT_RIBBON_VISIBILITY_KEYS.domainAllowsSectionChoice) {
        return segment.params.domain === 'duct';
      }
      if (visibilityKey === MEP_SEGMENT_RIBBON_VISIBILITY_KEYS.rectangularSection) {
        return effective === 'rectangular';
      }
      if (visibilityKey === MEP_SEGMENT_RIBBON_VISIBILITY_KEYS.roundSection) {
        return effective === 'round';
      }
      if (visibilityKey === MEP_SEGMENT_RIBBON_VISIBILITY_KEYS.pipeDomain) {
        return segment.params.domain === 'pipe';
      }
      return false;
    },
    [resolveSegment, toolHandle],
  );

  return useMemo(
    () => ({ onComboboxChange, getComboboxState, onToggle, getToggleState, onAction, getPanelVisibility }),
    [onComboboxChange, getComboboxState, onToggle, getToggleState, onAction, getPanelVisibility],
  );
}

/** commandKey → numeric `MepSegmentParams` field (section dims only). */
const NUMBER_KEY_TO_FIELD: Readonly<Record<string, keyof MepSegmentParams>> = {
  [MEP_SEGMENT_RIBBON_KEYS.params.width]: 'width',
  [MEP_SEGMENT_RIBBON_KEYS.params.height]: 'height',
  [MEP_SEGMENT_RIBBON_KEYS.params.diameter]: 'diameter',
  // NOTE: slopePercent is NOT here — a slope edit moves the endpoint z (Φ14 #2),
  // it is not a stored scalar field. Handled explicitly in onComboboxChange.
};

/**
 * Format a derived slope % to match a `SLOPE_PERCENT_OPTIONS` string (ADR-408 Φ14
 * #2): round to 1 decimal and drop a trailing `.0` so `1.5`→'1.5', `2.0`→'2',
 * `0`→'0'. An off-list grade (from a manual elevation edit) renders as its rounded
 * value (the strict-select combobox then shows no preset highlighted — acceptable).
 */
function formatSlopePercentForCombobox(slopePercent: number): string {
  const rounded = Math.round(slopePercent * 10) / 10;
  return String(rounded);
}

/**
 * Build next params for an elevation edit (Φ-A). The two endpoint z's are the
 * authoritative source; `centerlineElevationMm` is kept in sync as the derived
 * midpoint cache. Returns `null` for any non-elevation key.
 *   - `centerlineElevation` → sets BOTH ends to `value` (whole-run flat lift).
 *   - `startElevation`      → sets the start end only (riser/slope).
 *   - `endElevation`        → sets the end end only (riser/slope).
 */
function buildElevationParams(
  params: MepSegmentParams,
  commandKey: string,
  value: number,
): MepSegmentParams | null {
  const cur = resolveSegmentEndpointElevationsMm(params);
  let startMm = cur.startMm;
  let endMm = cur.endMm;
  if (commandKey === MEP_SEGMENT_RIBBON_KEYS.params.centerlineElevation) {
    startMm = value;
    endMm = value;
  } else if (commandKey === MEP_SEGMENT_RIBBON_KEYS.params.startElevation) {
    startMm = value;
  } else if (commandKey === MEP_SEGMENT_RIBBON_KEYS.params.endElevation) {
    endMm = value;
  } else {
    return null;
  }
  return {
    ...params,
    startPoint: { ...params.startPoint, z: startMm },
    endPoint: { ...params.endPoint, z: endMm },
    centerlineElevationMm: deriveCenterlineElevationMm(startMm, endMm),
  };
}

/** Type guard used by `useRibbonCommands` composer (panel visibility). */
export function isMepSegmentPanelVisibilityKey(visibilityKey: string): boolean {
  return isMepSegmentVisibilityKey(visibilityKey);
}
