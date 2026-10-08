/**
 * @fileoverview **ΤΟ ΠΡΟΦΙΛ «ΔΗΜΟΣΙΑ ΚΑΤΟΨΗ»** — για κάθε στοιχείο του σχεδίου: *«φαίνεται στο κοινό;»* (ADR-909 Α4).
 * @related ADR-909 §6.2 · `@/lib/listings/floorplan-render-recipe` (`PUBLIC_FLOORPLAN_PROFILE`: id + έκδοση)
 * @module subapps/dxf-viewer/print/public-floorplan/public-floorplan-profile
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΔΥΟ ΠΙΝΑΚΕΣ, ΚΑΙ ΚΑΝΕΝΑ «ΑΛΛΙΩΣ ΔΕΙΞΕ ΤΟ»
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | το στοιχείο… | το κρίνει |
 * |---|---|
 * | έχει κατηγορία BIM (`resolveEntityBimCategory`) | {@link PUBLIC_FLOORPLAN_CATEGORY_RULES} — `Record` πάνω στο `BimCategory`: νέα κατηγορία χωρίς απάντηση **δεν μεταγλωττίζεται** |
 * | δεν έχει (σκέτο DXF, σχολιασμός) | {@link PUBLIC_FLOORPLAN_PRIMITIVE_RULES} — `Record` πάνω στους τύπους του `DXF_RENDERABLE_TYPES` |
 * | δεν είναι σε κανέναν πίνακα | **κρύβεται και αναφέρεται** (`unruledTypes`) — ποτέ σιωπηλή εικασία |
 *
 * 🔴 **Κλειστό προς την άρνηση, επίτηδες**: η εικόνα φεύγει σε ανώνυμο επισκέπτη. Τύπος που κανείς δεν
 * έκρινε δεν δημοσιεύεται «επειδή μάλλον είναι γραμμή» — ο διάλογος λέει στον άνθρωπο ότι κάτι έμεινε έξω.
 *
 * ⚠️ **ΚΑΘΕ ΑΛΛΑΓΗ ΕΔΩ ΟΦΕΙΛΕΙ ΝΑ ΑΝΕΒΑΣΕΙ ΤΗΝ `version` του `PUBLIC_FLOORPLAN_PROFILE`.** Η άγκυρα κρατά το
 * αποτύπωμα των πινάκων δίπλα στην έκδοση: αλλαγή χωρίς άνοδο ⇒ κόκκινο. Έτσι οι ήδη δημοσιευμένες
 * κατόψεις σημαίνονται μπαγιάτικες από τον **ίδιο** μηχανισμό παλαιότητας (Α6), χωρίς τρίτο.
 *
 * ⛔ **Καθαρό module** — κανένα store. Το «είναι σε κρυφό στρώμα;» το δίνει ο καλών ως κατηγόρημα.
 */

