/**
 * SSoT — «σε ποιο layer ανήκει μια οντότητα» + «τι χρώμα ΔΕΙΧΝΕΙ» (effective hex).
 *
 * Δύο μικρές, καθαρές συναρτήσεις που ενοποιούν λογική που ζούσε copy-pasted:
 *
 *  1) `resolveEntityLayer(entity, layersById)` — id-first, name-fallback επίλυση του
 *     owning layer από τον id-keyed χάρτη της σκηνής. ΙΔΙΑ σειρά με τον renderer
 *     (πρώην inline στο `resolveEntityRenderStyle`) → renderer + property panels +
 *     ribbon color swatch βλέπουν το ΙΔΙΟ layer.
 *
 *  2) `resolveEntityColorHex(entity, layersById)` — το ΛΟΓΙΚΟ (μη canvas-adapted)
 *     effective χρώμα ως `#RRGGBB`, για swatches / color pickers. Χτίζει πάνω στο
 *     SSoT `resolveRenderedColorHex` (trueColor ▸ ACI ▸ ByLayer cascade)· όταν δεν
 *     υπάρχει owning layer, λύνει μόνο τα concrete κανάλια και αλλιώς πέφτει στο
 *     κεντρικό λευκό (`CAD_UI_COLORS.entity.default`). Μηδέν hardcoded χρώμα.
 *
 * @see resolve-entity-style — `resolveRenderedColorHex` (ByLayer/ACI/TrueColor cascade)
 * @see canvas-v2/dxf-canvas/dxf-renderer-style-resolve — καταναλωτής του `resolveEntityLayer`
 * @see hooks/tools/useLevelLayersById — SSoT getter του `layersById` της ενεργής σκηνής
 */

import type { SceneLayer } from '../../types/entities';
import { resolveEntityLayerName } from '../../stores/LayerStore';
import { resolveRenderedColorHex } from './resolve-entity-style';
import { getAciColor } from '../../settings/standards/aci';
import { trueColorToHex } from '../../utils/dxf-true-color';
import { CAD_UI_COLORS } from '../../config/color-config';

/** Minimal color/layer declaration shared by scene entities + QuickStyle draw-defaults. */
export interface EntityColorLike {
  readonly color?: string;
  readonly colorAci?: number;
  readonly colorTrueColor?: number | null;
  readonly colorMode?: 'ByLayer' | 'ByBlock' | 'Concrete';
  readonly layerId?: string;
}

/**
 * Owning layer μιας οντότητας — id-first (`layersById[layerId]`), name-fallback
 * (`resolveEntityLayerName`). Η ΜΙΑ επίλυση που μοιράζονται renderer + swatch.
 */
export function resolveEntityLayer(
  entity: { layerId?: string },
  layersById: Record<string, SceneLayer> | undefined,
): SceneLayer | undefined {
  if (!layersById) return undefined;
  const byId = entity.layerId ? layersById[entity.layerId] : undefined;
  if (byId) return byId;
  const name = resolveEntityLayerName(entity);
  return name ? layersById[name] : undefined;
}

/**
 * Effective color hex (`#RRGGBB`, uppercase) μιας οντότητας — για swatch / picker seed.
 * Layer-aware μέσω του `resolveEntityLayer` + `resolveRenderedColorHex` (SSoT cascade).
 */
export function resolveEntityColorHex(
  entity: EntityColorLike,
  layersById: Record<string, SceneLayer> | undefined,
): string {
  const layer = resolveEntityLayer(entity, layersById);
  if (layer) return resolveRenderedColorHex(entity, layer).toUpperCase();
  // Χωρίς γνωστό owning layer → concrete cascade ΜΕ ΤΗΝ ΙΔΙΑ προτεραιότητα με τον
  // renderer & το `resolveColorLevel`: trueColor ▸ ACI ▸ legacy hex (`entity.color`,
  // π.χ. exploded DXF με baked χρώμα) ▸ κεντρικό λευκό. Το `color` ήταν το κενό που
  // έδειχνε λευκό swatch σε πράσινη γραμμή χωρίς resolvable layer.
  if (entity.colorTrueColor != null) return trueColorToHex(entity.colorTrueColor);
  if (typeof entity.colorAci === 'number' && entity.colorAci >= 1 && entity.colorAci <= 255) {
    return getAciColor(entity.colorAci).toUpperCase();
  }
  if (entity.color && entity.color.length > 0) return entity.color.toUpperCase();
  return CAD_UI_COLORS.entity.default.toUpperCase();
}
