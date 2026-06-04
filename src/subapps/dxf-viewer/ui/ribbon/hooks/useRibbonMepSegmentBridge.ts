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
import {
  resolveSegmentSection,
  resolveSegmentEndpointElevationsMm,
  deriveCenterlineElevationMm,
} from '../../../bim/types/mep-segment-types';
import { useCommandHistory } from '../../../core/commands';
import { UpdateMepSegmentParamsCommand } from '../../../core/commands/entity-commands/UpdateMepSegmentParamsCommand';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
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
  'getPrimaryId' | 'clearAll'
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
      const sm = new LevelSceneManagerAdapter(
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

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      const segment = resolveSegment();
      if (!segment) return null;
      if (commandKey === MEP_SEGMENT_RIBBON_KEYS.stringParams.sectionKind) {
        return { value: effectiveSectionKind(segment.params), options: [] };
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
    [resolveSegment],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      const segment = resolveSegment();
      if (!segment) return;
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
      if (!isMepSegmentRibbonKey(commandKey)) return;
      const numeric = Number.parseFloat(value);
      if (Number.isNaN(numeric)) return;
      // Elevation edits touch the per-endpoint z's + the derived centreline cache
      // (Φ-A), not a single param field — handle them before the generic path.
      const elevParams = buildElevationParams(segment.params, commandKey, numeric);
      if (elevParams) {
        dispatchParams(segment, elevParams);
        return;
      }
      const field = NUMBER_KEY_TO_FIELD[commandKey];
      if (!field) return;
      const nextParams = { ...segment.params, [field]: numeric } as MepSegmentParams;
      dispatchParams(segment, nextParams);
    },
    [resolveSegment, dispatchParams],
  );

  const onToggle = useCallback((_key: string, _next: boolean): void => {
    /* no-op */
  }, []);
  const getToggleState = useCallback((_key: string): RibbonToggleState => NULL_TOGGLE, []);

  const onAction = useCallback(
    (action: string): void => {
      if (action === MEP_SEGMENT_RIBBON_KEYS_ACTIONS.close) {
        universalSelection.clearAll();
        return;
      }
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
      const segment = resolveSegment();
      if (!segment) return false;
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
      return false;
    },
    [resolveSegment],
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
};

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
