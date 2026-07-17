'use client';

/**
 * ADR-363 Phase 2.5 — Bridge μεταξύ contextual Opening ribbon tab και
 * active `OpeningEntity` params.
 *
 * Mirrors `useRibbonWallBridge`: read state via `getComboboxState`, write via
 * `onComboboxChange`. Phase 2.5 routes every mutation through
 * `UpdateOpeningParamsCommand` (via `useCommandHistory().execute`) so the
 * change is undoable + auto-save picks up the patched entity via
 * `useOpeningPersistence` debounce. Ribbon edits use `isDragging=false` so each
 * edit is its own undo entry (drag merging lives in the grip-commit path).
 *
 * No-ops for commandKeys outside `OPENING_RIBBON_KEYS` so it composes με τα
 * stair / wall / array / text bridges στο `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.4 §6
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isOpeningEntity } from '../../../types/entities';
import { isDoorKind } from '../../../bim/types/opening-types';
import type { OpeningEntity, OpeningKind, OpeningParams } from '../../../bim/types/opening-types';
import { markAllCanvasDirty } from '../../../rendering/core/UnifiedFrameScheduler';
import {
  OPENING_RIBBON_KEYS,
  OPENING_RIBBON_KEYS_ACTIONS,
  OPENING_RIBBON_BADGE_KEYS,
  OPENING_TAG_STYLE_KEYS,
  isOpeningRibbonKey,
  isOpeningRibbonStringKey,
  isOpeningTagStyleComboboxKey,
  isOpeningTypeGovernedComboboxKey,
  isOpeningFrameProfileKey,
} from './bridge/opening-command-keys';
import {
  resolveOpeningFrameProfileComboboxState,
  buildOpeningFrameProfileParamsPatch,
} from './bridge/opening-frame-profile-bridge';
import { useOpeningParamsDispatcher } from './bridge/useOpeningParamsDispatcher';
import { PSET_RIBBON_ACTION } from './bridge/pset-action-keys';
import {
  getOpeningTagStyleService,
  type OpeningTagStyle,
} from '../../../bim/services/opening-tag-style-service';
import { EventBus } from '../../../systems/events/EventBus';
// ADR-032/390/401 — «Διαγραφή» routes through the canonical command-based delete
// (undoable + cascades), shared with the keyboard Delete. No more raw event emit.
import { useRibbonEntityDelete } from './useRibbonEntityDelete';
import {
  useResolveSelectedEntity,
  useViolationBadgeState,
  useStableBridge,
} from './ribbon-entity-bridge-shared';
import type {
  RibbonComboboxState,
  RibbonToggleState,
} from '../context/RibbonCommandContext';
import type { RibbonBridgeCore } from './bridge/ribbon-bridge-core';
import type { LevelSceneWriter } from '../../../systems/levels/level-scene-accessor';
import type { useUniversalSelection } from '../../../systems/selection';

type UniversalSelectionLike = Pick<
  ReturnType<typeof useUniversalSelection>,
  'getPrimaryId' | 'clearByType'
>;

export interface UseRibbonOpeningBridgeProps {
  readonly levelManager: LevelSceneWriter;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonOpeningBridge extends RibbonBridgeCore {
  /** Returns `true` when the currently selected opening has code violations. */
  readonly getBadgeState: (badgeKey: string) => boolean;
}

const OPENING_OWNED_BADGE_KEYS: ReadonlySet<string> = new Set<string>([
  OPENING_RIBBON_BADGE_KEYS.violations,
]);

const NULL_TOGGLE: RibbonToggleState = false;

const NUMBER_KEY_TO_FIELD: Readonly<Record<string, keyof OpeningParams>> = {
  [OPENING_RIBBON_KEYS.params.width]: 'width',
  [OPENING_RIBBON_KEYS.params.height]: 'height',
  [OPENING_RIBBON_KEYS.params.sillHeight]: 'sillHeight',
  [OPENING_RIBBON_KEYS.params.thresholdEmbedMm]: 'thresholdEmbedMm',
};

const STRING_KEY_TO_FIELD: Readonly<Record<string, keyof OpeningParams>> = {
  [OPENING_RIBBON_KEYS.stringParams.kind]: 'kind',
  [OPENING_RIBBON_KEYS.stringParams.handing]: 'handing',
  [OPENING_RIBBON_KEYS.stringParams.openDirection]: 'openDirection',
  [OPENING_RIBBON_KEYS.stringParams.mark]: 'mark',
  [OPENING_RIBBON_KEYS.stringParams.thresholdEmbed]: 'thresholdEmbed',
};

