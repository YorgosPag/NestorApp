/**
 * bim-three-structural-converters — column / beam / slab → THREE.Mesh.
 *
 * Extracted from BimToThreeConverter.ts (Google file-size SSoT, N.7.1).
 * Covers the load-bearing structural element family:
 *   - Column (ADR-401 Phase F.2 — flat + attached prism)
 *   - Beam  (ADR-363 Φ2 — rectangular box + swept I/H section)
 *   - Slab  (ADR-416 — single extrude + multi-layer composite)
 *
 * Coordinate convention + scaling identical to BimToThreeConverter (see header there).
 */

import * as THREE from 'three';
import type { ColumnEntity } from '../../bim/types/column-types';
import type { WallEntity } from '../../bim/types/wall-types';
import type { BeamEntity } from '../../bim/types/beam-types';
import type { Point3D } from '../../bim/types/bim-base';
import { getElementMaterial3D } from '../materials/MaterialCatalog3D';
import { buildShape, extrudeAndRotate, extrudeShapesAndRotate, tagMesh, hangDownMeshY } from './bim-three-shape-helpers';
import { scalePoints } from '../../rendering/entities/shared/geometry-vector-utils';
import { computeBeamCutbackOutline, extendBeamOutlineIntoFramingColumns } from '../../bim/geometry/beam-column-cutback';
import { ensureWorldUvs } from './bim-uv-helpers';
import { applyBeamSlope, applyColumnTilt } from './mesh-slope-shear';
import { buildColumnPrismGeometry } from './column-piece-geometry';
import { buildSweptIBeamGeometry } from './beam-ishape-geometry';
import { attachEdgesProjection } from './bim-three-edges';
import { buildColumnFinishSkin, buildBeamFinishSkin } from './structural-finish-3d';
// ADR-470 — per-component visibility resolver SSoT (σώμα/σοβάς/οπλισμός· per-element + per-view).
import { isStructuralComponentVisible } from '../../bim/visibility/structural-component-visibility';
import { applyStructuralCoreVisibility3D } from './structural-core-visibility-3d';
// ADR-456 Slice 3 — 3Δ/τομή κλωβός οπλισμού (κοινό geometry SSoT με το 2Δ).
import { buildColumnRebarCage } from './column-rebar-3d';
// ADR-471 Slice 3 — 3Δ κλωβός οπλισμού δοκού (longitudinal· κοινό geometry SSoT με το 2Δ).
import { buildBeamRebarCage } from './beam-rebar-3d';
import { isWallColumnKind } from '../../bim/columns/column-from-faces';
import type { ColumnTopProfile, ColumnBaseProfile } from '../../bim/geometry/column-vertical-profile';
import { sceneUnitsToMeters } from '../../utils/scene-units';
// ADR-539 Φ3a — Cinema 4D «Polygon Mode» per-face appearance (faced multi-material prism).
import { buildFacedSolidBody } from './bim-three-faced-prism';
import { usePolygonMode3DStore } from '../stores/PolygonMode3DStore';

const MM_TO_M = 0.001;

// ADR-462 canonical-mm — plan vertices (footprint/outline) are CANVAS UNITS (mm under
// canonical-mm), NOT meters. Convert plan XY → Three.js world metres with `× sceneToM`
// where `sceneToM = sceneUnitsToMeters(params.sceneUnits ?? 'mm')`. Vertical scalars (mm)
// keep `× MM_TO_M`. Invariant: `mmToSceneUnits(u) × sceneUnitsToMeters(u) = MM_TO_M`.

// ── Column ────────────────────────────────────────────────────────────────────

/**
 * ADR-539 Φ3a — column core body: faced multi-material prism (per-face paint) when the
 * column already carries a `faceAppearance` OR is the live Polygon-Mode target (so its
 * faces become pickable even before any paint — chicken-and-egg), else the legacy
 * single-material extrude (byte-for-byte, zero regression). Η κολώνα = ΚΑΤΑΚΟΡΥΦΟ prism →
 * IDENTICAL local span [0, heightM] με το `extrudeAndRotate`, άρα ο caller κρατά την ΙΔΙΑ
 * `position.y`. Το tilt (ADR-404) εφαρμόζεται και στα δύο geometries (ίδιο local Y span →
 * ίδιο shear). Delegate στο shared `buildFacedSolidBody` SSoT (μηδέν copy-paste ανά kind).
 */
