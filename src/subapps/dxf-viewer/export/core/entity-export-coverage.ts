/**
 * ENTITY EXPORT COVERAGE — declarative SSoT «renderable type × απόφαση εξαγωγής ανά format»
 * (ADR-648 Στάδιο Δ). Big-player coverage-guard pattern (mirror `rotate-entity-coverage`): κάθε
 * `RenderableEntityType` δηλώνει ΡΗΤΑ πώς εξάγεται σε DXF και σε TEK, ώστε ΚΑΝΕΝΑΣ τύπος να μη
 * χάνεται σιωπηλά — ούτε σήμερα ούτε στο μέλλον. Νέος renderable τύπος → σπάει το coverage test →
 * επιβάλλει συνειδητή απόφαση ανά format.
 *
 * Οι DXF-native αποφάσεις είναι ΕΠΙΠΛΕΟΝ runtime-locked από το
 * `__tests__/dxf-entity-dispatch-characterization.test.ts` (byte-identical snapshots).
 */

import { RENDERABLE_ENTITY_TYPES, type RenderableEntityType } from '../../rendering/contract/renderable-entity-type';

/**
 * Πώς εξάγεται ένας τύπος σε ΕΝΑ format:
 *  - `native`     : native record του format (DXF entity / TEK record), απευθείας από τον dispatch/collector.
 *  - `decompose`  : αποδομείται upstream σε primitives (BIM→lwpolyline flatten / annotation→primitives) πριν φτάσει στον writer.
 *  - `tessellate` : εκπέμπεται ως tessellated polyline/lines (curve → ευθύγραμμα τμήματα) στο συγκεκριμένο format.
 *  - `drop`       : ΣΚΟΠΙΜΑ δεν εξάγεται (ο format δεν έχει έννοια γι' αυτό — π.χ. infinite line στον Τέκτονα).
 *  - `missing`    : ΚΕΝΟ — δεν εξάγεται ενώ ΘΑ έπρεπε (γνωστό gap, tracked εδώ μέχρι να κλείσει).
 */
export type ExportDecision = 'native' | 'decompose' | 'tessellate' | 'drop' | 'missing';

export interface EntityExportCoverage {
  readonly dxf: ExportDecision;
  readonly tek: ExportDecision;
}

/**
 * Ο πίνακας κάλυψης (audit 2026-07-13, ADR-648 §2). ⚠️ ΟΤΑΝ κλείνεις ένα `missing` → ενημέρωσε
 * ΚΑΙ εδώ ΚΑΙ το ADR-648 changelog (ίδιο commit).
 */