export function useRibbonOpeningBridge(
  props: UseRibbonOpeningBridgeProps,
): RibbonOpeningBridge {
  const { levelManager, universalSelection } = props;
  const { t } = useTranslation('dxf-viewer-shell');
  const ribbonDelete = useRibbonEntityDelete({ levelManager, universalSelection });
  const dispatchOpeningParams = useOpeningParamsDispatcher({ levelManager });

  // React state mirror of leaderVisible — causes ribbon toggle button to
  // re-render when the service changes (sidebar dialog / ribbon both write).
  const [leaderVisible, setLeaderVisible] = useState(
    () => getOpeningTagStyleService().getCurrentStyle().leaderVisible,
  );
  useEffect(
    () => getOpeningTagStyleService().subscribe(() => {
      setLeaderVisible(getOpeningTagStyleService().getCurrentStyle().leaderVisible);
    }),
    [],
  );

  const resolveOpening = useResolveSelectedEntity(levelManager, universalSelection, isOpeningEntity);

  /**
   * Dispatch the params patch through `UpdateOpeningParamsCommand` (via the
   * shared `useOpeningParamsDispatcher` SSoT) so the change is undoable +
   * geometry/validation recompute atomically against the live host wall.
   * `useOpeningPersistence` picks up the patched entity via debounced
   * auto-save. The `bim:opening-params-updated` emit is this bridge's own
   * concern (drives ribbon-adjacent listeners), kept here rather than in the
   * shared dispatcher.
   */
  const dispatchParams = useCallback(
    (opening: OpeningEntity, nextParams: OpeningParams): void => {
      dispatchOpeningParams(opening, nextParams);
      EventBus.emit('bim:opening-params-updated', { openingId: opening.id });
    },
    [dispatchOpeningParams],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      const opening = resolveOpening();
      if (!opening) return null;
      // ADR-421 SLICE C follow-up (a) — a typed opening renders its
      // type-governed comboboxes (kind/width/height) read-only (Revit-style),
      // editable only via «Edit type». Untyped openings stay fully editable.
      const disabled =
        opening.typeId != null && isOpeningTypeGovernedComboboxKey(commandKey);
      // ADR-611 — frame profile editor (manufacturer/profile/faceWidth/depth).
      // Instance-owned (never type-governed) — stays editable regardless of
      // `opening.typeId`, mirroring `sillHeight`/`handing`.
      if (isOpeningFrameProfileKey(commandKey)) {
        return resolveOpeningFrameProfileComboboxState(commandKey, opening);
      }
      // ADR-673 — Κατώφλι vertical placement. Absent params ⇒ display the same
      // resolved default `resolveOpeningThreshold` would use (`'none'` / `0`),
      // and the mm field renders disabled until `thresholdEmbed==='custom'`.
      if (commandKey === OPENING_RIBBON_KEYS.stringParams.thresholdEmbed) {
        return { value: opening.params.thresholdEmbed ?? 'none', options: [], disabled };
      }
      if (commandKey === OPENING_RIBBON_KEYS.params.thresholdEmbedMm) {
        const embedActive = (opening.params.thresholdEmbed ?? 'none') === 'custom';
        return {
          value: String(Math.round(opening.params.thresholdEmbedMm ?? 0)),
          options: [],
          disabled: disabled || !embedActive,
        };
      }
      if (isOpeningRibbonStringKey(commandKey)) {
        const field = STRING_KEY_TO_FIELD[commandKey];
        const raw = opening.params[field];
        return raw == null ? null : { value: String(raw), options: [], disabled };
      }
      if (isOpeningRibbonKey(commandKey)) {
        const field = NUMBER_KEY_TO_FIELD[commandKey];
        const raw = opening.params[field];
        if (typeof raw !== 'number') return null;
        return { value: String(Math.round(raw)), options: [], disabled };
      }
      // Tag style — per-project, read from service (sync getter).
      if (isOpeningTagStyleComboboxKey(commandKey)) {
        const style = getOpeningTagStyleService().getCurrentStyle();
        switch (commandKey) {
          case OPENING_TAG_STYLE_KEYS.fontSizePx:    return { value: String(style.fontSizePx), options: [] };
          case OPENING_TAG_STYLE_KEYS.borderWidthPx: return { value: String(style.borderWidthPx), options: [] };
          case OPENING_TAG_STYLE_KEYS.leaderStyle:   return { value: style.leaderStyle, options: [] };
          case OPENING_TAG_STYLE_KEYS.pillBgColor:   return { value: style.pillBgColor, options: [] };
          case OPENING_TAG_STYLE_KEYS.leaderColor:   return { value: style.leaderColor, options: [] };
        }
      }
      return null;
    },
    [resolveOpening],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      // Tag style — per-project, routed directly to service (no undo entry needed).
      if (isOpeningTagStyleComboboxKey(commandKey)) {
        const patch: { -readonly [K in keyof OpeningTagStyle]?: OpeningTagStyle[K] } = {};
        switch (commandKey) {
          case OPENING_TAG_STYLE_KEYS.fontSizePx:    patch.fontSizePx    = Number(value); break;
          case OPENING_TAG_STYLE_KEYS.borderWidthPx: patch.borderWidthPx = Number(value); break;
          case OPENING_TAG_STYLE_KEYS.leaderStyle:   patch.leaderStyle   = value as OpeningTagStyle['leaderStyle']; break;
          case OPENING_TAG_STYLE_KEYS.pillBgColor:   patch.pillBgColor   = value; break;
          case OPENING_TAG_STYLE_KEYS.leaderColor:   patch.leaderColor   = value; break;
        }
        getOpeningTagStyleService().mutateStyle(patch);
        markAllCanvasDirty();
        return;
      }

      const opening = resolveOpening();
      if (!opening) return;

      // ADR-421 SLICE C follow-up (a) — defense-in-depth: never let a
      // type-governed edit reach UpdateOpeningParamsCommand on a typed opening.
      // The next catalog re-resolution / reload would otherwise overwrite it
      // («type wins»), silently dropping the user's edit. UI gating already
      // disables these comboboxes; this guards against programmatic calls.
      if (opening.typeId != null && isOpeningTypeGovernedComboboxKey(commandKey)) {
        return;
      }

      // ADR-673 — defense-in-depth: never let a mm-depth edit land while the UI
      // has the field disabled (thresholdEmbed !== 'custom'). Mirrors the
      // type-governed guard above.
      if (
        commandKey === OPENING_RIBBON_KEYS.params.thresholdEmbedMm
        && (opening.params.thresholdEmbed ?? 'none') !== 'custom'
      ) {
        return;
      }

      // ADR-611 — frame profile editor writes (see resolver comment above).
      if (isOpeningFrameProfileKey(commandKey)) {
        const nextParams = buildOpeningFrameProfileParamsPatch(commandKey, value, opening);
        if (nextParams) dispatchParams(opening, nextParams);
        return;
      }

      if (isOpeningRibbonStringKey(commandKey)) {
        const field = STRING_KEY_TO_FIELD[commandKey];
        const nextParams: OpeningParams = { ...opening.params, [field]: value as OpeningKind } as OpeningParams;
        // ADR-376 Phase B.1 — Mark edits flip markIsManual to true so
        // future Renumber operations preserve the user's choice by default.
        if (field === 'mark') {
          (nextParams as { -readonly [K in keyof OpeningParams]: OpeningParams[K] }).markIsManual = true;
        }
        // Switching kind also retargets defaults: if user picks a kind that has
        // no handing/openDirection (window/fixed), leave those undefined.
        dispatchParams(opening, nextParams);
        return;
      }

      if (isOpeningRibbonKey(commandKey)) {
        const numeric = Number.parseFloat(value);
        if (Number.isNaN(numeric)) return;
        const field = NUMBER_KEY_TO_FIELD[commandKey];
        const nextParams: OpeningParams = { ...opening.params, [field]: numeric } as OpeningParams;
        dispatchParams(opening, nextParams);
      }
    },
    [resolveOpening, dispatchParams],
  );

  const onToggle = useCallback((key: string, next: boolean): void => {
    if (key === OPENING_TAG_STYLE_KEYS.leaderVisible) {
      getOpeningTagStyleService().mutateStyle({ leaderVisible: next });
      markAllCanvasDirty();
      return;
    }
    // ADR-673 — Κατώφλι on/off. Writes straight through UpdateOpeningParamsCommand
    // (undoable), same path as every other opening param — no service involved.
    if (key === OPENING_RIBBON_KEYS.toggles.hasThreshold) {
      const opening = resolveOpening();
      if (!opening) return;
      dispatchParams(opening, { ...opening.params, hasThreshold: next } as OpeningParams);
    }
  }, [resolveOpening, dispatchParams]);

  const getToggleState = useCallback((key: string): RibbonToggleState => {
    if (key === OPENING_TAG_STYLE_KEYS.leaderVisible) return leaderVisible;
    if (key === OPENING_RIBBON_KEYS.toggles.hasThreshold) {
      const opening = resolveOpening();
      if (!opening) return NULL_TOGGLE;
      // Mirrors `resolveOpeningThreshold`'s implicit default (ADR-673): absent
      // ⇒ true for every door kind, false otherwise.
      return opening.params.hasThreshold ?? isDoorKind(opening.params.kind);
    }
    return NULL_TOGGLE;
  }, [leaderVisible, resolveOpening]);

  const getBadgeState = useViolationBadgeState(
    resolveOpening,
    OPENING_OWNED_BADGE_KEYS,
    OPENING_RIBBON_BADGE_KEYS.violations,
  );

  const onAction = useCallback(
    (action: string): void => {
      if (action === PSET_RIBBON_ACTION) {
        const opening = resolveOpening();
        if (!opening || !levelManager.currentLevelId) return;
        EventBus.emit('bim:pset-editor-open', {
          entityId: opening.id,
          levelId: levelManager.currentLevelId,
          entityType: 'opening',
        });
        return;
      }
      if (action === OPENING_RIBBON_KEYS_ACTIONS.renumber) {
        // ADR-376 Phase B.1 — Open Renumber dialog. No selection prereq —
        // the modal owns scope/kind controls and falls back to current floor.
        EventBus.emit('bim:opening-renumber-requested', {});
        return;
      }
      if (action === OPENING_RIBBON_KEYS_ACTIONS.openTagStyle) {
        // ADR-376 Phase C.2 — Open Tag Style dialog (per-project styling).
        EventBus.emit('bim:opening-tag-style-requested', {});
        return;
      }
      if (action === OPENING_RIBBON_KEYS_ACTIONS.exportSchedulePdf) {
        // ADR-376 Phase C.3 — Export opening schedule PDF (doors + windows).
        EventBus.emit('bim:opening-schedule-pdf-requested', {});
        return;
      }
      if (action === OPENING_TAG_STYLE_KEYS.leaderVisible) {
        const svc = getOpeningTagStyleService();
        svc.mutateStyle({ leaderVisible: !svc.getCurrentStyle().leaderVisible });
        markAllCanvasDirty();
        return;
      }
      if (action === OPENING_RIBBON_KEYS_ACTIONS.resetTagPosition) {
        // ADR-376 Phase C.1 — clear tagOffset so the pill snaps back to the
        // auto-centroid + offset normal-to-wall outward. Field removed so the
        // Firestore document does not carry a stale {dx:0, dy:0} payload.
        const opening = resolveOpening();
        if (!opening) return;
        if (opening.params.tagOffset === undefined) return;
        const { tagOffset: _omit, ...rest } = opening.params;
        void _omit;
        dispatchParams(opening, rest as OpeningParams);
        return;
      }
      if (action !== OPENING_RIBBON_KEYS_ACTIONS.delete) return;
      const opening = resolveOpening();
      if (!opening) return;
      const confirmed = window.confirm(
        t('ribbon.commands.openingEditor.deleteConfirm'),
      );
      if (!confirmed) return;
      ribbonDelete.deleteEntity(opening.id);
    },
    [resolveOpening, levelManager, t, ribbonDelete],
  );

  return useStableBridge({ onComboboxChange, getComboboxState, onToggle, getToggleState, getBadgeState, onAction });
}

/** Type guard used by `useRibbonCommands` composer. */
export function isOpeningBadgeKey(badgeKey: string): boolean {
  return OPENING_OWNED_BADGE_KEYS.has(badgeKey);
}

/** Exposed so the action interceptor can recognize `opening.actions.close`. */
export const OPENING_BRIDGE_ACTIONS = OPENING_RIBBON_KEYS_ACTIONS;
