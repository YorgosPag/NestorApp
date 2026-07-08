/**
 * ⚠️  ARCHITECTURE-CRITICAL — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-581 Φ6 — «Σύριγγα» live hover ghost preview hook.
 *
 * Όταν το εργαλείο `match-properties` είναι ενεργό ΚΑΙ η σύριγγα είναι φορτωμένη
 * (`match-brush-store`), το hover πάνω σε άλλη οντότητα ζωγραφίζει live προεπισκόπηση
 * του αποτελέσματος (στυλ + ξανασχηματισμένη γεωμετρία) ΠΡΙΝ το click. Το φάντασμα
 * χτίζεται από τα ΙΔΙΑ patches/ρόλους με το click-commit (`collectMatchPatches` +
 * `getDefaultChecklist`) → ghost ≡ commit.
 *
 * ADR-040 (micro-leaf): αυτός ο hook είναι ο ΜΟΝΟΣ subscriber σε hover / brush /
 * activeTool σε αυτό το μονοπάτι· τρέχει μέσα σε ένα always-mounted leaf
 * (`MatchHoverGhostPreviewMount`) ώστε ο orchestrator (CanvasSection) να μένει inert.
 * `cursorMode:'none'` → το ghost δεν ακολουθεί τον cursor per-frame· ζωγραφίζεται σε
 * hover-change + transform-change μόνο (recolor/reshape in place).
 *
 * Part B (lifecycle): όταν το εργαλείο φεύγει από `match-properties`, αδειάζει τη
 * σύριγγα (`clearMatchBrushSource`) ώστε η επόμενη ενεργοποίηση να ξεκινά «άδεια».
 *
 * @see hooks/tools/useCanvasGhostPreview — shared RAF/clear/viewport harness (ADR-398 §4)
 * @see hooks/tools/useMepFixtureGhostPreview — πρότυπο WYSIWYG ghost hook
 * @see systems/match-properties/match-preview-entity — buildMatchPreviewEntity (ghost ≡ commit)
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { ViewTransform } from '../../rendering/types/Types';
import type { EntityType } from '../../types/entities';
import type { SceneEntity } from '../../core/commands/interfaces';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { LevelSceneReader } from '../../systems/levels/level-scene-accessor';
import {
  getMatchBrushSource,
  subscribeMatchBrush,
  clearMatchBrushSource,
  getDefaultChecklist,
  resolveSemanticMapping,
  collectMatchPatches,
  buildMatchPreviewEntity,
} from '../../systems/match-properties';
import { applyMemberSectionLock } from '../../bim/structural/sizing/member-section-lock';
import type { Entity } from '../../types/entities';
import { useHoveredEntity } from '../../systems/hover/useHover';
import { useActiveTool } from '../../stores/ToolStateStore';
import { drawRealEntityPreview } from '../../rendering/ghost/draw-real-entity-preview';
import { GHOST_DEFAULTS } from '../../rendering/ghost';
import { useBimPreviewRenderer } from './useBimPreviewRenderer';
import { useLevelLayersById } from './useLevelLayersById';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';

export interface UseMatchHoverGhostPreviewProps {
  readonly transform: ViewTransform;
  readonly levelManager: LevelSceneReader;
  getCanvas(): HTMLCanvasElement | null;
  getViewportElement?(): HTMLElement | null;
}

export function useMatchHoverGhostPreview(props: Readonly<UseMatchHoverGhostPreviewProps>): void {
  const { transform, levelManager, getCanvas, getViewportElement } = props;

  const activeTool = useActiveTool();
  const hoveredId = useHoveredEntity();
  const source = useSyncExternalStore(subscribeMatchBrush, getMatchBrushSource, getMatchBrushSource);

  // Part B — clear the syringe when the tool is deactivated (Escape / άλλο εργαλείο),
  // ώστε η επόμενη ενεργοποίηση να ξεκινά «άδεια» → icon empty.
  const prevToolRef = useRef(activeTool);
  useEffect(() => {
    if (prevToolRef.current === 'match-properties' && activeTool !== 'match-properties') {
      clearMatchBrushSource();
    }
    prevToolRef.current = activeTool;
  }, [activeTool]);

  const isActive =
    activeTool === 'match-properties' &&
    source != null &&
    hoveredId != null &&
    hoveredId !== source.id;

  // ADR-550 — lazy real-entity renderer + level layer table (shared SSoT hooks).
  const getBimPreview = useBimPreviewRenderer();
  const getLayersById = useLevelLayersById(levelManager);

  const draw = useCallback(({ ctx, viewport, transform: t }: GhostDrawFrame) => {
    if (!source || !hoveredId || hoveredId === source.id) return;
    const levelId = levelManager.currentLevelId;
    const scene = levelId ? levelManager.getLevelScene(levelId) : null;
    if (!scene?.entities) return;

    const sourceEntity = scene.entities.find((e) => e.id === source.id);
    const targetEntity = scene.entities.find((e) => e.id === hoveredId);
    if (!sourceEntity || !targetEntity) return;
    const sourceType = sourceEntity.type as EntityType;
    const targetType = targetEntity.type as EntityType;

    // Ίδιοι ρόλοι με το click-commit (habit default) → ghost ≡ commit.
    const roles = getDefaultChecklist(
      source.type,
      targetType,
      resolveSemanticMapping(source.type, targetType).map((m) => m.role),
    );
    if (roles.size === 0) return;

    const patches = collectMatchPatches(
      sourceEntity as unknown as SceneEntity, sourceType,
      targetEntity as unknown as SceneEntity, targetType, roles,
    );
    if (Object.keys(patches.scenePatch).length === 0 && Object.keys(patches.paramsPatch).length === 0) {
      return; // τίποτα μεταφέρσιμο → κανένα ghost
    }

    const preview = buildMatchPreviewEntity(
      targetEntity as unknown as DxfEntityUnion, targetType, patches,
      // ghost ≡ commit — ίδιο section-lock με τον applier (κλειδωμένη/bumped διατομή).
      (t, next) => applyMemberSectionLock(t as unknown as Entity, next),
    );

    ctx.save();
    ctx.globalAlpha = GHOST_DEFAULTS.alpha;
    drawRealEntityPreview(getBimPreview(ctx), preview, getLayersById(), t, viewport);
    ctx.restore();
  }, [source, hoveredId, levelManager, getBimPreview, getLayersById]);

  useCanvasGhostPreview({
    isActive,
    getCanvas,
    getViewportElement,
    transform,
    cursorMode: 'none',
    draw,
  });
}