function buildColumnCoreBody(
  column: ColumnEntity,
  flatColumn: ColumnEntity,
  shape: THREE.Shape,
  verts: readonly Point3D[],
  heightM: number,
): THREE.Mesh | null {
  const fa = column.faceAppearance;
  const poly = usePolygonMode3DStore.getState();
  const facedByAppearance = fa !== undefined && Object.keys(fa).length > 0;
  const facedByPolygonTarget = poly.active && poly.targetBimId === column.id;
  if (facedByAppearance || facedByPolygonTarget) {
    const mesh = buildFacedSolidBody(verts, heightM, fa ?? {}, getElementMaterial3D('column'));
    // ADR-404 — raking column shear εφαρμόζεται και στο faced geometry (ίδιο local Y span). No-op flat.
    if (mesh) applyColumnTilt(mesh.geometry, flatColumn.params);
    return mesh;
  }
  const geo = extrudeAndRotate(shape, heightM);
  ensureWorldUvs(geo); // ADR-413 — aoMap uv2 (ExtrudeGeometry auto-UVs in meters).
  applyColumnTilt(geo, flatColumn.params); // ADR-404 — raking column shear. No-op flat.
  return new THREE.Mesh(geo, getElementMaterial3D('column'));
}

export function columnToMesh(
  column: ColumnEntity,
  floorElevationMm = 0,
  levelId?: string,
  buildingBaseElevationM = 0,
  topProfile?: ColumnTopProfile,
  baseProfile?: ColumnBaseProfile,
  nominalHeightMm?: number,
  walls: readonly WallEntity[] = [],
  beams: readonly BeamEntity[] = [], // ADR-449 Slice 6 — mutual obstacles (junction)
  // ADR-449 Slice 7 — ο scene-level ενιαίος σοβάς (silhouette) αναλαμβάνει το skin·
  // το per-element path το παραλείπει (ghosts/previews κρατούν per-element = false).
  suppressFinishSkin = false,
  // ADR-488 §6.1 — DERIVED effective βάση (απόλυτο mm = άνω παρειά στηρίζοντος πεδίλου).
  // Όταν δοθεί & είναι ΧΑΜΗΛΟΤΕΡΗ από τη nominal βάση, η κολώνα επιμηκύνεται ΠΡΟΣ ΤΑ ΚΑΤΩ
  // ώστε να εδραστεί στο πέδιλο (στατική συνέχεια)· η ΚΟΡΥΦΗ μένει σταθερή. Μόνο flat path.
  effectiveBaseZmm?: number,
  // ADR-534 §monolithic-cut — DERIVED effective render-top (absolute mm) όταν η κορυφή της κολόνας
  // καλύπτεται από πλάκα οροφής: το ορατό στερεό κόβεται στο soffit της (μηδέν z-fighting). `undefined`/
  // ≥top → καμία αλλαγή. Συνδυάζεται (min) με το υπάρχον `topProfile` (η πλάκα κόβει χαμηλότερα).
  clipTopZmm?: number,
): THREE.Mesh | THREE.Group | null {
  const rawVerts = column.geometry.footprint.vertices;
  if (rawVerts.length < 3) return null;
  // ADR-462 — footprint XY (canvas units) → world metres.
  const sceneToM = sceneUnitsToMeters(column.params.sceneUnits ?? 'mm');
  const verts = scalePoints(rawVerts, sceneToM);

  // ADR-448 Phase 1b — storey-ceiling column renders to the real ceiling height
  // (Revit «Top: Up to Level»). Only the flat (non-attached) path; the attached
  // prism above already resolves its top via `topProfile`. No-op without context.
  const flatColumn = (nominalHeightMm !== undefined && Math.abs(nominalHeightMm - column.params.height) > 1e-6)
    ? { ...column, params: { ...column.params, height: nominalHeightMm } }
    : column;

  const matId = column.params.material ?? 'elem-column';

  // ADR-401 Phase F.2 — attached κολώνα (κορυφή Ή/ΚΑΙ βάση): per-corner prism που
  // σταματά στην παρειά κάθε host (στρεβλή/κεκλιμένη κορυφή & βάση). Ενεργό ΜΟΝΟ
  // όταν τουλάχιστον μία γωνία πήρε top/base από host (`hasAttach`)· αλλιώς πέφτει
  // στο ίσιο extrude fast-path παρακάτω (μηδέν regression — μη-attached κολώνα).
  if (topProfile?.hasAttach || baseProfile?.hasAttach) {
    // ADR-534 §monolithic-cut — η καλύπτουσα πλάκα κόβει την κορυφή χαμηλότερα από το beam-attach top.
    const clippedTopProfile = (clipTopZmm !== undefined && topProfile)
      ? { ...topProfile, cornerTopZmm: topProfile.cornerTopZmm.map((z) => Math.min(z, clipTopZmm)) }
      : topProfile;
    const prism = buildAttachedColumnPrism(verts, floorElevationMm, clippedTopProfile, baseProfile);
    if (prism) {
      ensureWorldUvs(prism); // ADR-413 — custom prism has no uv → planar world UVs.
      // ADR-404 — raking column στον attached prism path: το prism ζει σε floor-local
      // Y με βάση στο FFL → baseHeightM=0 (ίδιο datum με τον flat path & το 2Δ). No-op flat.
      applyColumnTilt(prism, column.params);
      const mesh = new THREE.Mesh(prism, getElementMaterial3D('column'));
      mesh.position.y = floorElevationMm * MM_TO_M + buildingBaseElevationM;
      const tagged = tagMesh(mesh, column.id, 'column', matId, levelId);
      attachEdgesProjection(tagged, 'column', isWallColumnKind(column.kind) ? 'shear-wall' : undefined);
      // ADR-449 Slice 6 fix — η attached κολώνα έπαιρνε ΜΟΝΟ πυρήνα (ο σοβάς ήταν flat-only,
      // DEFER Slice 2) → μόλις τα δοκάρια auto-attach-άρανε τις κολόνες, ο σοβάς εξαφανιζόταν.
      // Ύψος σοβά = το χαμηλότερο attached top (flat-top approx· per-corner sloped finish = DEFER).
      const attachedTopMm = clippedTopProfile?.cornerTopZmm?.length
        ? Math.min(...clippedTopProfile.cornerTopZmm)
        : floorElevationMm + flatColumn.params.height;
      // ADR-470 — core gate: κρύβει το σώμα της attached κολώνας αν ανενεργό
      // (σοβάς/οπλισμός μένουν ορατά).
      return applyStructuralCoreVisibility3D(
        attachColumnRebar(
          composeColumnWithFinish(
            tagged, column, walls, beams, mesh.position.y, levelId, Math.max(0, attachedTopMm - floorElevationMm),
            suppressFinishSkin,
          ),
          column, mesh.position.y, Math.max(0, attachedTopMm - floorElevationMm), levelId,
        ),
        tagged, column,
      );
    }
    // Fall through to flat solid αν το prism εκφυλίζεται (defensive).
  }

  const shape = buildShape(verts);
  if (!shape) return null;

  // ADR-488 §6.1 — στατική συνέχεια κολώνα→πέδιλο: όταν δόθηκε DERIVED effective βάση
  // χαμηλότερα από τη nominal, η κολώνα επιμηκύνεται ΠΡΟΣ ΤΑ ΚΑΤΩ ώστε να εδραστεί στην
  // άνω παρειά του πεδίλου — η ΚΟΡΥΦΗ μένει σταθερή. `baseDropMm=0` → byte-for-byte παλιό.
  const nominalBaseAbsMm = floorElevationMm + column.params.baseOffset;
  const baseDropMm = effectiveBaseZmm !== undefined ? Math.max(0, nominalBaseAbsMm - effectiveBaseZmm) : 0;
  const nominalHeightWithDropMm = flatColumn.params.height + baseDropMm;
  // ADR-534 §monolithic-cut — κόψε το ορατό ύψος ώστε η κορυφή να φτάνει στο soffit της καλύπτουσας πλάκας
  // (η βάση μένει σταθερή). `undefined`/≥top → nominal (byte-for-byte). Finish/rebar ακολουθούν.
  const baseAbsMm = nominalBaseAbsMm - baseDropMm;
  const effectiveHeightMm = clipTopZmm !== undefined
    ? Math.max(0, Math.min(nominalHeightWithDropMm, clipTopZmm - baseAbsMm))
    : nominalHeightWithDropMm;

  // ADR-539 Φ3a — faced (per-face paint) core when painted/targeted, else legacy extrude
  // (ADR-413 UVs + ADR-404 tilt baked inside the helper). Same [0, height] span → same position.y.
  const mesh = buildColumnCoreBody(column, flatColumn, shape, verts, effectiveHeightMm * MM_TO_M);
  if (!mesh) return null;
  // ADR-402 — `baseOffset` lifts the whole column (vertical move). ONLY on this flat
  // path: the attached-prism path bakes baseOffset into its profile z. baseOffset=0 → no change.
  // ADR-488 §6.1 — −baseDropMm κατεβάζει τη βάση στο πέδιλο (κορυφή αμετάβλητη).
  mesh.position.y = (nominalBaseAbsMm - baseDropMm) * MM_TO_M + buildingBaseElevationM;
  const tagged = tagMesh(mesh, column.id, 'column', matId, levelId);
  attachEdgesProjection(tagged, 'column');

  // ADR-449 Slice 2 — additive σοβάς (per-face band skin) ΕΞΩ από τον στατικό πυρήνα.
  // Ενεργό μόνο όταν η κολόνα έχει ενεργό `finish` ΚΑΙ δόθηκαν walls (απών στο ghost
  // path → πυρήνας-only). ADR-449 Slice 5 — view-level gate `showFinishSkin`.
  // ADR-470 — core gate: κρύβει το σώμα της κολώνας αν ανενεργό (σοβάς/οπλισμός μένουν).
  // ADR-488 §6.1 — σοβάς/οπλισμός παίρνουν το επιμηκυμένο ύψος ώστε να φτάνουν στο πέδιλο.
  return applyStructuralCoreVisibility3D(
    attachColumnRebar(
      composeColumnWithFinish(
        tagged, column, walls, beams, mesh.position.y, levelId, effectiveHeightMm, suppressFinishSkin,
      ),
      column, mesh.position.y, effectiveHeightMm, levelId,
    ),
    tagged, column,
  );
}

