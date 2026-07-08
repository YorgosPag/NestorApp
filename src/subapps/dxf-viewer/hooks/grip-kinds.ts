/**
 * Parametric grip-kind discriminator unions — extracted from `grip-types.ts`
 * (SRP / Google file-size standard N.7.1). These are the per-entity grip-kind
 * string-literal unions referenced by `GripInfo` and consumed across the grip
 * subsystem. Re-exported from `grip-types.ts` for backward compatibility, so
 * existing `import { WallGripKind } from '../grip-types'` call-sites keep working.
 *
 * MEP heating / underfloor kinds live in the sibling module
 * `grip-kinds-mep-heating.ts` and are re-exported below.
 */

import type { GripKind } from '../rendering/types/Types';

export type {
  MepRadiatorGripKind,
  MepBoilerGripKind,
  MepWaterHeaterGripKind,
  MepUnderfloorGripKind,
} from './grip-kinds-mep-heating';

// ADR-602 (ADR-587 Φ6) — local `import type` bindings των 19 sibling grip-kind
// unions (τα υπόλοιπα 12 ορίζονται σε αυτό το module) ώστε να χτιστεί το
// `GripKindByEntity` SSoT map στο τέλος του αρχείου. Τα ίδια ονόματα μένουν
// re-exported (τα blocks πιο κάτω) για backward-compat — ο re-export `export …
// from` ΔΕΝ δίνει local binding, γι' αυτό χρειάζεται ξεχωριστό `import type`.
import type {
  MepFixtureGripKind,
  ElectricalPanelGripKind,
  MepManifoldGripKind,
  FurnitureGripKind,
  FloorplanSymbolGripKind,
  MepSegmentGripKind,
  XLineGripKind,
  RayGripKind,
} from './grip-kinds-placeable';
import type {
  PolylineGripKind,
  CircleGripKind,
  ArcGripKind,
  LineGripKind,
  GroupGripKind,
  AnnotationSymbolGripKind,
} from './grip-kinds-primitives';
import type { TextGripKind } from './grip-kinds-text';
import type {
  MepRadiatorGripKind,
  MepBoilerGripKind,
  MepWaterHeaterGripKind,
  MepUnderfloorGripKind,
} from './grip-kinds-mep-heating';
import type { BeamGripKind, ColumnGripKind, FoundationGripKind } from './grip-kinds-structural';

/** Generic grip-type enumeration — ADR-559 projection of the canonical `GripKind` SSoT
 * (rendering/types/Types.ts). The interaction layer omits only the data-model-only 'control'
 * point and 'close'. `'quadrant'` IS included (ADR-559 «visible ≡ pickable»: circle/ellipse
 * quadrant grips are gated by `isGripTypeVisible` in BOTH render + hit-test).
 * NOTE: distinct from `rendering/grips/types.ts GripType` (render layer) — flagged for a
 * future name de-collision pass; both now derive from the same canonical set. */
export type GripType = Exclude<GripKind, 'control' | 'close'>;

/**
 * ADR-358 Phase 5b + ADR-393 — Stair grip kind (parametric grip type).
 *
 * ADR-358 Phase 5b base grips: base point translate, direction rotate, width
 * resize, length (stepCount) resize.
 *
 * ADR-393 (2026-05-28) extends with asymmetric corner grips + a mid-front
 * start grip + per-flight landing-edge grips (replacing the legacy
 * `stair-split` centroid grip) + landing depth / corner-radius grips:
 *   - `stair-corner-{start,end}-{left,right}` → 2-DOF asymmetric (mirror
 *     ADR-363 Phase 1C-bis wall corners): axial moves nearest end, perp grows
 *     width symmetrically with axis recenter.
 *   - `stair-start-side` → mid-front edge, moves basePoint along direction.
 *   - `stair-flight1-end` / `stair-flight2-start` → landing entry/exit edges
 *     (L/U/Γ only); replace the removed `stair-split` ratio grip.
 *   - `stair-landing-depth` → resize landing depth (L/U/Γ only).
 *   - `stair-landing-corner-radius` → resize landing corner radius (emitted
 *     only when `landingCornerStyle !== 'sharp'`).
 *
 * See `bim/stairs/stair-grips.ts`.
 */
