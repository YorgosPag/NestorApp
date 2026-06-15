'use client';

/**
 * ADR-363 Phase 5 / 5.5a — Bridge μεταξύ contextual Beam ribbon tab και active
 * `BeamEntity` params.
 *
 * Mirrors `useRibbonSlabBridge`: read state via `getComboboxState`, write via
 * `onComboboxChange`. Phase 5.5a routes every mutation through
 * `UpdateBeamParamsCommand` (via `useCommandHistory().execute`) ώστε η αλλαγή
 * να είναι undoable + geometry/validation να επανυπολογίζονται atomically.
 * `useBeamPersistence` picks up την αλλαγή μέσω debounced auto-save. Ribbon
 * edits χρησιμοποιούν `isDragging=false` ώστε κάθε edit να είναι δικό του
 * undo entry (drag merging ζει στο grip-commit path).
 *
 * No-ops για commandKeys εκτός `BEAM_RIBBON_KEYS` ώστε να composeί με τα
 * άλλα bridges στο `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.7 §6 Phase 5.5a
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isBeamEntity } from '../../../types/entities';
import type {
  BeamEntity,
  BeamIShapeParams,
  BeamKind,
  BeamParams,
  BeamSectionKind,
  BeamSectionType,
  BeamSupportType,
} from '../../../bim/types/beam-types';
import {
  DEFAULT_I_FLANGE_THICKNESS_MM,
  DEFAULT_I_WEB_THICKNESS_MM,
} from '../../../bim/types/column-types';
import { CATALOG_CUSTOM_SENTINEL } from '../../../bim/columns/section-catalog';
import { useCommandHistory } from '../../../core/commands';
import { UpdateBeamParamsCommand } from '../../../core/commands/entity-commands/UpdateBeamParamsCommand';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import {
  BEAM_RIBBON_KEYS,
  BEAM_RIBBON_KEYS_ACTIONS,
  BEAM_RIBBON_BADGE_KEYS,
  BEAM_RIBBON_VISIBILITY_KEYS,
  BEAM_FINISH_KEY_TO_FIELD,
  isBeamRibbonKey,
  isBeamRibbonStringKey,
  isBeamVisibilityKey,
  isBeamFinishKey,
} from './bridge/beam-command-keys';
import { resolveFinishComboboxState, applyFinishComboboxChange } from './bridge/finish-param';
import {
  applyEntityBeamCatalogPreset,
  catalogOwnsDimension,
  catalogOwnsNestedParam,
} from './bridge/beam-bridge-catalog-helpers';
import {
  readEnvelopeFunctionValue,
  parseEnvelopeFunctionValue,
} from './bridge/envelope-function-param';
import { PSET_RIBBON_ACTION } from './bridge/pset-action-keys';
import { EventBus } from '../../../systems/events/EventBus';
// ADR-441 Slice GEN-BEAM — one-shot «Δοκάρια από κάναβο» (στα segments).
import { getGlobalGuideStore } from '../../../systems/guides/guide-store';
import {
  commitBeamGridFromGuides,
  type BeamGridCommitResult,
} from '../../../bim/beams/beam-grid-commit';
import type { GridPerimeterMode } from '../../../bim/grid/grid-justification';
import { beamGridSettingsStore } from './bridge/grid-perimeter-mode-stores';
import { warnIfGridJustificationConflict } from '../../../bim/grid/grid-justification-consistency';
import { resolveSceneUnits } from '../../../utils/scene-units';
import type {
  RibbonComboboxState,
  RibbonToggleState,
} from '../context/RibbonCommandContext';
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

export interface UseRibbonBeamBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonBeamBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
  readonly getBadgeState: (badgeKey: string) => boolean;
  readonly onAction: (action: string) => void;
  /**
   * ADR-363 Φ2 — panel visibility resolver. `true` όταν το panel πρέπει να
   * εμφανίζεται· keys εκτός `BEAM_RIBBON_VISIBILITY_KEYS` → `true` (no-op).
   * ishapeCatalog/ishapeParams → ορατά μόνο όταν `sectionKind === 'I-shape'`.
   */
  readonly getPanelVisibility: (visibilityKey: string) => boolean;
}