/**
 * ADR-449 — συνθέτει τον πυρήνα κολόνας με τον additive σοβά (band skin) σε ΕΝΑ
 * composite Group, ή επιστρέφει σκέτο τον πυρήνα όταν ο σοβάς είναι ανενεργός / κρυμμένος
 * (view gate) / δεν προκύπτει band. Κοινό SSoT για flat ΚΑΙ attached path (Slice 6 fix:
 * ο σοβάς έλειπε από το attached path). `skinHeightMm` = effective ύψος κολόνας για τον σοβά.
 */
function composeColumnWithFinish(
  core: THREE.Mesh,
  column: ColumnEntity,
  walls: readonly WallEntity[],
  beams: readonly BeamEntity[],
  baseY: number,
  levelId: string | undefined,
  skinHeightMm: number,
  suppressFinishSkin = false,
): THREE.Mesh | THREE.Group {
  // ADR-470 — per-element σοβάς override → per-view flag (Revit precedence).
  if (suppressFinishSkin || !isStructuralComponentVisible('plaster', column)) return core;
  const colForSkin = Math.abs(skinHeightMm - column.params.height) > 1e-6
    ? { ...column, params: { ...column.params, height: skinHeightMm } }
    : column;
  const finishSkin = buildColumnFinishSkin(colForSkin, walls, beams, baseY, levelId);
  if (!finishSkin) return core;
  const composite = new THREE.Group();
  composite.add(core);
  composite.add(finishSkin);
  composite.userData['bimId'] = column.id;
  composite.userData['bimType'] = 'column';
  return composite;
}