export type StairGripKind =
  | 'stair-base'
  | 'stair-direction'
  | 'stair-width'
  | 'stair-length'
  // ADR-393 Phase A1 — asymmetric corner grips (straight)
  | 'stair-corner-start-left'
  | 'stair-corner-start-right'
  | 'stair-corner-end-left'
  | 'stair-corner-end-right'
  // ADR-393 Phase A2 — mid-front start grip (straight)
  | 'stair-start-side'
  // ADR-393 Phase B1 — per-flight landing edges (L/U/Γ) — replace 'stair-split'
  | 'stair-flight1-end'
  | 'stair-flight2-start'
  // ADR-393 Phase B2 — landing depth + corner radius (L/U/Γ)
  | 'stair-landing-depth'
  | 'stair-landing-corner-radius';

/**
 * ADR-362 Phase I2 — Dimension grip kind.
 * Routes grip commit through `applyDimensionGripDrag` + direct scene patch
 * instead of the standard `StretchEntityCommand` vertex path.
 * See `hooks/dimensions/useDimensionGrips.ts`.
 */
export type DimensionGripKind =
  | 'dim-defpoint-0'  // ext line origin 1 → defPoints[0]
  | 'dim-defpoint-1'  // ext line origin 2 → defPoints[1]
  | 'dim-line-ref'    // dim line endpoint 1 (offset stretch) → commits defPoints[2]
  | 'dim-text'        // text label → textMidpoint
  | 'dim-extra';      // 5th grip — linear/aligned: dim line endpoint 2 (offset stretch, NO rotation); radial/angular/ordinate: type-specific arcPoint / datum / etc.

/**
 * ADR-363 Phase 1C — Wall grip kind (parametric grip type).
 * Routes commit through `applyWallGripDrag()` + `UpdateWallParamsCommand`
 * instead of the standard `StretchEntityCommand` vertex path.
 *
 * Wall grips exposed by `WallEntity` (`bim/walls/wall-grips.ts`):
 *   - `wall-start`     → translate axis start endpoint
 *   - `wall-end`       → translate axis end endpoint
 *   - `wall-midpoint`  → translate whole wall (axis midpoint anchor)
 *   - `wall-thickness` → resize thickness perpendicular to axis (symmetric)
 *   - `wall-curve`     → move quadratic Bezier control point (curved kind only)
 *   - `wall-vertex-N`  → translate polyline interior vertex N (polyline kind only)
 *
 * Phase 1C-bis (2026-05-27) — Asymmetric corner grips (ArchiCAD / Vectorworks /
 * AutoCAD reference-line pattern). Each corner exposes 2 DOF:
 *   - axial component → moves only the nearest axis endpoint (start or end);
 *   - perpendicular component → grows/shrinks ONLY the corner's side, keeps
 *     the opposite face fixed, and re-centers the axis by half the displacement
 *     so the wall stays rectangular (parallel faces preserved).
 *
 *   - `wall-corner-start-pos` → start endpoint + positive perpendicular face
 *   - `wall-corner-start-neg` → start endpoint + negative perpendicular face
 *   - `wall-corner-end-pos`   → end   endpoint + positive perpendicular face
 *   - `wall-corner-end-neg`   → end   endpoint + negative perpendicular face
 *
 * Phase 1C-ter (2026-05-28) — `wall-midpoint` renders the 4-arrow MOVE glyph and
 * `wall-rotation` (a handle just outside the end short edge) renders the curved
 * ROTATION glyph — same icon vocabulary as the stair base/direction grips
 * (`stairGripGlyphShape`). `wall-rotation` rotates the whole wall around its
 * midpoint (anchor-relative swept angle, mirror of stair `rotateDirection`).
 *
 * Column-parity mid-edge completion (Giorgio 2026-06-20): the 2 OPPOSITE mid-edge
 * grips so all 4 faces carry a midpoint handle (mirror της κολόνας / δοκαριού 4
 * μεσοπλευρικών). They reuse the SAME `axis-box-grips` edge SSoT as
 * `wall-thickness` / `wall-edge-length`, just on the opposite-sign face (respecting
 * `flip`), with the wall semantics (drop `dna`, clamp thickness, clear miters):
 *   - `wall-thickness-far`      → resize thickness on the −perp face (near face fixed).
 *   - `wall-edge-length-start`  → resize length at the START short edge (end fixed).
 */