const BEAM_OWNED_BADGE_KEYS: ReadonlySet<string> = new Set<string>([
  BEAM_RIBBON_BADGE_KEYS.violations,
]);

const NULL_TOGGLE: RibbonToggleState = false;

const NUMBER_KEY_TO_FIELD: Readonly<Record<string, keyof BeamParams>> = {
  [BEAM_RIBBON_KEYS.params.width]:           'width',
  [BEAM_RIBBON_KEYS.params.depth]:           'depth',
  [BEAM_RIBBON_KEYS.params.topElevation]:    'topElevation',
  [BEAM_RIBBON_KEYS.params.topElevationEnd]: 'topElevationEnd',
};

const STRING_KEY_TO_FIELD: Readonly<Record<string, keyof BeamParams>> = {
  [BEAM_RIBBON_KEYS.stringParams.kind]:                'kind',
  [BEAM_RIBBON_KEYS.stringParams.supportType]:         'supportType',
  [BEAM_RIBBON_KEYS.stringParams.material]:            'material',
  [BEAM_RIBBON_KEYS.stringParams.sectionType]:         'sectionType',
  [BEAM_RIBBON_KEYS.stringParams.profileDesignation]:  'profileDesignation',
  [BEAM_RIBBON_KEYS.stringParams.sectionKind]:         'sectionKind',
};

/**
 * ADR-441 Slice GEN-BEAM — toast μετά το «Δοκάρια από κάναβο». Το `up-to-date` (κάθε
 * segment έχει ήδη δοκό) ΔΕΝ είναι αποτυχία: εκπέμπεται ως success-style summary με
 * created=0.
 */
function emitBeamsFromGridToast(result: BeamGridCommitResult): void {
  if (result.ok || result.reason === 'up-to-date') {
    EventBus.emit('bim:beams-from-grid', { created: result.created, skipped: result.skipped });
  } else {
    EventBus.emit('bim:beams-from-grid-failed', { reason: result.reason ?? 'insufficient-guides' });
  }
}

