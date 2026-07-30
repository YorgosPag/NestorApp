import type { SceneLayer } from '../types/scene';
import type { LayerColorMap } from './dxf-entity-parser';
import { getAciColor } from '../settings/standards/aci';
import { getLayerColor } from '../config/color-config';
// ADR-358 Phase 9C/9D — SceneLayer construction SSoT (auto-gens `lyr_<UUID-v4>` id).
import { createSceneLayer } from '../types/entities';

/**
 * N.7.1 file-size split — ΒΓΗΚΕ ΑΥΤΟΥΣΙΑ από τον `dxf-scene-builder` (508/500 γραμμές).
 * Είναι η ΜΙΑ πηγή για «πώς ένα layer του DXF γίνεται SceneLayer με το πραγματικό του χρώμα
 * και τις τρεις ανεξάρτητες σημαίες του». Καλείται τόσο για το layer «0» όσο και για κάθε
 * layer που συναντά μια οντότητα — μηδέν δίδυμο.
 */

/**
 * Resolve a layer's real color from the two authoritative sources (SSoT, shared by layer
 * registration and per-entity BYLAYER resolution): the parsed LAYER table, else the
 * `COLOR_<n>` layer-name → ACI convention. Returns undefined when neither applies (callers
 * decide the final fallback: hash color for layers, leave-uncolored for entities).
 */
export function resolveLayerColor(layerName: string, layerColors: LayerColorMap): string | undefined {
  const fromTable = layerColors[layerName]?.color;
  if (fromTable) return fromTable;

  const colorMatch = layerName.match(/^COLOR_(\d+)$/i);
  if (colorMatch) {
    const aciIndex = parseInt(colorMatch[1], 10);
    if (aciIndex >= 1 && aciIndex <= 255) return getAciColor(aciIndex);
  }
  return undefined;
}

/**
 * 🎨 ENTERPRISE LAYER REGISTRATION (2026-01-03)
 *
 * Καταχωρεί layer με ΠΡΑΓΜΑΤΙΚΑ ACI colors!
 *
 * Priority:
 * 1. layerColors[layerName] - Parsed from LAYER table
 * 2. COLOR_X pattern - Extract ACI from layer name (e.g. COLOR_43)
 * 3. getLayerColor(layerName) - Hash-based fallback (muted)
 *
 * @param layers - Record of registered layers
 * @param layerName - Name of layer to register
 * @param layerColors - Parsed LAYER table with real ACI colors
 */
export function registerDxfLayer(
  layers: Record<string, SceneLayer>,
  layerName: string,
  layerColors: LayerColorMap,
): void {
  if (layers[layerName]) return;

  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║ 🎨 REAL ACI COLOR PRIORITY                                             ║
  // ║                                                                        ║
  // ║ 1. layerColors[layerName] → Parsed from LAYER table                   ║
  // ║ 2. COLOR_X pattern → Extract ACI from name (e.g. COLOR_43 → ACI 43)   ║
  // ║ 3. getLayerColor() → Hash-based fallback                               ║
  // ╚════════════════════════════════════════════════════════════════════════╝

  // Try 1+2: LAYER table → COLOR_X name (shared SSoT). Try 3: hash-based fallback.
  const visible = layerColors[layerName]?.visible ?? true;
  // AutoCAD κρύβει με ΔΥΟ ανεξάρτητους μηχανισμούς — OFF (62<0) **και** FROZEN (70 bit 0).
  // Το δεύτερο δεν περνούσε ποτέ ⇒ παγωμένα layers εμφανίζονταν (μετρημένο: 8 layers /
  // ~700 οντότητες στο `47_ergasia.dxf`). Ο συνδυασμός γίνεται στο `isLayerRenderable`.
  const frozen = layerColors[layerName]?.frozen ?? false;
  // ΤΡΙΤΗ ανεξάρτητη ιδιότητα (group 70 bit 2): **επεξεργασιμότητα**, όχι ορατότητα. Ήταν
  // καρφωμένη σε `false`, οπότε κάθε κλειδωμένο layer του αρχείου γινόταν ελεύθερα
  // επεξεργάσιμο μετά την εισαγωγή — και το κλείδωμα χανόταν και στην εξαγωγή.
  const locked = layerColors[layerName]?.locked ?? false;
  const resolvedColor = resolveLayerColor(layerName, layerColors) ?? getLayerColor(layerName);

  // ADR-358 Phase 9C/9D-2 — factory auto-gens stable `lyr_<UUID-v4>` id.
  // ADR-635 Φ C.17 — `sourceName` = το όνομα ΤΟΥ ΑΡΧΕΙΟΥ, immutable. Επιτρέπει στο
  // `reconcileSceneLayerIdentity` να ξαναβρεί αυτό το layer σε επόμενο import ΑΚΟΜΑ
  // ΚΑΙ αν ο χρήστης το έχει μετονομάσει στο μεταξύ.
  layers[layerName] = createSceneLayer({
    name: layerName,
    sourceName: layerName,
    color: resolvedColor,
    visible,
    frozen,
    locked,
  });
}