export type WallGripKind =
  | 'wall-start'
  | 'wall-end'
  | 'wall-midpoint'
  | 'wall-thickness'
  | 'wall-edge-length'
  | 'wall-thickness-far'
  | 'wall-edge-length-start'
  | 'wall-rotation'
  | 'wall-corner-start-pos'
  | 'wall-corner-start-neg'
  | 'wall-corner-end-pos'
  | 'wall-corner-end-neg'
  | 'wall-curve'
  | 'wall-arc-apex'
  | `wall-vertex-${number}`;

/**
 * ADR-363 Phase 2.5 + facing-flip — Opening grip kinds (parametric grip types).
 * Routes commit through `applyOpeningGripDrag()` + `UpdateOpeningParamsCommand`
 * instead of the standard `StretchEntityCommand` vertex path.
 *
 * Grips (Revit parity — two independent flip axes):
 *   - `opening-move`        → drag the whole opening along the host wall axis.
 *   - `opening-rotation`    → click-to-toggle handing (left↔right hinge side).
 *   - `opening-facing`      → click-to-toggle openDirection (inward↔outward face).
 *                             Hinged kinds only (door / french-door).
 *   - `opening-corner-{ne,nw,sw,se}` → resize WIDTH along the wall (opposite jamb
 *     pinned). E corners (ne/se) move the end jamb, W corners (nw/sw) the start jamb.
 */
export type OpeningGripKind =
  | 'opening-move'
  | 'opening-rotation'
  | 'opening-facing'
  | 'opening-corner-ne'
  | 'opening-corner-nw'
  | 'opening-corner-sw'
  | 'opening-corner-se';

/**
 * ADR-363 Phase 3.5 + 3.6 — Slab grip kind (parametric grip type).
 * Routes commit through `applySlabGripDrag()` + `UpdateSlabParamsCommand`
 * instead of the standard `StretchEntityCommand` vertex path.
 *
 * Two grip families exposed by `SlabEntity` (`bim/slabs/slab-grips.ts`):
 *   - `slab-vertex-N`        → translate polygon outline vertex N (XY only, z preserved).
 *   - `slab-edge-midpoint-N` → insert new vertex at edge N midpoint + delta
 *                              (Phase 3.6 — splits edge `[N, N+1]`).
 */
export type SlabGripKind =
  | `slab-vertex-${number}`
  | `slab-edge-midpoint-${number}`;

/**
 * ADR-363 Phase 3.7a — Slab-opening grip kind (parametric grip type).
 * Routes commit through `applySlabOpeningGripDrag()` +
 * `UpdateSlabOpeningParamsCommand` instead of the standard `StretchEntityCommand`
 * vertex path.
 *
 * Two grip families exposed by `SlabOpeningEntity`
 * (`bim/slab-openings/slab-opening-grips.ts`):
 *   - `slab-opening-vertex-N`        → translate cutout outline vertex N
 *                                      (XY only, z preserved).
 *   - `slab-opening-edge-midpoint-N` → insert new vertex at edge N midpoint +
 *                                      delta (splits edge `[N, N+1]`).
 */
