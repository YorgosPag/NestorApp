/**
 * bim-three-edges — shared 3D edge-projection overlay helper (the SOLE 3D
 * edge-attach SSoT).
 *
 * Extracted from BimToThreeConverter.ts (Google file-size SSoT, N.7.1) so the
 * point-based converters (bim-three-point-converters.ts), the structural
 * converters AND the stair converter share ONE edge-attach routine
 * (ADR-375 Phase C.7, unified ADR-377 Phase E).
 *
 * ADR-377 Phase E — 3D ⟷ 2D subcategory parity:
 *   - Reads the SAME `objectStyles` SSoT the 2D renderers read at draw time
 *     (`useBimRenderSettingsStore.getState().objectStyles`), so user V/G
 *     category + subcategory pen/colour/pattern overrides reach the 3D edges.
 *     A rebuild on every `objectStyles` mutation is already wired by
 *     `useBim3DVgResync`, so the build-time read is always fresh.
 *   - Threads the per-geometry `subcategoryKey` (e.g. wall `common-edges`,
 *     stair `treads`) exactly like the 2D renderer sub-passes.
 *   - Propagates `linePattern` so dashed/dotted subcategories render dashed in 3D.
 */
import * as THREE from 'three';
import { resolve3DEdgeStyle } from '../edges/bim-3d-edge-resolver';
import { buildEdgeOverlay, attachEdgeOverlay } from '../edges/bim-3d-edge-overlay-builder';
import type { BimCategory } from '../../config/bim-object-styles';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';

// ADR-375 Phase C.7 — default 3D edge resolution context.
// scaleDenominator 100 = 1:100 architectural plan, the most common BIM scale.
// dpi 96 = standard CSS pixel density.
const EDGE_DEFAULT_SCALE = 100;
const EDGE_DEFAULT_DPI = 96;

/**
 * ADR-375 Phase C.7 (v2.22) — uniform "Shaded with Edges" silhouette colour.
 *
 * Revit's shaded 3D view draws model edges in ONE uniform dark line colour, not
 * the per-category 2D projection colours (those drive plan/wireframe line work,
 * e.g. v2.19 gave columns a blue-grey `#5b6478`). For the 3D solid view Giorgio
 * wants consistent discreet BLACK edges, so we override the resolver colour here
 * with a single near-black. The resolver still drives width / pattern / visibility
 * (pen table, V/G eye toggle, per-element/layer overrides all keep working in 3D).
 */
const BIM_3D_EDGE_COLOR = '#1a1a1a';

/**
 * ADR-445 §structural-framing-reads-by-edges (Giorgio 2026-07-03) — «το δοκάρι
 * καταπίνεται από τον τοίχο».
 *
 * Ένα δοκάρι που κάθεται flush ΠΑΝΩ σε τοίχο με το ΙΔΙΟ footprint (πλάτος = πάχος
 * τοίχου) έχει τις πλάγιες όψεις του coplanar & συνεχείς με τις όψεις του τοίχου.
 * Όταν η «Σοβατισμένη όψη» (ADR-449 finish skin) είναι ON, ΚΑΙ οι δύο βάφονται με
 * τον ίδιο plaster (cream) → το amber core (`elem-beam`) κρύβεται → το δοκάρι «λιώνει».
 *
 * Fix «όπως οι μεγάλοι» (Revit Structural / Tekla): η δομή διαβάζεται από το category
 * χρώμα των ΑΚΜΩΝ της. Το δοκάρι κρατά το amber (`BIM_CATEGORY_LINE_COLORS.beam`)
 * silhouette του σε ΚΑΘΕ background — δεν πέφτει στο uniform near-black silhouette
 * (v2.22) που κρατούν οι υπόλοιπες κατηγορίες στο light bg. Έτσι το περίγραμμα του
 * δοκαριού διαβάζεται πάνω στις σκούρες ακμές του τοίχου, ακόμη & κάτω από τον σοβά.
 * Στοχευμένο (μόνο `beam`) → μηδέν regression σε τοίχο/κολόνα/πλάκα.
 */
const STRUCTURAL_EDGE_IDENTITY_CATEGORIES: ReadonlySet<BimCategory> = new Set<BimCategory>(['beam']);

/**
 * Build + attach the projection edge overlay for a BIM solid mesh.
 *
 * @param subcategoryKey ADR-377 — the geometry sub-pass this mesh represents
 *   (wall/slab `common-edges`, stair `treads`/`risers`/`outlines`, …). Omit for
 *   categories whose 3D silhouette maps to the parent style (column, beam,
 *   point-based fixtures/panels) — preserving the pre-ADR-377 default look.
 */
export function attachEdgesProjection(
  mesh: THREE.Mesh,
  category: BimCategory,
  subcategoryKey?: string,
): void {
  // ADR-446 — Visual Style EDGES axis. `none` → no overlay at all (Shaded /
  // Realistic without edges). `visible` → occluded (depthTest on). `all` → x-ray
  // (depthTest off — Wireframe shows every edge through the absent faces).
  const edgeMode = useBimRenderSettingsStore.getState().edgeMode;
  if (edgeMode === 'none') return;

  const style = resolve3DEdgeStyle({
    category,
    cutState: 'projection',
    scaleDenominator: EDGE_DEFAULT_SCALE,
    dpi: EDGE_DEFAULT_DPI,
    subcategoryKey,
    objectStyles: useBimRenderSettingsStore.getState().objectStyles,
  });
  // ADR-446 §2 — «σαν 2Δ» dark background = FULL SSoT with the 2D line work. The
  // uniform near-black silhouette override is DROPPED entirely, so each entity keeps
  // EXACTLY the per-category / V-G / layer colour the 2D plan renders (`style.color`,
  // the same `resolveSubcategoryStyle` source the 2D renderers read) — e.g. blue
  // columns, amber beams. On the matching black canvas (--canvas-background-dxf) these
  // read just like the 2D view. In the default (light/environment) background we keep
  // v2.22's uniform near-black silhouette (Revit "Shaded with Edges"). width/pattern/
  // visibility stay resolver-driven in both.
  const darkBg = useBimRenderSettingsStore.getState().backgroundMode === 'dark';
  // ADR-445 — structural framing (beam) keeps its category colour on light bg too, so a
  // beam flush on a wall (same footprint + finish skin) still reads apart. All other
  // categories keep the uniform near-black silhouette on light bg (v2.22). Guard on a
  // resolved colour so a null/hidden style still falls back to the builder default.
  const keepCategoryEdgeColor =
    darkBg || (STRUCTURAL_EDGE_IDENTITY_CATEGORIES.has(category) && style.color !== null);
  attachEdgeOverlay(
    mesh,
    buildEdgeOverlay(mesh, {
      ...style,
      ...(keepCategoryEdgeColor ? {} : { color: BIM_3D_EDGE_COLOR }),
      occlude: edgeMode !== 'all',
    }),
  );
}