import type { DxfEntityUnion, DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { BimCategory } from '../../config/bim-object-styles';
import type { DxfRenderableType } from '../../rendering/contract/renderable-entity-type';
import { resolveEntityBimCategory } from '../../bim/visibility/resolve-entity-bim-category';

/** `furniture` = φαίνεται **μόνο** όταν ο άνθρωπος ζήτησε επίπλωση στον διάλογο. */
export type PublicFloorplanRule = 'show' | 'hide' | 'furniture';

export const PUBLIC_FLOORPLAN_CATEGORY_RULES: Readonly<Record<BimCategory, PublicFloorplanRule>> = {
  // Το κτίσμα όπως το περπατά ο αγοραστής.
  wall: 'show',
  column: 'show',
  slab: 'show',
  opening: 'show',
  'slab-opening': 'show',
  stair: 'show',
  railing: 'show',
  hatch: 'show',
  // Είδη υγιεινής και κουζίνα: μόνιμος εξοπλισμός, δείχνει τη χρήση του χώρου.
  sanitary: 'show',
  kitchen: 'show',
  // Επίπλωση: επιλογή του ανθρώπου (Matterport: «με ή χωρίς επίπλωση»).
  furniture: 'furniture',
  // Ό,τι είναι πάνω ή κάτω από το επίπεδο που περπατιέται.
  beam: 'hide',
  roof: 'hide',
  ceiling: 'hide',
  foundation: 'hide',
  // Σχολιασμός και βοηθήματα σχεδίασης.
  dimension: 'hide',
  grip: 'hide',
  // Μελέτες: θερμομόνωση, επενδύσεις, θερμικοί χώροι — όχι για αγγελία.
  envelope: 'hide',
  'floor-finish': 'hide',
  'wall-covering': 'hide',
  'thermal-space': 'hide',
  'space-separator': 'hide',
  // Η/Μ εγκαταστάσεις.
  'light-fixture': 'hide',
  'electrical-panel': 'hide',
  'mep-manifold': 'hide',
  'mep-radiator': 'hide',
  'mep-boiler': 'hide',
  'mep-water-heater': 'hide',
  'mep-underfloor': 'hide',
  'mep-wire': 'hide',
  duct: 'hide',
  pipe: 'hide',
  'drain-pipe': 'hide',
  fuel: 'hide',
  'generic-solid': 'hide',
};

/** Τύποι BIM που **δεν** λύνονται σε κατηγορία (`resolveEntityBimCategory` ⇒ `null`) — κρίνονται εδώ. */
type UncategorisedBimType = 'imported-mesh' | 'generic-solid';

export const PUBLIC_FLOORPLAN_PRIMITIVE_RULES: Readonly<
  Record<DxfRenderableType | UncategorisedBimType, PublicFloorplanRule>
> = {
  // 🔶 Δηλωμένο όριο (Α4): το σκέτο DXF δεν λέει τι είναι — ισχύει «ό,τι είναι σε ορατό στρώμα».
  line: 'show',
  polyline: 'show',
  lwpolyline: 'show',
  circle: 'show',
  arc: 'show',
  ellipse: 'show',
  spline: 'show',
  rectangle: 'show',
  rect: 'show',
  hatch: 'show',
  image: 'show',
  // Ονόματα χώρων: είναι απλά κείμενα — δεν ξεχωρίζουν από σημείωση, άρα ακολουθούν το στρώμα τους.
  text: 'show',
  mtext: 'show',
  // Προσανατολισμός και κλίμακα: ό,τι βοηθά τον αγοραστή να διαβάσει την κάτοψη.
  'annotation-symbol': 'show',
  'scale-bar': 'show',
  // Διαστάσεις, σημειώσεις, πίνακες, βοηθητικές γραμμές.
  dimension: 'hide',
  'angle-measurement': 'hide',
  leader: 'hide',
  'opening-info-tag': 'hide',
  table: 'hide',
  xline: 'hide',
  ray: 'hide',
  point: 'hide',
  'topo-surface': 'hide',
  // Εισαγόμενα 3Δ αντικείμενα: στην πράξη έπιπλα και διάκοσμος.
  'imported-mesh': 'furniture',
  'generic-solid': 'hide',
};

/** Η απάντηση του προφίλ για ένα στοιχείο — `null` όταν **κανείς δεν το έκρινε**. */
export function publicFloorplanRuleOf(entity: DxfEntityUnion): PublicFloorplanRule | null {
  const category = resolveEntityBimCategory(entity);
  if (category !== null) return PUBLIC_FLOORPLAN_CATEGORY_RULES[category];

  const primitives: Readonly<Record<string, PublicFloorplanRule | undefined>> = PUBLIC_FLOORPLAN_PRIMITIVE_RULES;
  return Object.hasOwn(primitives, entity.type) ? primitives[entity.type] ?? null : null;
}

export interface PublicFloorplanOptions {
  /** Η επιλογή του ανθρώπου στον διάλογο — το **μόνο** που αλλάζει ανά δημοσίευση. */
  readonly furniture: boolean;
}

export interface PublicFloorplanSelection {
  /** Η σκηνή **μόνο** με ό,τι φεύγει στο κοινό — τα όριά της ορίζουν και το κάδρο. */
  readonly scene: DxfScene;
  /** Τύποι που το προφίλ δεν γνωρίζει και γι' αυτό **έμειναν έξω** — ο διάλογος τους ονομάζει. */
  readonly unruledTypes: readonly string[];
}

/**
 * **Κράτα μόνο ό,τι επιτρέπεται να δει το κοινό.**
 *
 * 🔑 Δουλεύει πάνω στη **μετατραπείσα** σκηνή (`DxfScene`), όπου block / ομάδες / πίνακες έχουν ήδη
 * ξεδιπλωθεί: μια διάσταση μέσα σε block κρίνεται ως διάσταση, όχι ως «block».
 *
 * @param isLayerHidden «είναι σε κρυφό ή παγωμένο στρώμα;» — ο καλών το ρωτά στο SSoT του αποδότη. Τα κρυφά
 *   φεύγουν **και από εδώ**, όχι μόνο στη ζωγραφική, ώστε να μη φουσκώνουν το κάδρο της εικόνας.
 */
export function applyPublicFloorplanProfile(
  scene: DxfScene,
  options: PublicFloorplanOptions,
  isLayerHidden: (entity: DxfEntityUnion) => boolean,
): PublicFloorplanSelection {
  const unruled = new Set<string>();

  const entities = scene.entities.filter((entity) => {
    if (entity.visible === false || isLayerHidden(entity)) return false;
    const rule = publicFloorplanRuleOf(entity);
    if (rule === null) {
      unruled.add(entity.type);
      return false;
    }
    return rule === 'show' || (rule === 'furniture' && options.furniture);
  });

  return { scene: { ...scene, entities }, unruledTypes: [...unruled].sort() };
}
