/**
 * ADR-654 M6 — τοποθέτηση entourage: catalog id → {@link ImageEntity} σε clicked point (κοινό factory).
 *
 * Γενίκευση του `place-furniture-plan.ts`. Pure builder (καμία παρενέργεια, καμία εγγραφή στη
 * σκηνή) — το commit το κάνει ο καλών μέσω του SSoT `appendEntityToScene`. Δύο μετατροπές, μία φορά:
 *
 * 1. **mm → scene units.** Το catalog δίνει πραγματικές διαστάσεις σε mm· η σκηνή μπορεί να είναι
 *    σε mm/cm/m (`$INSUNITS`). SSoT `mmToSceneUnits` — ποτέ inline `/1000`.
 * 2. **κέντρο → κάτω-αριστερή γωνία.** Ο χρήστης κλικάρει το ΚΕΝΤΡΟ· το `ImageEntity.position` είναι
 *    η κάτω-αριστερή γωνία (σύμβαση DXF INSERT, y-up). Άρα `position = click − (w/2, h/2)`.
 *
 * Το μέγεθος το δίνει ο injected `getSizeMm` (per-pack catalog), το layer ο injected `layerId` ⇒
 * μία μηχανή, πολλές οικογένειες (N.18).
 *
 * @see ../../data/entourage-catalog-core.ts — getSizeMm (μεγάλη πλευρά ανά κατηγορία)
 * @see ../scene/append-entity-to-scene.ts — commit SSoT (undoable)
 */

import type { ImageEntity } from '../../types/image';
import type { Point2D } from '../../rendering/types/Types';
import type { EntourageSizeMm } from '../../data/entourage-catalog-core';
import { generateEntityId } from '../../systems/entity-creation/utils';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';

/** Παράμετροι τοποθέτησης ενός entourage sprite. */
export interface EntouragePlacementParams {
  /** Το σημείο που κλίκαρε ο χρήστης = ΚΕΝΤΡΟ του sprite. */
  readonly position: Point2D;
  /** Catalog id (SSoT του μεγέθους). */
  readonly itemId: string;
  /** Ήδη resolved URL του sprite. */
  readonly url: string;
  /** Γωνία σε μοίρες· default `0`. */
  readonly rotation?: number;
  /** Μονάδες σκηνής για τη μετατροπή mm → scene· default `'mm'`. */
  readonly sceneUnits?: SceneUnits;
  /** Layer· default ο `layerId` του placer. */
  readonly layerId?: string;
}

/** Το μέγεθος τοποθέτησης σε ΜΟΝΑΔΕΣ ΣΚΗΝΗΣ (mm από το catalog × unit scale). */
export interface EntourageSceneSize {
  readonly width: number;
  readonly height: number;
}

/** Οι lookups ενός placer — παράγονται από το {@link createEntouragePlacer}. */
export interface EntouragePlacer {
  /** Μέγεθος στις μονάδες της σκηνής· `null` όταν το id δεν υπάρχει στο catalog. */
  resolveSceneSize(itemId: string, sceneUnits?: SceneUnits): EntourageSceneSize | null;
  /** Χτίζει committable `ImageEntity` (φρέσκο id)· `null` για άγνωστο id. */
  buildEntity(params: EntouragePlacementParams): ImageEntity | null;
  /** TRANSIENT ghost (σταθερό id, ίδιο transform με το commit)· `null` για άγνωστο id. */
  buildGhost(params: EntouragePlacementParams): ImageEntity | null;
}

export interface EntouragePlacerConfig {
  /** Πραγματικό μέγεθος του sprite σε mm ανά catalog id (per-pack). */
  readonly getSizeMm: (id: string) => EntourageSizeMm | null;
  /** Το layer όπου προσγειώνεται ΟΛΗ η οικογένεια (ανοιγοκλείνει με ένα κλικ). */
  readonly layerId: string;
}

/**
 * Χτίζει τους placement lookups μιας οικογένειας entourage από το size map + το layer. Καμία
 * per-pack λογική εδώ — μόνο δεδομένα διαφέρουν (N.18).
 */
export function createEntouragePlacer(config: EntouragePlacerConfig): EntouragePlacer {
  const { getSizeMm, layerId } = config;

  const resolveSceneSize = (
    itemId: string,
    sceneUnits: SceneUnits = 'mm',
  ): EntourageSceneSize | null => {
    const sizeMm = getSizeMm(itemId);
    if (!sizeMm) return null;
    const scale = mmToSceneUnits(sceneUnits);
    return { width: sizeMm.widthMm * scale, height: sizeMm.heightMm * scale };
  };

  // Το ΚΟΙΝΟ shape του ImageEntity· ο μόνος διαφοροποιητής commit vs ghost είναι το `id`.
  const assemble = (
    params: EntouragePlacementParams,
    size: EntourageSceneSize,
    id: string,
  ): ImageEntity =>
    ({
      id,
      type: 'image',
      layerId: params.layerId ?? layerId,
      // Κλικ = κέντρο· το ImageEntity θέλει την κάτω-αριστερή γωνία (y-up).
      position: {
        x: params.position.x - size.width / 2,
        y: params.position.y - size.height / 2,
      },
      width: size.width,
      height: size.height,
      // ADR-654 — «store native size»: το catalog μέγεθος τη στιγμή της τοποθέτησης είναι το
      // SSoT για το κουμπί «Επαναφορά Διαστάσεων» (Δρόμος A). Ίσο με width/height στην αρχή,
      // αλλά ΔΕΝ αλλάζει ποτέ από resize/scale → επαναφέρει πάντα το εργοστασιακό μέγεθος.
      intrinsicWidth: size.width,
      intrinsicHeight: size.height,
      url: params.url,
      rotation: params.rotation ?? 0,
      visible: true,
    }) as ImageEntity;

  const build = (params: EntouragePlacementParams, id: string): ImageEntity | null => {
    const size = resolveSceneSize(params.itemId, params.sceneUnits);
    if (!size) return null;
    return assemble(params, size, id);
  };

  return {
    resolveSceneSize,
    buildEntity: (params) => build(params, generateEntityId()),
    // Σταθερό ghost id ανά layer — δεν μπαίνει ΠΟΤΕ στη σκηνή (τρέχει ανά cursor move, χωρίς id-gen).
    buildGhost: (params) => build(params, `${layerId}-ghost`),
  };
}
