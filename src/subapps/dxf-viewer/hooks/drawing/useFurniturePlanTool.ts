/**
 * ADR-654 — Έπιπλα κάτοψης (entourage): single-click placement tool.
 *
 * ADR-600: το invariant placement FSM ζει στο `createSingleClickPlacementTool` — εδώ
 * είναι μόνο το thin per-entity config. Μοτίβο ίδιο με το `useBlockLibraryTool`
 * (ADR-652): το «ποιο έπιπλο» ΔΕΝ είναι tool state — το γράφει η παλέτα στο
 * `furniture-plan-selection-store` (SSoT) και το tool το διαβάζει σε EVENT-TIME, ώστε ο
 * ghost να αλλάζει χωρίς React re-render (ADR-040).
 *
 * Παράγει `ImageEntity` (ADR-651 Φάση Ε) — non-BIM, ήδη πλήρως καλωδιωμένο σε
 * selection / move / rotate / scale / bounds / z-order / DXF export.
 *
 * FSM: idle → awaitingPosition → committed → awaitingPosition (continuous). ESC reset.
 *
 * @see ./create-single-click-placement-tool.ts — invariant FSM (ADR-600)
 * @see ../../bim/furniture-plan/place-furniture-plan.ts — pure builder (mm → scene, κέντρο → γωνία)
 * @see ../../bim/furniture-plan/furniture-plan-selection-store.ts — «ποιο έπιπλο» SSoT
 */

import type { ImageEntity } from '../../types/image';
import type { Point3D } from '../../bim/types/bim-base';
import type { SceneUnits } from '../../utils/scene-units';
import { getSelectedFurniturePlan } from '../../bim/furniture-plan/furniture-plan-selection-store';
import {
  buildFurniturePlanEntity,
  buildGhostFurniturePlanEntity,
  type FurniturePlanPlacementParams,
} from '../../bim/furniture-plan/place-furniture-plan';
import { imageEntityRectVertices } from '../../rendering/entities/shared/image-rect-vertices';
import {
  createSingleClickPlacementTool,
  type CorePlacementResult,
  type CorePlacementState,
} from './create-single-click-placement-tool';

/** Μόνο περιστροφή ρυθμίζεται πριν την τοποθέτηση — το μέγεθος το ΟΡΙΖΕΙ το catalog. */
export interface FurniturePlanParamOverrides {
  readonly rotation?: number;
}

export interface UseFurniturePlanToolOptions {
  readonly onFurnitureCreated?: (entity: ImageEntity) => void;
  readonly currentLevelId?: string;
  readonly getSceneUnits?: () => SceneUnits;
}

export type UseFurniturePlanToolResult = CorePlacementResult<
  CorePlacementState<FurniturePlanParamOverrides>,
  FurniturePlanParamOverrides
>;

/** Οι 4 γωνίες του (περιστραμμένου) ορθογωνίου → ghost footprint. Reuse του SSoT. */
function footprintOf(entity: ImageEntity | null): readonly Point3D[] {
  if (!entity) return [];
  const vertices = imageEntityRectVertices(entity);
  return vertices ? vertices.map((v) => ({ x: v.x, y: v.y, z: 0 })) : [];
}

const useFurniturePlacement = createSingleClickPlacementTool<
  ImageEntity,
  FurniturePlanPlacementParams,
  FurniturePlanParamOverrides,
  Record<string, never>,
  Record<string, never>,
  SceneUnits
>({
  defaultSceneUnits: 'mm',
  buildParams: (clickPoint, overrides, sceneUnits): FurniturePlanPlacementParams => {
    const selection = getSelectedFurniturePlan();
    return {
      position: { x: clickPoint.x, y: clickPoint.y },
      furnitureId: selection?.id ?? '',
      url: selection?.url ?? '',
      rotation: overrides.rotation,
      sceneUnits,
    };
  },
  buildEntity: (params) => {
    // Άδεια επιλογή ή μη-resolved url ⇒ ΠΟΤΕ entity με κενό src (ADR-654: το url
    // γίνεται prefetch τη στιγμή της επιλογής, άρα εδώ είναι είτε έτοιμο είτε τίποτα).
    if (!params.furnitureId || !params.url) {
      return { ok: false, hardErrors: ['tools.furniturePlan.errorNoSelection'] };
    }
    const entity = buildFurniturePlanEntity(params);
    if (!entity) return { ok: false, hardErrors: ['tools.furniturePlan.errorUnknownItem'] };
    return { ok: true, entity };
  },
  computeFootprint: (params) => footprintOf(buildGhostFurniturePlanEntity(params)),
  getStatusText: (s) =>
    s.phase === 'awaitingPosition' ? 'tools.furniturePlan.statusPosition' : '',
});

export function useFurniturePlanTool(
  options: UseFurniturePlanToolOptions = {},
): UseFurniturePlanToolResult {
  return useFurniturePlacement({
    onCreated: options.onFurnitureCreated,
    currentLevelId: options.currentLevelId,
    getSceneUnits: options.getSceneUnits,
  });
}