/**
 * ADR-456 Slice 3 — προσθέτει τον κλωβό οπλισμού (διαμήκεις + στεφάνια) στο ήδη
 * συντεθειμένο column result (πυρήνας ή πυρήνας+σοβάς). Επιστρέφει το ίδιο αντικείμενο
 * όταν ο οπλισμός είναι ανενεργός (view gate / μη-ορθογωνική / χωρίς `reinforcement`).
 * `heightMm`/`baseY` = ίδια με τον σοβά → ευθυγράμμιση. Αν το input είναι σκέτο mesh,
 * το τυλίγει σε Group ώστε να κρατήσει το composite tag.
 *
 * ΣΗΜ.: ο οπλισμός είναι **ΑΝΕΞΑΡΤΗΤΟΣ** από το `suppressFinishSkin` — το scene path
 * το θέτει true (ο ΕΝΙΑΙΟΣ silhouette σοβάς αναλαμβάνει το σκιν, ADR-449 Slice X1),
 * αλλά αυτό ΔΕΝ αφορά τον οπλισμό. Gate μόνο στον δικό του διακόπτη `showReinforcement`.
 */
function attachColumnRebar(
  composed: THREE.Mesh | THREE.Group,
  column: ColumnEntity,
  baseY: number,
  heightMm: number,
  levelId: string | undefined,
): THREE.Mesh | THREE.Group {
  // ADR-470 — per-element οπλισμός override → per-view flag (Revit precedence).
  if (!isStructuralComponentVisible('reinforcement', column)) return composed;
  const cage = buildColumnRebarCage(column, baseY, heightMm, levelId);
  if (!cage) return composed;
  if (composed instanceof THREE.Group) {
    composed.add(cage);
    return composed;
  }
  const group = new THREE.Group();
  group.add(composed);
  group.add(cage);
  group.userData['bimId'] = column.id;
  group.userData['bimType'] = 'column';
  return group;
}