export const ENTITY_EXPORT_COVERAGE: Readonly<Record<RenderableEntityType, EntityExportCoverage>> = {
  // ── DXF primitives ─────────────────────────────────────────────────────────
  line:        { dxf: 'native', tek: 'native' },
  polyline:    { dxf: 'native', tek: 'native' },
  lwpolyline:  { dxf: 'native', tek: 'native' },
  circle:      { dxf: 'native', tek: 'native' },
  arc:         { dxf: 'native', tek: 'native' },
  rectangle:   { dxf: 'native', tek: 'native' },
  rect:        { dxf: 'native', tek: 'native' },
  text:        { dxf: 'native', tek: 'native' },
  hatch:       { dxf: 'native', tek: 'native' },
  // ADR-648 Στάδιο Β — native στο AutoCAD, tessellated στον Τέκτονα (minimal parser).
  ellipse:     { dxf: 'native', tek: 'missing' },
  spline:      { dxf: 'native', tek: 'missing' },
  // Construction geometry — native XLINE/RAY στο AutoCAD· ο Τέκτων δεν έχει infinite line → drop.
  xline:       { dxf: 'native', tek: 'drop' },
  ray:         { dxf: 'native', tek: 'drop' },
  // Native DXF, αλλά ο TEK collector δεν τα πιάνει ακόμη (ADR-648 §7 follow-up).
  mtext:       { dxf: 'native', tek: 'missing' },
  point:       { dxf: 'native', tek: 'missing' },
  dimension:   { dxf: 'native', tek: 'missing' },
  // ADR-635 Φ B — native LEADER στο AutoCAD (`dxf-ascii-entity-dispatch` case 'leader', ο ακριβής
  // αντίστροφος του import `convertLeader`)· ο TEK collector δεν το πιάνει ακόμη (ίδια οικογένεια
  // με mtext/point/dimension, ADR-648 §7 follow-up).
  leader:      { dxf: 'native', tek: 'missing' },
  // ADR-662 Φ2β (Stage A plumbing) — ΚΑΝΕΝΑΣ export dispatch case σε κανένα από τα δύο formats.
  // ΟΧΙ `drop`: το DXF ΕΧΕΙ έννοια για TIN surface (3DFACE / POLYFACE MESH — ό,τι εκπέμπει το
  // Civil 3D), άρα αυτό είναι γνήσιο κενό προς κλείσιμο, όχι σκόπιμη παράλειψη. Ο Τέκτων μένει
  // κι αυτός `missing` μέχρι να τεκμηριωθεί ότι δεν έχει terrain concept (ADR-662 follow-up).
  'topo-surface': { dxf: 'missing', tek: 'missing' },
  // ── Annotations (non-BIM) ──────────────────────────────────────────────────
  'annotation-symbol': { dxf: 'decompose', tek: 'native' }, // TEK: type-7 object ή decompose
  'scale-bar':         { dxf: 'decompose', tek: 'decompose' },
  // ADR-651 Φάση Ε — native IMAGE/IMAGEDEF στο AutoCAD (export pre-pass, dxfImageExport
  // marker)· ο Τέκτων δεν έχει raster-image concept → σκόπιμο drop (mirror xline/ray).
  image:               { dxf: 'native', tek: 'drop' },
  // ADR-648 §2 — νέο εύρημα: ΔΕΝ τα πιάνει ούτε flatten ούτε annotation-expand → dropped ΚΑΙ στα δύο.
  'angle-measurement': { dxf: 'missing', tek: 'missing' },
  'opening-info-tag':  { dxf: 'missing', tek: 'missing' },
  // ── BIM (parametric) — DXF: flatten→primitives· TEK: native για wall/opening/roof/stair/furniture ─
  wall:            { dxf: 'decompose', tek: 'native' },
  opening:         { dxf: 'decompose', tek: 'native' },
  roof:            { dxf: 'decompose', tek: 'native' },
  stair:           { dxf: 'decompose', tek: 'native' },
  furniture:       { dxf: 'decompose', tek: 'native' },
  // ADR-683 Φ3 §10.1 — «Εξάγεται; ✅ Ναι (OBJ/glTF)». Το 3Δ export το καλύπτει ο κοινός
  // converter chain. DXF: decompose (το περίγραμμα κάτοψης γίνεται primitives). TEK: κενό —
  // το TEK περιμένει παραμετρικό στοιχείο, και το εισαγόμενο δεν είναι (§3).
  'imported-mesh': { dxf: 'decompose', tek: 'missing' },
  // ADR-684 Φ2 §6 — «Εξάγεται; ✅ Ναι». 3Δ mesh export (triangle soup) μέσω του κοινού converter
  // chain. DXF: decompose (το footprint outline γίνεται lwpolyline μέσω του generic extractor).
  // TEK: κενό — το TEK περιμένει παραμετρικό δομικό στοιχείο (mirror imported-mesh).
  'generic-solid': { dxf: 'decompose', tek: 'missing' },
  slab:            { dxf: 'decompose', tek: 'missing' },
  'slab-opening':  { dxf: 'decompose', tek: 'missing' },
  column:          { dxf: 'decompose', tek: 'missing' },
  beam:            { dxf: 'decompose', tek: 'missing' },
  foundation:      { dxf: 'decompose', tek: 'missing' },
  railing:         { dxf: 'decompose', tek: 'missing' },
  'floor-finish':  { dxf: 'decompose', tek: 'missing' },
  'wall-covering': { dxf: 'decompose', tek: 'missing' },
  'thermal-space': { dxf: 'decompose', tek: 'missing' },
  'space-separator': { dxf: 'decompose', tek: 'missing' },
  'floorplan-symbol': { dxf: 'decompose', tek: 'missing' },
  'mep-fixture':     { dxf: 'decompose', tek: 'missing' },
  'electrical-panel': { dxf: 'decompose', tek: 'missing' },
  'mep-manifold':    { dxf: 'decompose', tek: 'missing' },
  'mep-radiator':    { dxf: 'decompose', tek: 'missing' },
  'mep-boiler':      { dxf: 'decompose', tek: 'missing' },
  'mep-water-heater': { dxf: 'decompose', tek: 'missing' },
  'mep-segment':     { dxf: 'decompose', tek: 'missing' },
  'mep-fitting':     { dxf: 'decompose', tek: 'missing' },
  'mep-underfloor':  { dxf: 'decompose', tek: 'missing' },
};

/** Renderable τύποι με ΓΝΩΣΤΟ κενό εξαγωγής (`missing`) σε τουλάχιστον έναν format — ADR-648 §7 backlog. */
export function entitiesWithExportGap(): RenderableEntityType[] {
  return RENDERABLE_ENTITY_TYPES.filter(
    (t) => ENTITY_EXPORT_COVERAGE[t].dxf === 'missing' || ENTITY_EXPORT_COVERAGE[t].tek === 'missing',
  );
}
