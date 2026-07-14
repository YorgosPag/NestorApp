/**
 * ADR-654 M6 — Entourage single-click placement tool (κοινό factory).
 *
 * Γενίκευση του `useFurniturePlanTool.ts`. ADR-600: το invariant placement FSM ζει στο
 * `createSingleClickPlacementTool` — εδώ είναι μόνο το thin per-family config. Το «ποιο item» ΔΕΝ
 * είναι tool state: το γράφει η παλέτα στο entourage selection store (SSoT) και το tool το διαβάζει
 * σε EVENT-TIME, ώστε ο ghost να αλλάζει χωρίς React re-render (ADR-040).
 *
 * Παράγει `ImageEntity` — non-BIM, ήδη πλήρως καλωδιωμένο σε selection/move/rotate/scale/bounds/
 * z-order/DXF export. FSM: idle → awaitingPosition → committed → awaitingPosition (continuous). ESC reset.
 *
 * @see ./create-single-click-placement-tool.ts — invariant FSM (ADR-600)
 * @see ../../bim/entourage/place-entourage.ts — pure builder (mm → scene, κέντρο → γωνία)
 * @see ../../bim/entourage/entourage-selection-store.ts — «ποιο item» SSoT
 * @see ./entourage-tools.ts — τα per-family instances (people, vehicles)
 */

import type { ImageEntity } from '../../types/image';
import type { Point3D } from '../../bim/types/bim-base';
import type { SceneUnits } from '../../utils/scene-units';
import type { EntourageSelectionStore } from '../../bim/entourage/entourage-selection-store';
import type {
  EntouragePlacer,
  EntouragePlacementParams,
} from '../../bim/entourage/place-entourage';
import { imageEntityRectVertices } from '../../rendering/entities/shared/image-rect-vertices';
import {
  createSingleClickPlacementTool,
  type CorePlacementResult,
  type CorePlacementState,
} from './create-single-click-placement-tool';

/** Μόνο περιστροφή ρυθμίζεται πριν την τοποθέτηση — το μέγεθος το ΟΡΙΖΕΙ το catalog. */
export interface EntourageParamOverrides {
  readonly rotation?: number;
}

export interface UseEntourageToolOptions {
  readonly onEntourageCreated?: (entity: ImageEntity) => void;
  readonly currentLevelId?: string;
  readonly getSceneUnits?: () => SceneUnits;
}

export type UseEntourageToolResult = CorePlacementResult<
  CorePlacementState<EntourageParamOverrides>,
  EntourageParamOverrides
>;

/** Τι διαφέρει ανά οικογένεια: ο selection store, ο placer, τα i18n κλειδιά. */
export interface EntourageToolDescriptor {
  readonly selection: EntourageSelectionStore;
  readonly placer: EntouragePlacer;
  readonly statusPositionKey: string;
  readonly errorNoSelectionKey: string;
  readonly errorUnknownItemKey: string;
}

/** Οι 4 γωνίες του (περιστραμμένου) ορθογωνίου → ghost footprint. Reuse του SSoT. */
function footprintOf(entity: ImageEntity | null): readonly Point3D[] {
  if (!entity) return [];
  const vertices = imageEntityRectVertices(entity);
  return vertices ? vertices.map((v) => ({ x: v.x, y: v.y, z: 0 })) : [];
}

/**
 * Χτίζει έναν single-click placement hook για μία οικογένεια entourage. Καλείται ΜΙΑ φορά ανά
 * family σε module scope (rules-of-hooks safe — ο πυρήνας είναι module-constant).
 */
export function createEntourageTool(
  descriptor: EntourageToolDescriptor,
): (options?: UseEntourageToolOptions) => UseEntourageToolResult {
  const { selection, placer, statusPositionKey, errorNoSelectionKey, errorUnknownItemKey } =
    descriptor;

  const usePlacement = createSingleClickPlacementTool<
    ImageEntity,
    EntouragePlacementParams,
    EntourageParamOverrides,
    Record<string, never>,
    Record<string, never>,
    SceneUnits
  >({
    defaultSceneUnits: 'mm',
    buildParams: (clickPoint, overrides, sceneUnits): EntouragePlacementParams => {
      const current = selection.get();
      return {
        position: { x: clickPoint.x, y: clickPoint.y },
        itemId: current?.id ?? '',
        url: current?.url ?? '',
        rotation: overrides.rotation,
        sceneUnits,
      };
    },
    buildEntity: (params) => {
      // Άδεια επιλογή ή μη-resolved url ⇒ ΠΟΤΕ entity με κενό src (το url είναι σύγχρονο, ADR-655).
      if (!params.itemId || !params.url) {
        return { ok: false, hardErrors: [errorNoSelectionKey] };
      }
      const entity = placer.buildEntity(params);
      if (!entity) return { ok: false, hardErrors: [errorUnknownItemKey] };
      return { ok: true, entity };
    },
    computeFootprint: (params) => footprintOf(placer.buildGhost(params)),
    getStatusText: (s) => (s.phase === 'awaitingPosition' ? statusPositionKey : ''),
  });

  return function useEntourageTool(
    options: UseEntourageToolOptions = {},
  ): UseEntourageToolResult {
    return usePlacement({
      onCreated: options.onEntourageCreated,
      currentLevelId: options.currentLevelId,
      getSceneUnits: options.getSceneUnits,
    });
  };
}
