/**
 * ADR-458 — Beam-to-column **cutback** scene post-pass (2Δ κάτοψη).
 *
 * Cross-element pass πάνω στο ΗΔΗ converted `DxfEntityUnion[]` (μετά το per-entity
 * WeakMap cache του `useDxfSceneConversion`): για κάθε δοκάρι που τέμνει κολόνα, θέτει
 * το DERIVED `geometry.displayOutline` (κομμένο στις παρειές των κολωνών, «η κολόνα
 * νικάει»). Ο `BeamRenderer` διαβάζει `displayOutline ?? outline` → ίδια γεωμετρία σε
 * bitmap pass, interactive overlay ΚΑΙ hit-test (ένα entity, μία αλήθεια).
 *
 * Γιατί post-pass (όχι μέσα στο `convertEntity`): το trim εξαρτάται από ΑΛΛΑ entities
 * (τις κολόνες) → δεν χωράει στο per-entity cache (που κλειδώνει στο beam ref· κολόνα
 * κινείται, beam ref ίδιο → stale). Το post-pass τρέχει σε κάθε scene-memo (νέο scene
 * ref όταν αλλάζει κολόνα) → πάντα fresh. DERIVED, ΠΟΤΕ persisted.
 *
 * Zero-cost fast path: χωρίς κολόνες Ή χωρίς δοκάρια → επιστρέφει το input ΑΥΤΟΥΣΙΟ
 * (ίδιο reference). Μόνο τα δοκάρια που πραγματικά κόβονται γίνονται νέα objects → μηδέν
 * περιττό churn referential stability.
 *
 * @see bim/geometry/beam-column-cutback.ts — pure SSoT
 * @see bim/renderers/BeamRenderer.ts — displayOutline ?? outline consumer
 */

import type { DxfEntityUnion, DxfBeam, DxfColumn } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  computeBeamCutbackOutline,
  computeBeamAxisToColumnContact,
  extendBeamOutlineIntoFramingColumns,
} from '../../bim/geometry/beam-column-cutback';
import type { Polyline3D } from '../../bim/types/bim-base';

/**
 * Εφαρμόζει το beam-to-column cutback στα δοκάρια του DxfScene. Επιστρέφει το ίδιο array
 * (by-reference) όταν δεν υπάρχει τομή να υπολογιστεί· αλλιώς νέο array με τα κομμένα
 * δοκάρια ανανεωμένα (υπόλοιπα entities by-reference).
 */
export function applyBeamColumnCutback2D(entities: DxfEntityUnion[]): DxfEntityUnion[] {
  let hasBeam = false;
  const columnFootprints: Point3D[][] = [];
  for (const e of entities) {
    if (e.type === 'beam') hasBeam = true;
    else if (e.type === 'column') {
      const verts = (e as DxfColumn).geometry?.footprint?.vertices;
      if (verts && verts.length >= 3) columnFootprints.push(verts.map((v) => ({ x: v.x, y: v.y, z: 0 })));
    }
  }
  if (!hasBeam || columnFootprints.length === 0) return entities;

  return entities.map((e) => {
    if (e.type !== 'beam') return e;
    const beam = e as DxfBeam;
    const display = buildBeamCutbackDisplay(
      beam.geometry?.outline?.vertices ?? [],
      beam.geometry?.axisPolyline?.points ?? [],
      columnFootprints,
    );
    if (!display) return e; // καμία τομή → αυτούσιο (zero regression)
    return {
      ...beam,
      geometry: {
        ...beam.geometry,
        displayOutline: display.displayOutline,
        ...(display.displayAxisPolyline ? { displayAxisPolyline: display.displayAxisPolyline } : {}),
      },
    } as DxfEntityUnion;
  });
}

// ─── Shared SSoT orchestration (committed scene-pass ΚΑΙ WYSIWYG preview) ─────

/** DERIVED beam display geometry μετά το beam-to-column cutback (ADR-458). */
export interface BeamCutbackDisplay {
  /** Κομμένο outline (outer rings)· `[]` = δοκάρι εξ ολοκλήρου μέσα σε κολόνα. */
  readonly displayOutline: Point3D[][];
  /** Άξονας προσαρμοσμένος στην παρειά κολόνας (location-line contact). */
  readonly displayAxisPolyline?: Polyline3D;
}

/**
 * Pure SSoT: beam outline + axis + column footprints → DERIVED display geometry
 * (cutback outline pieces + axis-to-column-face contact). `null` = καμία ουσιαστική
 * τομή (ο caller κρατά το αρχικό outline/axis). Κοινό από το scene post-pass
 * (committed beams) ΚΑΙ το WYSIWYG preview (ghost) → μηδέν διπλότυπο της ADR-458
 * orchestration. Μόνο straight 2-σημείων άξονας προσαρμόζεται (curved/split → axis
 * αυτούσιος, DEFER).
 */
export function buildBeamCutbackDisplay(
  beamOutline: readonly { readonly x: number; readonly y: number }[],
  axisPts: readonly { readonly x: number; readonly y: number; readonly z?: number }[],
  columnFootprints: readonly (readonly { readonly x: number; readonly y: number }[])[],
): BeamCutbackDisplay | null {
  if (beamOutline.length < 3 || columnFootprints.length === 0) return null;
  const outline2D = beamOutline.map((v) => ({ x: v.x, y: v.y }));
  // ADR-493 — Revit-grade: όταν το επίπεδο persisted άκρο εφάπτεται σε υποχωρούσα παρειά
  // (κυκλική/λοξή/σύνθετη), επέκτεινε ΜΟΝΟ το carve-outline του πλαισιωμένου άκρου ώστε το
  // safeDifference να σκαλίσει την ακριβή άψιδα (μηδέν persisted churn). Το location-line
  // contact μένει στο ΑΡΧΙΚΟ outline (μηδέν over-extend του άξονα μέσα στην κολώνα).
  const carveOutline = axisPts.length === 2
    ? (extendBeamOutlineIntoFramingColumns(
        outline2D,
        { x: axisPts[0].x, y: axisPts[0].y },
        { x: axisPts[1].x, y: axisPts[1].y },
        columnFootprints,
        true, // ADR-458 §diagonal-corner-seat: βαθιά έδραση ώστε ΛΟΞΟ δοκάρι να κάτσει πλήρως στη γωνία
      ) ?? outline2D)
    : outline2D;
  const pieces = computeBeamCutbackOutline(carveOutline, columnFootprints);
  if (pieces === null) return null;
  const displayOutline: Point3D[][] = pieces.map((ring) => ring.map((p) => ({ x: p.x, y: p.y, z: 0 })));

  let displayAxisPolyline: Polyline3D | undefined;
  if (pieces.length > 0 && axisPts.length === 2) {
    const adj = computeBeamAxisToColumnContact(
      { x: axisPts[0].x, y: axisPts[0].y },
      { x: axisPts[1].x, y: axisPts[1].y },
      outline2D,
      columnFootprints,
    );
    if (adj) {
      displayAxisPolyline = {
        points: [
          { x: adj[0].x, y: adj[0].y, z: axisPts[0].z ?? 0 },
          { x: adj[1].x, y: adj[1].y, z: axisPts[1].z ?? 0 },
        ],
        closed: false,
      };
    }
  }
  return { displayOutline, displayAxisPolyline };
}