export function useRibbonBeamBridge(
  props: UseRibbonBeamBridgeProps,
): RibbonBeamBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');

  const resolveBeam = useCallback((): BeamEntity | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const e = scene.entities.find((x) => x.id === id);
    if (!e || !isBeamEntity(e)) return null;
    return e;
  }, [levelManager, universalSelection]);

  /**
   * Dispatch the params patch through `UpdateBeamParamsCommand` so the change
   * is undoable + geometry/validation recompute atomically (ADR-363 Phase 5.5a).
   * `useBeamPersistence` picks up the patched entity via debounced auto-save.
   */
  const dispatchParams = useCallback(
    (beam: BeamEntity, nextParams: BeamParams): void => {
      if (!levelManager.currentLevelId) return;
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateBeamParamsCommand(beam.id, nextParams, beam.params, sm, false),
      );
      EventBus.emit('bim:beam-params-updated', { beamId: beam.id });
    },
    [executeCommand, levelManager],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      const beam = resolveBeam();
      if (!beam) return null;
      // ADR-396 v2 Φ6a — ETICS override: undefined (απών) → 'auto' sentinel.
      if (commandKey === BEAM_RIBBON_KEYS.stringParams.envelopeFunction) {
        return { value: readEnvelopeFunctionValue(beam.params.envelopeFunction), options: [] };
      }
      // ADR-449 Slice 5 — σοβάς per-element override (enabled/υλικά/πάχος).
      if (isBeamFinishKey(commandKey)) {
        return resolveFinishComboboxState(beam.params.finish, commandKey, BEAM_FINISH_KEY_TO_FIELD);
      }
      // ADR-363 Φ2 — catalog profile: absent → 'custom' sentinel (Revit-style).
      if (commandKey === BEAM_RIBBON_KEYS.stringParams.catalogProfile) {
        return { value: beam.params.catalogProfile ?? CATALOG_CUSTOM_SENTINEL, options: [] };
      }
      if (isBeamRibbonStringKey(commandKey)) {
        const field = STRING_KEY_TO_FIELD[commandKey];
        const raw = beam.params[field];
        // ADR-363 Phase 5.5c — surface 'rc' as the active selection when
        // `params.material` is undefined; mirrors the `resolveBeamMaterialKey`
        // fallback used by `BeamRenderer.drawMaterialHatch`.
        if (raw == null) {
          if (field === 'material') return { value: 'rc', options: [] };
          // ADR-363 Φ2 — sectionKind absent → 'rectangular' (default διατομή).
          if (field === 'sectionKind') return { value: 'rectangular', options: [] };
          return null;
        }
        return { value: String(raw), options: [] };
      }
      // ADR-363 Φ2 — nested I-shape thickness (params.ishape.*) → τρέχουσα ή default.
      if (commandKey === BEAM_RIBBON_KEYS.params.flangeThickness) {
        return {
          value: String(Math.round(beam.params.ishape?.flangeThickness ?? DEFAULT_I_FLANGE_THICKNESS_MM)),
          options: [],
        };
      }
      if (commandKey === BEAM_RIBBON_KEYS.params.webThickness) {
        return {
          value: String(Math.round(beam.params.ishape?.webThickness ?? DEFAULT_I_WEB_THICKNESS_MM)),
          options: [],
        };
      }
      if (isBeamRibbonKey(commandKey)) {
        const field = NUMBER_KEY_TO_FIELD[commandKey];
        const raw = beam.params[field];
        // ADR-401 Phase E.2 — `topElevationEnd` απών (flat δοκός) → surface το
        // `topElevation` ώστε το πεδίο να δείχνει την τρέχουσα (flat) στάθμη·
        // αλλαγή σε διαφορετική τιμή κάνει τη δοκό κεκλιμένη.
        if (
          commandKey === BEAM_RIBBON_KEYS.params.topElevationEnd &&
          typeof raw !== 'number'
        ) {
          return { value: String(Math.round(beam.params.topElevation)), options: [] };
        }
        if (typeof raw !== 'number') return null;
        return { value: String(Math.round(raw)), options: [] };
      }
      return null;
    },
    [resolveBeam],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      const beam = resolveBeam();
      if (!beam) return;

      // ADR-396 v2 Φ6a — ETICS override: 'auto' → clear (undefined)· άκυρη → no-op.
      if (commandKey === BEAM_RIBBON_KEYS.stringParams.envelopeFunction) {
        const parsed = parseEnvelopeFunctionValue(value);
        if (!parsed) return;
        dispatchParams(beam, { ...beam.params, envelopeFunction: parsed.fn });
        return;
      }

      // ADR-449 Slice 5 — σοβάς per-element override (enabled/υλικά/πάχος).
      if (isBeamFinishKey(commandKey)) {
        const next = applyFinishComboboxChange(beam.params, commandKey, value, BEAM_FINISH_KEY_TO_FIELD);
        if (next) dispatchParams(beam, next);
        return;
      }

      // ADR-363 Φ2 — EN 10365 catalog preset: batch-write dims + ishape +
      // sectionKind='I-shape' σε ΕΝΑ command (single undo). 'custom' → no-op.
      if (commandKey === BEAM_RIBBON_KEYS.stringParams.catalogProfile) {
        applyEntityBeamCatalogPreset(beam, value, dispatchParams);
        return;
      }

      // ADR-363 Φ2 — nested I-shape thickness (params.ishape.*) → clear catalog (Custom).
      if (
        commandKey === BEAM_RIBBON_KEYS.params.flangeThickness ||
        commandKey === BEAM_RIBBON_KEYS.params.webThickness
      ) {
        const numeric = Number.parseFloat(value);
        if (Number.isNaN(numeric)) return;
        const nextIshape: BeamIShapeParams = {
          ...(beam.params.ishape ?? {}),
          ...(commandKey === BEAM_RIBBON_KEYS.params.flangeThickness
            ? { flangeThickness: numeric }
            : { webThickness: numeric }),
        };
        const clearsCatalog = catalogOwnsNestedParam(commandKey, beam.params.sectionKind);
        dispatchParams(beam, {
          ...beam.params,
          ishape: nextIshape,
          ...(clearsCatalog ? { catalogProfile: undefined } : {}),
        });
        return;
      }

      if (isBeamRibbonStringKey(commandKey)) {
        const field = STRING_KEY_TO_FIELD[commandKey];
        if (field === 'kind') {
          const nextParams: BeamParams = { ...beam.params, kind: value as BeamKind };
          dispatchParams(beam, nextParams);
          return;
        }
        if (field === 'sectionKind') {
          const nextParams: BeamParams = { ...beam.params, sectionKind: value as BeamSectionKind };
          dispatchParams(beam, nextParams);
          return;
        }
        if (field === 'supportType') {
          const nextParams: BeamParams = { ...beam.params, supportType: value as BeamSupportType };
          dispatchParams(beam, nextParams);
          return;
        }
        if (field === 'material') {
          const nextParams: BeamParams = { ...beam.params, material: value };
          dispatchParams(beam, nextParams);
          return;
        }
        if (field === 'sectionType') {
          const nextParams: BeamParams = { ...beam.params, sectionType: value as BeamSectionType };
          dispatchParams(beam, nextParams);
          return;
        }
        if (field === 'profileDesignation') {
          const nextParams: BeamParams = { ...beam.params, profileDesignation: value || undefined };
          dispatchParams(beam, nextParams);
          return;
        }
        return;
      }

      if (isBeamRibbonKey(commandKey)) {
        const numeric = Number.parseFloat(value);
        if (Number.isNaN(numeric)) return;
        const field = NUMBER_KEY_TO_FIELD[commandKey];
        // ADR-363 Φ2 — χειροκίνητη αλλαγή width/depth σε I-shape → catalog «Custom».
        const clearsCatalog = catalogOwnsDimension(commandKey, beam.params.sectionKind);
        const nextParams: BeamParams = {
          ...beam.params,
          [field]: numeric,
          ...(clearsCatalog ? { catalogProfile: undefined } : {}),
        } as BeamParams;
        dispatchParams(beam, nextParams);
      }
    },
    [resolveBeam, dispatchParams],
  );

  const onToggle = useCallback((_key: string, _next: boolean): void => {
    /* no-op Phase 5 */
  }, []);

  const getToggleState = useCallback((_key: string): RibbonToggleState => NULL_TOGGLE, []);

  const getBadgeState = useCallback((badgeKey: string): boolean => {
    if (!BEAM_OWNED_BADGE_KEYS.has(badgeKey)) return false;
    const beam = resolveBeam();
    if (!beam) return false;
    if (badgeKey === BEAM_RIBBON_BADGE_KEYS.violations) {
      return beam.validation.hasCodeViolations;
    }
    return false;
  }, [resolveBeam]);

  // ADR-441 Slice GEN-BEAM / 3-mode — «Δοκάρια από κάναβο»: born-bound δοκός σε κάθε
  // segment άξονα (idempotent), με περιμετρική έδραση (center/inner/outer). Το mode
  // γράφεται στο SSoT store (το διαβάζει ΚΑΙ future settle) + περνά στο commit. Πάντα toast.
  const handleBeamsFromGrid = useCallback((mode: GridPerimeterMode): void => {
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;
    beamGridSettingsStore.set(mode);
    const scene = levelManager.getLevelScene(levelId);
    const result = commitBeamGridFromGuides({
      guideReader: getGlobalGuideStore(),
      getLevelScene: levelManager.getLevelScene,
      setLevelScene: levelManager.setLevelScene,
      levelId,
      sceneUnits: scene ? resolveSceneUnits(scene) : 'mm',
      executeCommand,
      perimeterMode: beamGridSettingsStore.get(),
    });
    emitBeamsFromGridToast(result);
    // ADR-441 3-mode — soft warning αν η έδραση ασυνεπεί με υπάρχοντα grid-στοιχεία.
    warnIfGridJustificationConflict(levelManager.getLevelScene(levelId));
  }, [levelManager, executeCommand]);

  const onAction = useCallback(
    (action: string): void => {
      if (action === PSET_RIBBON_ACTION) {
        const beam = resolveBeam();
        if (!beam || !levelManager.currentLevelId) return;
        EventBus.emit('bim:pset-editor-open', {
          entityId: beam.id,
          levelId: levelManager.currentLevelId,
          entityType: 'beam',
        });
        return;
      }
      if (action === BEAM_RIBBON_KEYS_ACTIONS.fromGrid) { handleBeamsFromGrid('inner'); return; }
      if (action === BEAM_RIBBON_KEYS_ACTIONS.fromGridCenter) { handleBeamsFromGrid('center'); return; }
      if (action === BEAM_RIBBON_KEYS_ACTIONS.fromGridOuter) { handleBeamsFromGrid('outer'); return; }
      // ADR-459 Φ4d — «Αυτόματος Οπλισμός» του επιλεγμένου δοκαριού (undoable command
      // μέσω useStructuralAutoReinforce· parity με την κολόνα).
      if (action === BEAM_RIBBON_KEYS_ACTIONS.autoReinforce) {
        const beam = resolveBeam();
        if (beam) EventBus.emit('bim:auto-reinforce-requested', { entityIds: [beam.id] });
        return;
      }
      if (action !== BEAM_RIBBON_KEYS_ACTIONS.delete) return;
      const beam = resolveBeam();
      if (!beam) return;
      const confirmed = window.confirm(
        t('ribbon.commands.beamEditor.deleteConfirm'),
      );
      if (!confirmed) return;
      EventBus.emit('bim:beam-delete-requested', { beamId: beam.id });
    },
    [resolveBeam, levelManager, t, handleBeamsFromGrid],
  );

  /**
   * ADR-363 Φ2 — panel visibility resolver (mirror column). ishapeCatalog +
   * ishapeParams ορατά μόνο όταν το επιλεγμένο δοκάρι έχει `sectionKind ===
   * 'I-shape'`. Default 'rectangular' (απών) → κρυφά.
   */
  const getPanelVisibility = useCallback(
    (visibilityKey: string): boolean => {
      if (!isBeamVisibilityKey(visibilityKey)) return true;
      const beam = resolveBeam();
      const sectionKind: BeamSectionKind = beam?.params.sectionKind ?? 'rectangular';
      if (
        visibilityKey === BEAM_RIBBON_VISIBILITY_KEYS.ishapeCatalog ||
        visibilityKey === BEAM_RIBBON_VISIBILITY_KEYS.ishapeParams
      ) {
        return sectionKind === 'I-shape';
      }
      return true;
    },
    [resolveBeam],
  );

  return useMemo(
    () => ({ onComboboxChange, getComboboxState, onToggle, getToggleState, getBadgeState, onAction, getPanelVisibility }),
    [onComboboxChange, getComboboxState, onToggle, getToggleState, getBadgeState, onAction, getPanelVisibility],
  );
}

/** Type guard used by `useRibbonCommands` composer. */
export function isBeamBadgeKey(badgeKey: string): boolean {
  return BEAM_OWNED_BADGE_KEYS.has(badgeKey);
}

/** ADR-363 Φ2 — type guard used by `useRibbonCommands` composer (panel visibility). */
export function isBeamPanelVisibilityKey(visibilityKey: string): boolean {
  return isBeamVisibilityKey(visibilityKey);
}

/** Exposed so action interceptor μπορεί να αναγνωρίσει `beam.actions.close`. */
export const BEAM_BRIDGE_ACTIONS = BEAM_RIBBON_KEYS_ACTIONS;