export type SlabOpeningGripKind =
  | `slab-opening-vertex-${number}`
  | `slab-opening-edge-midpoint-${number}`;

/**
 * ADR-417 Φ1-part-2 #2 — Roof grip kind (parametric grip type, Revit «Edit
 * Footprint»). Routes commit through `applyRoofGripDrag()` +
 * `UpdateRoofParamsCommand` instead of the standard `StretchEntityCommand`
 * vertex path.
 *
 * Two grip families exposed by `RoofEntity` (`bim/roofs/roof-grips.ts`):
 *   - `roof-vertex-N`        → translate footprint outline vertex N (XY only,
 *                              z preserved; `edges` count unchanged).
 *   - `roof-edge-midpoint-N` → insert new vertex at edge N midpoint + delta
 *                              (splits edge `[N, N+1]` + splices a copy of
 *                              `edges[N]` so `edges` stays in lockstep with
 *                              `outline.vertices`).
 */
export type RoofGripKind =
  | `roof-vertex-${number}`
  | `roof-edge-midpoint-${number}`;

/**
 * ADR-419 — Floor finish grip kind (parametric grip type).
 * Routes commit through `applyFloorFinishGripDrag()` +
 * `UpdateFloorFinishParamsCommand` instead of the standard
 * `StretchEntityCommand` vertex path.
 *
 * Two grip families exposed by `FloorFinishEntity`:
 *   - `floor-finish-vertex-N`        → translate footprint outline vertex N.
 *   - `floor-finish-edge-midpoint-N` → insert new vertex at edge N midpoint.
 */
export type FloorFinishGripKind =
  | `floor-finish-vertex-${number}`
  | `floor-finish-edge-midpoint-${number}`;

/**
 * ADR-507 — Hatch grip kind (parametric grip type). The hatch is a FLAT primitive
 * (`boundaryPaths: Point2D[][]`), so the kind encodes BOTH ring + vertex indices
 * (unlike the flat floor-finish footprint). Routes commit through
 * `applyHatchGripDrag()` + `UpdateHatchBoundaryCommand`.
 *
 *   - `hatch-vertex-${pathIdx}-${vertexIdx}` → translate boundary vertex
 *     (commit: `applyHatchGripDrag()` + `UpdateHatchBoundaryCommand`).
 *   - `hatch-gradient-origin` → drag the gradient origin/seed point (ADR-507 Φ5 A3·
 *     reuse `patternOrigin`· commit: `applyHatchOriginGripDrag()` +
 *     `UpdateHatchOriginCommand`). Εμφανίζεται ΜΟΝΟ όταν `fillType==='gradient'`.
 *   - `hatch-gradient-angle` → drag τον βραχίονα που περιστρέφει τη φορά του gradient
 *     (ADR-507 Φ5 A4· `gradient.angleDeg`· commit: `applyHatchAngleGripDrag()` +
 *     `UpdateHatchGradientCommand`). Εμφανίζεται ΜΟΝΟ όταν `fillType==='gradient'`.
 */
export type HatchGripKind =
  | `hatch-vertex-${number}-${number}`
  // ADR-507 — edge-midpoint grip (ring `pathIdx`, edge `edgeIdx`→`edgeIdx+1`). Drag/click
  // inserts a NEW boundary vertex at the edge midpoint (commit: `applyHatchGripDrag()` +
  // `UpdateHatchBoundaryCommand`). Mirror of `floor-finish-edge-midpoint-N`.
  | `hatch-edge-midpoint-${number}-${number}`
  | 'hatch-gradient-origin'
  | 'hatch-gradient-angle';

// ADR-363/436 — beam / column / foundation (structural-frame-element) grip kinds
// live in the sibling module `grip-kinds-structural.ts` (SRP / N.7.1) and are
// re-exported here for backward compatibility (existing
// `import { ColumnGripKind } from '../grip-kinds'`).
export type { BeamGripKind, ColumnGripKind, FoundationGripKind } from './grip-kinds-structural';