/**
 * ADR-401 Phase F.2 — μετατρέπει τα per-corner απόλυτα-mm προφίλ της attached
 * κολώνας σε floor-local μέτρα και χτίζει το prism. Top corners από το
 * `topProfile` (ή flat top σε `maxTopZmm` αν λείπει)· base corners από το
 * `baseProfile` (ή flat base σε `nominalBaseZmm`/`baseZmm`). `localZ = (zmm −
 * FFL_mm) · MM_TO_M` (ίδια σύμβαση με `makeWallTopLocalFn`).
 */
function buildAttachedColumnPrism(
  footprint: readonly Point3D[],
  floorElevationMm: number,
  topProfile?: ColumnTopProfile,
  baseProfile?: ColumnBaseProfile,
): THREE.BufferGeometry | null {
  const n = footprint.length;
  const toLocal = (zmm: number): number => (zmm - floorElevationMm) * MM_TO_M;
  // Top: per-corner profile, ή flat στο nominal (maxTopZmm == minTopZmm σε flat top).
  const topZmm = topProfile?.cornerTopZmm ?? new Array<number>(n).fill(baseProfile ? baseProfile.maxBaseZmm : 0);
  // Base: per-corner profile, ή flat στο nominal base (από όποιο προφίλ υπάρχει).
  const nominalBaseZmm = baseProfile?.nominalBaseZmm ?? topProfile?.baseZmm ?? 0;
  const baseZmm = baseProfile?.cornerBaseZmm ?? new Array<number>(n).fill(nominalBaseZmm);
  if (topZmm.length !== n || baseZmm.length !== n) return null;

  const cornerTopLocalM = topZmm.map(toLocal);
  const cornerBaseLocalM = baseZmm.map(toLocal);
  return buildColumnPrismGeometry(
    footprint.map((p) => ({ x: p.x, y: p.y })),
    cornerBaseLocalM,
    cornerTopLocalM,
  );
}

