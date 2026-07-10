/**
 * ADR-619 §stair-from-region — «Σκάλα από περιοχή» sub-hook.
 *
 * Ο χρήστης σχεδιάζει ελεύθερα ΕΝΑ κλειστό πολύγωνο γύρω από το κλιμακοστάσιο
 * (διαδοχικά κλικ, ΙΔΙΟ vertex-chain engine με slab/column-from-polygon —
 * `usePolygonSketchChain`)· στο commit το ΣΧΗΜΑ του αποτυπώματος αποφασίζει τον
 * ΤΥΠΟ της σκάλας (ευθεία / τεταρτοστροφική / ημιστροφική / ελικοειδής) και
 * χτίζεται αυτόματα μια BIM σκάλα «χωμένη» στην περιοχή.
 *
 * Reuse-ONLY pipeline (μηδέν παράλληλη geometry):
 *   `classifyStairRegion` → `buildStairParamsFromRegion` → `buildStairEntity`
 * (SSoT `buildDefaultStairParams` + `computeStairGeometry`). Το append στη σκηνή
 * γίνεται από το ΙΔΙΟ path με το line-based stair tool (`onStairCreated` callback
 * που δίνει το `useSpecialTools`: `setLevelScene` + `EventBus.emit`).
 *
 * Standalone εργαλείο: το lifecycle το οδηγεί το `useToolLifecycle` στο
 * `useSpecialTools` (activate/deactivate), όχι εσωτερικό placementMode sync — γι'
 * αυτό εκθέτει απευθείας `activate/deactivate/isActive` (σε αντίθεση με το
 * `useColumnPolygonSketch` που είναι sub-mode του column FSM).
 *
 * @see ./use-column-polygon-sketch.ts (template)
 * @see ../../bim/geometry/stairs/stair-region-preview-store.ts (live preview)
 * @see docs/centralized-systems/reference/adrs/ADR-619-stair-from-region.md
 */

import { useCallback, useEffect, useRef } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { SceneUnits } from '../../utils/scene-units';
import type { StairEntity } from '../../bim/types/stair-types';
import { usePolygonSketchChain, type PolygonSketchPhase } from './use-polygon-sketch-chain';
import { buildStairEntity, type StairFloorLinkInput } from './stair-completion';
import { classifyStairRegion } from '../../bim/geometry/stairs/stair-region-classifier';
import { buildStairParamsFromRegion } from '../../bim/geometry/stairs/stair-params-from-region';
import { stairRegionPreviewStore } from '../../bim/geometry/stairs/stair-region-preview-store';

export interface UseStairRegionSketchOptions {
  readonly currentLevelId: string;
  readonly getSceneUnits?: () => SceneUnits;
  readonly getSceneEntities?: () => readonly Entity[];
  /** ADR-358 Phase 9 — floor link snapshot (auto-seeds multiStoryConfig). */
  readonly getFloorLink?: () => StairFloorLinkInput | null;
  /** Append + broadcast (ίδιο path με το line-based stair tool). */
  readonly onStairCreated: (entity: StairEntity) => void;
}

export interface UseStairRegionSketchResult {
  /** Delegate ενός canvas click στο vertex chain (true = consumed). */
  readonly onCanvasClick: (point: Readonly<Point2D>) => boolean;
  /** Τρέχουσα chain phase — τροφοδοτεί το tool status text. */
  readonly phase: PolygonSketchPhase;
  /** Ενεργό όσο τρέχει το chain (phase !== idle). */
  readonly isActive: boolean;
  activate(): void;
  deactivate(): void;
}

export function useStairRegionSketch(
  options: UseStairRegionSketchOptions,
): UseStairRegionSketchResult {
  const { currentLevelId, getSceneUnits, getSceneEntities, getFloorLink, onStairCreated } = options;

  // Latest inputs χωρίς να «καίμε» την ταυτότητα του commit adapter (stable refs).
  const currentLevelIdRef = useRef(currentLevelId);
  currentLevelIdRef.current = currentLevelId;
  const getSceneUnitsRef = useRef(getSceneUnits);
  getSceneUnitsRef.current = getSceneUnits;
  const getFloorLinkRef = useRef(getFloorLink);
  getFloorLinkRef.current = getFloorLink;
  const onStairCreatedRef = useRef(onStairCreated);
  onStairCreatedRef.current = onStairCreated;

  // Commit: το σχεδιασμένο κλειστό πολύγωνο → ΕΝΑ StairEntity. Το ΣΧΗΜΑ ταξινομείται
  // (classifyStairRegion) → StairParams (buildStairParamsFromRegion, SSoT variants) →
  // StairEntity (buildStairEntity, computeStairGeometry). Μηδέν geometry εδώ.
  const commitStairRegion = useCallback((vertices: readonly Point2D[]): boolean => {
    const sceneUnits: SceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
    const floorLink = getFloorLinkRef.current?.() ?? null;
    const classification = classifyStairRegion(vertices, sceneUnits);
    const params = buildStairParamsFromRegion(classification, sceneUnits, floorLink);
    const entity = buildStairEntity(params, currentLevelIdRef.current);
    if (!entity) return false;
    onStairCreatedRef.current(entity);
    return true;
  }, []);

  const {
    activate,
    deactivate,
    onCanvasClick,
    phase: sketchPhase,
    vertices: sketchVertices,
    isActive,
  } = usePolygonSketchChain({ onCommit: commitStairRegion, getSceneUnits, getSceneEntities });

  // Live-preview publish (tool-agnostic rubber-band outline).
  useEffect(() => {
    if (sketchPhase === 'idle') {
      stairRegionPreviewStore.reset();
      return;
    }
    stairRegionPreviewStore.set({ vertices: sketchVertices });
  }, [sketchPhase, sketchVertices]);

  useEffect(() => {
    return () => stairRegionPreviewStore.reset();
  }, []);

  return { onCanvasClick, phase: sketchPhase, isActive, activate, deactivate };
}