// ADR-510/561/363 — plain-DXF-primitive grip kinds (polyline / circle / arc /
// line) live in the sibling module `grip-kinds-primitives.ts` (SRP / N.7.1) and
// are re-exported here for backward compatibility (existing
// `import { LineGripKind } from '../grip-kinds'`).
export type {
  PolylineGripKind,
  CircleGripKind,
  ArcGripKind,
  LineGripKind,
  GroupGripKind,
  AnnotationSymbolGripKind,
} from './grip-kinds-primitives';

// ADR-557 — Text / MText grip kinds live in the sibling module
// `grip-kinds-text.ts` (SRP / N.7.1) and are re-exported here for backward
// compatibility (existing `import { TextGripKind } from '../grip-kinds'`).
export type { TextGripKind } from './grip-kinds-text';

// ADR-406/408/410/415/359 — placeable-object + linear-element grip kinds live in
// the sibling module `grip-kinds-placeable.ts` (SRP / N.7.1) and are re-exported
// here for backward compatibility (existing `import { … } from '../grip-kinds'`).
export type {
  MepFixtureGripKind,
  ElectricalPanelGripKind,
  MepManifoldGripKind,
  FurnitureGripKind,
  FloorplanSymbolGripKind,
  MepSegmentGripKind,
  XLineGripKind,
  RayGripKind,
} from './grip-kinds-placeable';

// ============================================================================
// ADR-602 — Grip discriminator SSoT (ADR-587 Φ6) · Stage 1 (additive)
// ============================================================================
//
// Ο grip discriminator κουβαλιέται σήμερα ως **31 optional `xxxGripKind?` πεδία**
// (ένα ανά entity type) που **επαναλαμβάνονται σε 4 field-bags** (`GripInfo` /
// `UnifiedGripInfo` / `DxfGripDragPreview` / `EntityPreviewTransform`). Νέος
// entity type = χειροκίνητη προσθήκη σε 4 interfaces + forwarding hubs + producer
// + dispatch — καθαρό anti-SSoT (η βάση του ADR-587).
//
// Το target είναι **ΕΝΑ** tagged discriminated union παραγόμενο από **ΕΝΑ** map:
// νέος entity type = **1 γραμμή** στο `GripKindByEntity` (+ 1 στο
// `GRIP_KIND_ENTITIES`) αντί 4×. Stage 1 (ADR-602 §3) = additive: το
// `gripKind?: EntityGripKind` μπαίνει ΔΙΠΛΑ στα 31 optionals (μηδέν behavior
// change)· τα 617 reads + 35 producers + 4 hubs μεταναστεύουν στα Stages 2-5.

/**
 * Master map **entity-type → grip-kind union** — η **ΜΙΑ** SSoT του grip
 * discriminator domain. Το κλειδί (`on` tag) είναι το `entity.type` string
 * (kebab-case, code=truth-επιβεβαιωμένο) και η τιμή το αντίστοιχο per-entity
 * `*GripKind` union του master catalog (ADR-602 §1.1). **Νέος entity type με
 * grips → πρόσθεσε ΕΔΩ 1 γραμμή** (+ 1 στο `GRIP_KIND_ENTITIES`).
 *
 * ⚠️ Domain = οι **31 grip-producer entities**, ΟΧΙ το `RENDERABLE_ENTITY_TYPES`:
 * περιλαμβάνει το editor-only `group` (μη-renderable) και αποκλείει renderable
 * types χωρίς grips (π.χ. `railing`, `mep-fitting`).
 */