/**
 * ADR-534 Φ3c-B3a — απόλυτο **top-clip Y** (world m) του κλωβού οπλισμού δοκού από το ίδιο
 * `clipTopZmm` (absolute mm) που κόβει το ορατό στερεό (`beamToMesh`). Datum-mapping: η κάτω
 * παρειά (`bottomFaceY`, world m) αντιστοιχεί στο `beamBottomAbsMm` → απόλυτο mm → world m με
 * `MM_TO_M`. `undefined` όταν δεν υπάρχει κάλυψη ή το clip είναι ≥ κορυφής (μηδέν regression).
 */
function beamRebarTopClipY(
  beam: BeamEntity,
  bottomFaceY: number,
  clipTopZmm?: number,
): number | undefined {
  const beamTopAbsMm = beam.params.topElevation + (beam.params.zOffset ?? 0);
  if (clipTopZmm === undefined || clipTopZmm >= beamTopAbsMm) return undefined;
  const beamBottomAbsMm = beamTopAbsMm - beam.params.depth;
  return bottomFaceY + (clipTopZmm - beamBottomAbsMm) * MM_TO_M;
}

/**
 * ADR-471 Slice 3 — προσθέτει τον κλωβό οπλισμού (διαμήκεις + συνδετήρες) στο ήδη
 * συντεθειμένο beam result (πυρήνας ή πυρήνας+σοβάς). Mirror του `attachColumnRebar`:
 * επιστρέφει το ίδιο αντικείμενο όταν ο οπλισμός είναι ανενεργός (view gate / χωρίς
 * `reinforcement`). `bottomFaceY` = κάτω παρειά πυρήνα (ίδιο datum → ευθυγράμμιση).
 * Gate μόνο στον δικό του διακόπτη `showReinforcement` — ΑΝΕΞΑΡΤΗΤΟΣ από `suppressFinishSkin`.
 */
function attachBeamRebar(
  composed: THREE.Mesh | THREE.Group,
  beam: BeamEntity,
  bottomFaceY: number,
  levelId: string | undefined,
  clipTopZmm?: number,
): THREE.Mesh | THREE.Group {
  // ADR-470 — per-element οπλισμός override → per-view flag (Revit precedence).
  if (!isStructuralComponentVisible('reinforcement', beam)) return composed;
  const cage = buildBeamRebarCage(beam, bottomFaceY, levelId, beamRebarTopClipY(beam, bottomFaceY, clipTopZmm));
  if (!cage) return composed;
  if (composed instanceof THREE.Group) {
    composed.add(cage);
    return composed;
  }
  const group = new THREE.Group();
  group.add(composed);
  group.add(cage);
  group.userData['bimId'] = beam.id;
  group.userData['bimType'] = 'beam';
  return group;
}

// ── Beam ──────────────────────────────────────────────────────────────────────

/**
 * ADR-493 — carve-outline 3Δ (parity με 2Δ `buildBeamCutbackDisplay`): επεκτείνει το
 * πλαισιωμένο άκρο ευθύγραμμου δοκαριού ώστε το επόμενο cutback να σκαλίσει την ακριβή
 * υποχωρούσα παρειά (κυκλική/λοξή). Καμπύλο/εκφυλισμένο → outline αυτούσιο (μηδέν regression).
 * Ο άξονας (startPoint/endPoint) κλιμακώνεται με το ΙΔΙΟ `sceneToM` (κοινός χώρος μέτρων).
 */
function buildBeam3DCarveOutline(
  beam: BeamEntity,
  verts: readonly Point3D[],
  hostFootprints: readonly (readonly { x: number; y: number }[])[],
  sceneToM: number,
): { x: number; y: number }[] {
  const flat = verts.map((v) => ({ x: v.x, y: v.y }));
  if (beam.params.kind === 'curved') return flat;
  const ext = extendBeamOutlineIntoFramingColumns(
    flat,
    { x: beam.params.startPoint.x * sceneToM, y: beam.params.startPoint.y * sceneToM },
    { x: beam.params.endPoint.x * sceneToM, y: beam.params.endPoint.y * sceneToM },
    hostFootprints,
  );
  return ext ?? flat;
}

