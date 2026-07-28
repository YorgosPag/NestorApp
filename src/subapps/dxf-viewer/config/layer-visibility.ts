/**
 * @file Layer visibility SSoT — τα ΤΡΙΑ κατηγορήματα που απαντούν «φαίνεται αυτό το layer;»
 * @module config/layer-visibility
 *
 * ADR-721 §1. Πριν από αυτό το αρχείο, το ΙΔΙΟ ερώτημα γραφόταν με **τέσσερις**
 * ασύμβατους τρόπους μέσα στο ίδιο subapp:
 *
 * | Σημείο | Γραφή | Τι απαντά για `visible: undefined` |
 * |---|---|---|
 * | `dxf-entity-layer-skip.ts` (renderer) | `layer.visible === false` | ΟΡΑΤΟ ✅ |
 * | `visibility-resolver.ts` (BIM) | `ctx.layer.visible === false` | ΟΡΑΤΟ ✅ |
 * | `ColorGroupItem.tsx` | `?.visible !== false` | ΟΡΑΤΟ ✅ |
 * | `LayerItem.tsx` | `layer.visible ? Eye : EyeOff` | **ΚΡΥΦΟ** ❌ |
 * | `LayerOperationsService.getStats` | `layers.filter(l => l.visible)` | **ΚΡΥΦΟ** ❌ |
 *
 * Μετρημένο ζωντανά (2026-07-28, browser probe σε `47_ergasia.dxf`): σε φρέσκο φόρτωμα
 * **και τα 58 layers** έχουν `visible: undefined`. Άρα οι δύο τελευταίες γραμμές του
 * πίνακα δήλωναν «όλα κρυμμένα» ενώ ο καμβάς τα ζωγράφιζε όλα — ακριβώς η ασυμφωνία
 * που έβλεπε ο χρήστης στα «ματάκια».
 *
 * ## Γιατί `undefined` σημαίνει ΟΡΑΤΟ
 *
 * DXF parity: στο DXF το LAYER table (group code 62) κωδικοποιεί το OFF ως **αρνητικό**
 * χρώμα· η **απουσία** δήλωσης = layer αναμμένο. Ένα layer που δεν έχει πει ποτέ «είμαι
 * σβηστό» είναι αναμμένο. Άρα το κατηγόρημα είναι πάντα `!== false`, ποτέ truthiness.
 *
 * ## Γιατί ON και FREEZE είναι ΔΥΟ ερωτήματα, όχι ένα
 *
 * AutoCAD doctrine (και το ADR-382 §Q1 το υιοθετεί): `LAYOFF` κρύβει αλλά το αντικείμενο
 * παραμένει μέρος του σχεδίου (επιλέξιμο, μετράει στα extents)· `LAYFRZ` το βγάζει τελείως
 * από regen/extents/render. Ο κώδικας που ρωτά «να το ζωγραφίσω;» θέλει **και τα δύο**
 * (`isLayerRenderable`)· ο κώδικας που ρωτά «είναι αναμμένος ο διακόπτης;» (UI εικονίδιο,
 * ένα ματάκι) θέλει **μόνο** το `isLayerOn`.
 *
 * Pure module — μόνο ο τύπος, μηδέν store/React. Καλείται event-time από hot render loops.
 *
 * @see canvas-v2/dxf-canvas/dxf-entity-layer-skip.ts — ο 2Δ καταναλωτής
 * @see bim/visibility/visibility-resolver.ts — ο BIM καταναλωτής (ADR-382)
 * @see stores/LayerStore.ts — ο runtime SSoT που κρατά τα flags
 */

import type { SceneLayer } from '../types/entities';

/** Το ελάχιστο σχήμα που χρειάζονται τα κατηγορήματα (δέχεται και μερικά DTO). */
export interface LayerVisibilityFlags {
  readonly visible?: boolean;
  readonly frozen?: boolean;
}

/**
 * AutoCAD `LAYON` — ο διακόπτης του layer είναι αναμμένος;
 *
 * `undefined` ⇒ **true** (ποτέ δεν δηλώθηκε σβηστό). Αυτό είναι το κατηγόρημα που
 * διαβάζει το UI για να επιλέξει εικονίδιο 👁 / 👁̸ και για να υπολογίσει το επόμενο
 * state ενός toggle.
 */
export function isLayerOn(layer: LayerVisibilityFlags | null | undefined): boolean {
  return layer?.visible !== false;
}

/**
 * AutoCAD `LAYFRZ` — το layer είναι παγωμένο;
 *
 * `undefined` ⇒ **false** (ποτέ δεν δηλώθηκε παγωμένο).
 */
export function isLayerFrozen(layer: LayerVisibilityFlags | null | undefined): boolean {
  return layer?.frozen === true;
}

/**
 * «Ζωγραφίζεται αυτό το layer αυτό το frame;» — ON **και** μη-παγωμένο.
 *
 * Αυτό είναι το κατηγόρημα κάθε render/hit-test path. Ένα `null` layer (η οντότητα δεν
 * λύνεται σε layer) σημαίνει **καμία δέσμευση από layer** ⇒ `true`, ώστε ένα σπασμένο
 * `layerId` να μην εξαφανίζει σιωπηλά γεωμετρία.
 */
export function isLayerRenderable(layer: LayerVisibilityFlags | null | undefined): boolean {
  return isLayerOn(layer) && !isLayerFrozen(layer);
}

/**
 * Το επόμενο state ενός toggle «ματιού» — η ΜΙΑ πηγή για το «τι στέλνω όταν πατηθεί».
 *
 * Υπήρχε ως `!layer.visible` σε τρία σημεία (LayerItem, useLayerManagerState,
 * useCurrentLayerPickerState). Με `visible: undefined` το `!undefined` δίνει `true`
 * — δηλαδή «κάν' το ορατό» ενώ ΗΔΗ είναι ορατό: το πρώτο κλικ δεν έκανε τίποτα και ο
 * χρήστης χρειαζόταν δεύτερο. Εδώ γράφεται σωστά μία φορά.
 */
export function nextLayerOnState(layer: LayerVisibilityFlags | null | undefined): boolean {
  return !isLayerOn(layer);
}

/**
 * Ομαδικό state για μια ομάδα layers (color group header): πλήρως αναμμένη, μερικώς, σβηστή.
 * Κενή ομάδα ⇒ `'all'` (τίποτα δεν είναι κρυμμένο).
 */
export type LayerGroupOnState = 'all' | 'some' | 'none';

export function resolveLayerGroupOnState(
  layers: ReadonlyArray<LayerVisibilityFlags | null | undefined>,
): LayerGroupOnState {
  if (layers.length === 0) return 'all';
  let on = 0;
  for (const layer of layers) if (isLayerOn(layer)) on++;
  if (on === layers.length) return 'all';
  return on === 0 ? 'none' : 'some';
}

/** Type-narrowing βοηθός για τα σημεία που κρατούν πλήρη `SceneLayer`. */
export function isSceneLayerRenderable(layer: SceneLayer | null | undefined): boolean {
  return isLayerRenderable(layer);
}
