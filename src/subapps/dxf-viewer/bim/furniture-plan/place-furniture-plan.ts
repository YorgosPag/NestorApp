/**
 * ADR-654 — τοποθέτηση: catalog id → {@link ImageEntity} σε clicked point.
 *
 * Pure builder (καμία παρενέργεια, καμία εγγραφή στη σκηνή) — mirror του
 * `place-block-from-library.ts`. Το commit το κάνει ο καλών μέσω του SSoT
 * `appendEntityToScene` (undo + `drawing:entity-created`).
 *
 * Δύο μετατροπές που ΠΡΕΠΕΙ να γίνουν εδώ, μία φορά:
 *
 * 1. **mm → scene units.** Το catalog δίνει πραγματικές διαστάσεις σε mm· η σκηνή
 *    μπορεί να είναι σε mm/cm/m (`$INSUNITS`). Χρησιμοποιείται ο SSoT `mmToSceneUnits`
 *    — ποτέ inline `/1000`.
 * 2. **κέντρο → κάτω-αριστερή γωνία.** Ο χρήστης κλικάρει εκεί που θέλει το ΚΕΝΤΡΟ του
 *    επίπλου (το φυσικό), αλλά το `ImageEntity.position` είναι η κάτω-αριστερή γωνία
 *    (σύμβαση DXF INSERT, y-up). Άρα `position = click − (w/2, h/2)`.
 *
 * @see ../../data/furniture-plan-catalog.ts — πραγματικό μέγεθος ανά κατηγορία
 * @see ../scene/append-entity-to-scene.ts — commit SSoT (undoable)
 */

import type { ImageEntity } from '../../types/image';
import type { Point2D } from '../../rendering/types/Types';
import { generateEntityId } from '../../systems/entity-creation/utils';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { getFurniturePlanSizeMm } from '../../data/furniture-plan-catalog';

/** Το layer όπου προσγειώνεται ΟΛΟ το entourage — ανοιγοκλείνει με ένα κλικ. */
export const FURNITURE_PLAN_LAYER_ID = 'FURNITURE-2D';

/** Παράμετροι τοποθέτησης ενός επίπλου κάτοψης. */
export interface FurniturePlanPlacementParams {
  /** Το σημείο που κλίκαρε ο χρήστης = ΚΕΝΤΡΟ του επίπλου. */
  readonly position: Point2D;
  /** Catalog id (SSoT του μεγέθους). */
  readonly furnitureId: string;
  /** Ήδη resolved URL του sprite (η επιλογή το κάνει prefetch). */
  readonly url: string;
  /** Γωνία σε μοίρες· default `0`. */
  readonly rotation?: number;
  /** Μονάδες σκηνής για τη μετατροπή mm → scene· default `'mm'`. */
  readonly sceneUnits?: SceneUnits;
  /** Layer· default {@link FURNITURE_PLAN_LAYER_ID}. */
  readonly layerId?: string;
}

/** Το μέγεθος τοποθέτησης σε ΜΟΝΑΔΕΣ ΣΚΗΝΗΣ (mm από το catalog × unit scale). */
export interface FurniturePlanSceneSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Πραγματικό μέγεθος του επίπλου στις μονάδες της σκηνής. `null` όταν το id δεν
 * υπάρχει στο catalog ⇒ ο καλών δεν τοποθετεί (αντί για entity μηδενικού μεγέθους).
 */
export function resolveFurniturePlanSceneSize(
  furnitureId: string,
  sceneUnits: SceneUnits = 'mm',
): FurniturePlanSceneSize | null {
  const sizeMm = getFurniturePlanSizeMm(furnitureId);
  if (!sizeMm) return null;

  const scale = mmToSceneUnits(sceneUnits);
  return { width: sizeMm.widthMm * scale, height: sizeMm.heightMm * scale };
}

/**
 * Το ΚΟΙΝΟ shape ενός {@link ImageEntity} από params + size + id. Ο μόνος
 * διαφοροποιητής commit vs ghost είναι το `id` — μία πηγή για τη δομή (όχι sibling
 * clone, N.18).
 */
function assembleImageEntity(
  params: FurniturePlanPlacementParams,
  size: FurniturePlanSceneSize,
  id: string,
): ImageEntity {
  return {
    id,
    type: 'image',
    layerId: params.layerId ?? FURNITURE_PLAN_LAYER_ID,
    // Κλικ = κέντρο· το ImageEntity θέλει την κάτω-αριστερή γωνία (y-up).
    position: {
      x: params.position.x - size.width / 2,
      y: params.position.y - size.height / 2,
    },
    width: size.width,
    height: size.height,
    url: params.url,
    rotation: params.rotation ?? 0,
    visible: true,
  } as ImageEntity;
}

/**
 * Χτίζει ένα {@link ImageEntity} για ένα έπιπλο κάτοψης. `null` όταν το catalog id
 * είναι άγνωστο (ο καλών το γυρίζει σε hard error αντί να τοποθετήσει σκουπίδι).
 */
export function buildFurniturePlanEntity(
  params: FurniturePlanPlacementParams,
): ImageEntity | null {
  const size = resolveFurniturePlanSceneSize(params.furnitureId, params.sceneUnits);
  if (!size) return null;
  return assembleImageEntity(params, size, generateEntityId());
}

/** Σταθερό id για το transient ghost — δεν μπαίνει ΠΟΤΕ στη σκηνή. */
const GHOST_FURNITURE_ID = 'furniture-plan-ghost';

/**
 * ADR-040 — TRANSIENT ghost για το footprint preview: ίδιο transform με το commit,
 * χωρίς id-gen (τρέχει ανά cursor move).
 */
export function buildGhostFurniturePlanEntity(
  params: FurniturePlanPlacementParams,
): ImageEntity | null {
  const size = resolveFurniturePlanSceneSize(params.furnitureId, params.sceneUnits);
  if (!size) return null;
  return assembleImageEntity(params, size, GHOST_FURNITURE_ID);
}