export function beamToMesh(
  beam: BeamEntity,
  levelId?: string,
  buildingBaseElevationM = 0,
  walls: readonly WallEntity[] = [],
  columns: readonly ColumnEntity[] = [], // ADR-449 Slice 6 — mutual obstacles (junction)
  // ADR-449 Slice 7 — ο scene-level ενιαίος σοβάς (silhouette) αναλαμβάνει το skin·
  // το per-element path το παραλείπει (ghosts/previews κρατούν per-element = false).
  suppressFinishSkin = false,
  floorElevationMm = 0, // ADR-449 Slice 8 — height-aware wall coverage (FFL anchor)
  // ADR-534 §monolithic-cut — DERIVED effective render-top (absolute mm) όταν η κορυφή του δοκαριού
  // καλύπτεται από πλάκα οροφής: το ορατό στερεό κόβεται στο soffit της πλάκας (μηδέν z-fighting). Η κάτω
  // παρειά (downstand) μένει αγκυρωμένη· `undefined`/≥top → full depth (byte-for-byte). RC box-path μόνο.
  clipTopZmm?: number,
): THREE.Mesh | THREE.Group | null {
  const beamDepthM = beam.params.depth * MM_TO_M;
  // ADR-534 §monolithic-cut — ύψος ορατού πυρήνα: κομμένο στο soffit πλάκας (clamped ≥ 0).
  const beamTopAbsMm = beam.params.topElevation + (beam.params.zOffset ?? 0);
  const beamBottomAbsMm = beamTopAbsMm - beam.params.depth;
  const renderTopMm = clipTopZmm !== undefined
    ? Math.max(beamBottomAbsMm, Math.min(clipTopZmm, beamTopAbsMm))
    : beamTopAbsMm;
  const renderHeightM = (renderTopMm - beamBottomAbsMm) * MM_TO_M; // == beamDepthM αν δεν κόβεται
  // ADR-462 — outline + cutback host footprints (canvas units) → world metres.
  const sceneToM = sceneUnitsToMeters(beam.params.sceneUnits ?? 'mm');

  // ADR-363 Φ2 — μεταλλικό δοκάρι Ι/H: πραγματική διατομή σαρωμένη κατά τον άξονα
  // (όχι κουτί). Curved/degenerate → null ⇒ fallback στο ίσιο box extrude παρακάτω.
  let geo: THREE.BufferGeometry | null =
    beam.params.sectionKind === 'I-shape' ? buildSweptIBeamGeometry(beam) : null;

  if (!geo) {
    const rawVerts = beam.geometry.outline.vertices;
    if (rawVerts.length < 3) return null;
    const verts = scalePoints(rawVerts, sceneToM);
    // ADR-458 — beam-to-column cutback (Revit join, «η κολόνα νικάει»): κόβει τον πυρήνα
    // του δοκαριού στις παρειές των κολωνών που το τέμνουν → net volume, μηδέν εμβύθιση.
    // DERIVED (ποτέ persisted)· τα column footprints είναι ήδη rotated/composite-baked.
    // `null` → καμία τομή → ίσιο box extrude (byte-for-byte). Πολλά κομμάτια → ένα geometry.
    // ADR-462 — outline ΚΑΙ host footprints κλιμακώνονται με ΤΟ ΙΔΙΟ sceneToM (κοινός χώρος μέτρων).
    const hostFootprints = columns
      .map((c) => c.geometry?.footprint?.vertices)
      .filter((f): f is NonNullable<typeof f> => !!f && f.length >= 3)
      .map((f) => scalePoints(f, sceneToM).map((p) => ({ x: p.x, y: p.y })));
    // ADR-493 — parity με 2Δ: επέκτεινε το πλαισιωμένο άκρο ώστε το safeDifference να
    // σκαλίσει την ακριβή υποχωρούσα παρειά (κυκλική/λοξή) ΚΑΙ στο 3Δ. Straight axis μόνο.
    const carveVerts = buildBeam3DCarveOutline(beam, verts, hostFootprints, sceneToM);
    const trimmed = computeBeamCutbackOutline(carveVerts, hostFootprints);
    if (trimmed === null) {
      const shape = buildShape(verts);
      if (!shape) return null;
      geo = extrudeAndRotate(shape, renderHeightM); // ADR-534 — clip στο soffit πλάκας (no-op αν δεν κόβεται)
    } else {
      // `[]` = δοκάρι εξ ολοκλήρου μέσα στην κολόνα → δεν σχεδιάζεται.
      const shapes = trimmed
        .map((ring) => buildShape(ring.map((p) => ({ x: p.x, y: p.y, z: 0 }))))
        .filter((s): s is NonNullable<typeof s> => s !== null);
      const trimmedGeo = extrudeShapesAndRotate(shapes, renderHeightM);
      if (!trimmedGeo) return null;
      geo = trimmedGeo;
    }
  }

  ensureWorldUvs(geo); // ADR-413 — box-extrude auto-UVs OR planar for swept-I custom geo.
  applyBeamSlope(geo, beam.params);
  const matId = beam.params.material ?? 'elem-beam';
  const mesh = new THREE.Mesh(geo, getElementMaterial3D('beam'));
  // ADR-369 §2.2: topElevation = top of beam; extrusion goes from y=0 → y=depthM.
  // beam hangs DOWN from (topElevation + zOffset) by depth. ADR-448 §4.1 — the
  // beam top is FLOOR-RELATIVE, so the storey FFL (`floorElevationMm`) must be added
  // (SSoT `hangDownMeshY`, mirroring column/wall). Without it a foundation beam (FFL
  // world −1m) landed 1m too high and was clipped by the View-Range cut plane.
  const beamTopMm = beam.params.topElevation + (beam.params.zOffset ?? 0);
  mesh.position.y = hangDownMeshY(floorElevationMm, beamTopMm, beamDepthM, buildingBaseElevationM);
  const tagged = tagMesh(mesh, beam.id, 'beam', matId, levelId);
  attachEdgesProjection(tagged, 'beam');

  // ADR-449 Slice 4 — additive σοβάς (2 πλάγιες όψεις) ΕΞΩ από τον στατικό πυρήνα.
  // Ενεργό μόνο όταν το δοκάρι έχει ενεργό `finish` (απών → πυρήνας-only Mesh, μηδέν
  // regression). `baseY` = κάτω παρειά (ίδιο datum με το box extrude). Flat-path μόνο.
  // ADR-449 Slice 5 — view-level gate «Σοβατισμένη όψη» (showFinishSkin).
  // ADR-470 — per-element σοβάς override → per-view flag (Revit precedence).
  const finishSkin = (!suppressFinishSkin && isStructuralComponentVisible('plaster', beam))
    ? buildBeamFinishSkin(beam, walls, columns, mesh.position.y, levelId, floorElevationMm)
    : null;
  // ADR-471 — additive κλωβός οπλισμού (διαμήκεις + συνδετήρες) ΕΞΩ από τον πυρήνα,
  // gated από τον δικό του `showReinforcement`. `bottomFaceY = mesh.position.y` (κάτω παρειά).
  if (finishSkin) {
    const composite = new THREE.Group();
    composite.add(tagged);
    composite.add(finishSkin);
    composite.userData['bimId'] = beam.id;
    composite.userData['bimType'] = 'beam';
    // ADR-470 — core gate: κρύβει το σώμα δοκαριού αν ανενεργό (κρατά σοβά+οπλισμό).
    return applyStructuralCoreVisibility3D(
      attachBeamRebar(composite, beam, mesh.position.y, levelId, clipTopZmm), tagged, beam,
    );
  }
  // ADR-470 — core gate (χωρίς σοβά → σώμα αόρατο, ο οπλισμός μένει ορατός).
  return applyStructuralCoreVisibility3D(
    attachBeamRebar(tagged, beam, mesh.position.y, levelId, clipTopZmm), tagged, beam,
  );
}

// ── Slab ──────────────────────────────────────────────────────────────────────
// Εξήχθη στο `bim-three-slab-converter.ts` (Google file-size SSoT, N.7.1). Re-export
// για να μείνει η ενιαία είσοδος (`BimToThreeConverter` re-export) ανέγγιχτη.
export { slabToMesh } from './bim-three-slab-converter';