export interface GripKindByEntity {
  wall: WallGripKind;
  stair: StairGripKind;
  dimension: DimensionGripKind;
  opening: OpeningGripKind;
  slab: SlabGripKind;
  'slab-opening': SlabOpeningGripKind;
  roof: RoofGripKind;
  'floor-finish': FloorFinishGripKind;
  hatch: HatchGripKind;
  'mep-underfloor': MepUnderfloorGripKind;
  beam: BeamGripKind;
  column: ColumnGripKind;
  foundation: FoundationGripKind;
  'mep-fixture': MepFixtureGripKind;
  'electrical-panel': ElectricalPanelGripKind;
  'mep-manifold': MepManifoldGripKind;
  'mep-radiator': MepRadiatorGripKind;
  'mep-boiler': MepBoilerGripKind;
  'mep-water-heater': MepWaterHeaterGripKind;
  furniture: FurnitureGripKind;
  'floorplan-symbol': FloorplanSymbolGripKind;
  'mep-segment': MepSegmentGripKind;
  xline: XLineGripKind;
  ray: RayGripKind;
  polyline: PolylineGripKind;
  circle: CircleGripKind;
  arc: ArcGripKind;
  line: LineGripKind;
  group: GroupGripKind;
  'annotation-symbol': AnnotationSymbolGripKind;
  text: TextGripKind;
}

/**
 * Tagged grip discriminator — 31-μελές discriminated union **παραγόμενο** από το
 * `GripKindByEntity` map (mapped-type distribution· μηδέν χειρόγραφη λίστα). Κάθε
 * μέλος: `{ on: <entity.type>, kind: <το union του type> }`. Το tag είναι
 * **υποχρεωτικό** γιατί τα 31 kind-unions ΔΕΝ είναι εγγυημένα disjoint (μοιράζονται
 * `'*-move'` / `'*-vertex-N'` literals) — Revit/Figma command-object pattern
 * (ADR-602 §2), ώστε ο dispatcher να ξέρει σε ΠΟΙΟΝ entity ανήκει το kind.
 */
export type EntityGripKind = {
  [K in keyof GripKindByEntity]: { readonly on: K; readonly kind: GripKindByEntity[K] };
}[keyof GripKindByEntity];

/**
 * SSoT accessor — τυποποιημένο, terse διάβασμα ενός tagged `gripKind`. Επιστρέφει
 * το kind ΜΟΝΟ όταν το tag ταιριάζει με το `on`, αλλιώς `undefined`. **ΕΝΑ**
 * generic (ΟΧΙ 31 overloads): `gripKindOf(grip, 'wall')` → `WallGripKind |
 * undefined`. Κρατά τα call-sites terse+typed στα Stages 4-5.
 */
export function gripKindOf<K extends keyof GripKindByEntity>(
  g: { readonly gripKind?: EntityGripKind },
  on: K,
): GripKindByEntity[K] | undefined {
  return g.gripKind?.on === on ? (g.gripKind.kind as GripKindByEntity[K]) : undefined;
}

/**
 * Runtime mirror του `keyof GripKindByEntity` (completeness anchor). Νέος entity
 * type → πρόσθεσέ τον ΚΑΙ εδώ ΚΑΙ στο map· το `satisfies` παρακάτω σπάει αν βάλεις
 * άκυρο key, και το coverage test (`grip-kinds-coverage.test.ts`, bidirectional
 * bridge) σπάει αν το σετ αποκλίνει από το map. Σειρά = master catalog (§1.1).
 */
export const GRIP_KIND_ENTITIES = [
  'wall', 'stair', 'dimension', 'opening', 'slab', 'slab-opening', 'roof',
  'floor-finish', 'hatch', 'mep-underfloor', 'beam', 'column', 'foundation',
  'mep-fixture', 'electrical-panel', 'mep-manifold', 'mep-radiator', 'mep-boiler',
  'mep-water-heater', 'furniture', 'floorplan-symbol', 'mep-segment', 'xline',
  'ray', 'polyline', 'circle', 'arc', 'line', 'group', 'annotation-symbol', 'text',
] as const satisfies readonly (keyof GripKindByEntity)[];
