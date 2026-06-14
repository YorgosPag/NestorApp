/**
 * ADR-456 Slice 3 — 3Δ/τομή οπλισμός κολώνας (rebar cage): layout → THREE.Group.
 *
 * Διαμήκεις ράβδες = κατακόρυφοι **κύλινδροι** σε όλο το ύψος, στις θέσεις της
 * κάτοψης (ακτίνα = Ø_διαμήκους/2)· στεφάνια = οριζόντια δαχτυλίδια ανά στάθμη που
 * διατρέχουν την κλειστή polyline **στρογγυλεμένων γωνιών** (`stirrupPathMm`, EC2
 * ακτίνα κάμψης) ως αλυσίδα **κυλίνδρων** (ακτίνα = Ø_συνδετήρα/2). Έτσι οι δύο
 * διατομές έχουν **διαφορετικό πάχος** όπως στο 2Δ (το παλιό LineSegments έδινε
 * ομοιόμορφο 1px — το WebGL αγνοεί το `linewidth`). Reuse:
 *   - `computeColumnRebarLayout` / `computeStirrupLevelsMm` — geometry SSoT (ΙΔΙΕΣ
 *     θέσεις με το 2Δ),
 *   - `columnLocalMmToWorld` — ο ΙΔΙΟΣ local→world transform με το footprint.
 *
 * Σύμβαση αξόνων (ίδια με τον πυρήνα + τον σοβά): plan (sx, sy) → three.js
 * (sx, y, −sy)· κατακόρυφα σε meters με βάση `baseY` (datum του πυρήνα).
 *
 * Περφόρμανς: **InstancedMesh** ανά κατηγορία (1 draw call για όλες τις ράβδες +
 * 1 για όλες τις πλευρές στεφανιών) — χτίζεται σε scene-build time, ΟΧΙ per-frame.
 * Πεδίο: ορθογωνική κολώνα με ορισμένο `reinforcement`.
 *
 * @see ../../bim/structural/reinforcement/column-rebar-layout.ts
 * @see docs/centralized-systems/reference/adrs/ADR-456-structural-quantities-reinforcement.md
 */

import * as THREE from 'three';
import type { ColumnEntity } from '../../bim/types/column-types';
import { columnLocalMmToWorld } from '../../bim/geometry/column-geometry';
import { mmToSceneUnits } from '../../utils/scene-units';
import {
  computeColumnRebarLayout,
  computeStirrupLevelsMm,
} from '../../bim/structural/reinforcement/column-rebar-layout';
import { DEFAULT_STIRRUP_TYPE } from '../../bim/structural/reinforcement/column-reinforcement-types';
import type { Point2D } from '../../rendering/types/Types';

const MM_TO_M = 0.001;
/** Χρώμα οπλισμού (crimson — αντίθεση με το δομικό μπλε, ίδιο με το 2Δ). */
const REBAR_COLOR = 0xc0392b;
/**
 * ΚΟΙΝΟ άφωτο υλικό (module singleton). `MeshBasicMaterial` (ΟΧΙ Standard):
 * α) δεν εξαρτάται από φώτα/envmap/SSAO → ζωγραφίζεται **αξιόπιστα στο πρώτο frame**
 *    (το Standard ήθελε async shader compile → ο κλωβός «δεν ξεσκάλωνε» στο μπες-στο-3Δ
 *    μέχρι ένα 2ο frame από slider/toggle)· β) compiled μία φορά, reused σε όλες τις
 *    κολώνες (μηδέν per-column shader). Mirror του παλιού working `LineBasicMaterial`.
 */
const REBAR_MATERIAL = new THREE.MeshBasicMaterial({ color: REBAR_COLOR });
/** Πλευρές κυλίνδρου ράβδου (χαμηλό — λεπτή ράβδος, ελάχιστο geometry). */
const ROD_RADIAL_SEGMENTS = 6;
/** Ελάχιστη ακτίνα (scene units) ώστε εκφυλισμένο Ø να μη δίνει μηδενικό geometry. */
const MIN_RADIUS = 1e-4;

interface Seg { a: THREE.Vector3; b: THREE.Vector3 }

const UP = new THREE.Vector3(0, 1, 0);

/**
 * InstancedMesh από unit κύλινδρο (ύψος 1, άξονας +Y), τοποθετημένος ανά segment:
 * κάθε instance = translate στο μέσο + rotate (Y→διεύθυνση) + scale.y = μήκος. Για
 * κατακόρυφες ράβδες η διεύθυνση είναι +Y (μηδέν rotation).
 */
function buildRods(
  segments: readonly Seg[],
  radius: number,
  material: THREE.Material,
): THREE.InstancedMesh | null {
  if (segments.length === 0 || radius <= 0) return null;
  const geo = new THREE.CylinderGeometry(radius, radius, 1, ROD_RADIAL_SEGMENTS);
  const mesh = new THREE.InstancedMesh(geo, material, segments.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const dir = new THREE.Vector3();
  for (let i = 0; i < segments.length; i++) {
    const { a, b } = segments[i];
    const len = a.distanceTo(b);
    pos.addVectors(a, b).multiplyScalar(0.5);
    dir.subVectors(b, a);
    if (len > 1e-9) dir.divideScalar(len);
    q.setFromUnitVectors(UP, len > 1e-9 ? dir : UP);
    scl.set(1, Math.max(len, 1e-6), 1);
    m.compose(pos, q, scl);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  // ΚΡΙΣΙΜΟ: το bounding sphere του InstancedMesh βγαίνει από το unit geometry στο
  // origin (ΟΧΙ από τα instance matrices) → το frustum culling έκοβε όλο τον κλωβό
  // όταν η κολώνα ήταν μακριά από το origin (φαινόταν «μόνο μετά τον slider τομής»).
  // Ο κλωβός είναι μικρός/φθηνός → απενεργοποιούμε το culling (όπως πρακτικά τα LineSegments).
  mesh.frustumCulled = false;
  return mesh;
}

/** plan point (scene units) → three.js διάνυσμα σε στάθμη y (AXIS_FLIP: Z = −sy). */
function toThree(p: Point2D, y: number): THREE.Vector3 {
  return new THREE.Vector3(p.x, y, -p.y);
}

/** Κλειστά δαχτυλίδια ανά στάθμη — διατρέχουν την κλειστή (στρογγυλεμένων γωνιών)
 *  polyline ως κύλινδρους segment-προς-segment· hooked & welded. */
function ringSegments(ringXY: readonly Point2D[], levels: readonly number[], baseY: number): Seg[] {
  const segs: Seg[] = [];
  for (const zMm of levels) {
    const y = baseY + zMm * MM_TO_M;
    for (let i = 0; i < ringXY.length; i++) {
      segs.push({ a: toThree(ringXY[i], y), b: toThree(ringXY[(i + 1) % ringXY.length], y) });
    }
  }
  return segs;
}

/**
 * Τα δύο άκρα γάντζου 135° (precomputed SSoT πολυγραμμές: τόξο κάμψης + ουρά) σε
 * κάθε στάθμη — μόνο `closed-hooked`. Κάθε άκρο = αλυσίδα κυλίνδρων segment-προς-segment.
 */
function hookSegments(
  hookEndsXY: readonly (readonly Point2D[])[],
  levels: readonly number[],
  baseY: number,
): Seg[] {
  const segs: Seg[] = [];
  for (const end of hookEndsXY) {
    if (end.length < 2) continue;
    for (const zMm of levels) {
      const y = baseY + zMm * MM_TO_M;
      for (let i = 1; i < end.length; i++) {
        segs.push({ a: toThree(end[i - 1], y), b: toThree(end[i], y) });
      }
    }
  }
  return segs;
}

/**
 * Σπειροειδής (θώρακας): ΜΙΑ συνεχής ανερχόμενη έλικα — εντός κάθε στροφής
 * (κενό σταθμών) διατρέχει τις 4 γωνίες ανεβαίνοντας ομαλά κατά το βήμα.
 */
function spiralSegments(ringXY: readonly Point2D[], levels: readonly number[], baseY: number): Seg[] {
  if (ringXY.length < 3 || levels.length < 2) return [];
  const n = ringXY.length;
  const pts: THREE.Vector3[] = [];
  for (let L = 0; L < levels.length - 1; L++) {
    const z0 = levels[L];
    const z1 = levels[L + 1];
    for (let c = 0; c < n; c++) {
      const zMm = z0 + (z1 - z0) * (c / n);
      pts.push(toThree(ringXY[c], baseY + zMm * MM_TO_M));
    }
  }
  // Κλείσιμο στην τελευταία γωνία στην κορυφή.
  pts.push(toThree(ringXY[0], baseY + levels[levels.length - 1] * MM_TO_M));
  const segs: Seg[] = [];
  for (let i = 1; i < pts.length; i++) segs.push({ a: pts[i - 1], b: pts[i] });
  return segs;
}

/**
 * Χτίζει τον κλωβό οπλισμού (διαμήκεις + στεφάνια) μιας ορθογωνικής κολώνας ως
 * `THREE.Group`, ή `null` αν δεν είναι ορθογωνική / δεν έχει οπλισμό / εκφυλισμένο
 * ύψος. `baseY` = κατακόρυφη βάση του πυρήνα (ίδιο datum → ευθυγράμμιση).
 * `heightMm` = effective ύψος κολώνας (ίδιο με τον σοβά).
 */
export function buildColumnRebarCage(
  column: ColumnEntity,
  baseY: number,
  heightMm: number,
  levelId?: string,
): THREE.Group | null {
  const p = column.params;
  if (p.kind !== 'rectangular') return null;
  const r = p.reinforcement;
  if (!r) return null;
  const heightM = Math.max(0, heightMm) * MM_TO_M;
  if (heightM <= 0) return null;
  const layout = computeColumnRebarLayout(r, p.width, p.depth);
  if (!layout) return null;

  const s = mmToSceneUnits(p.sceneUnits ?? 'mm');
  const barRadius = Math.max(MIN_RADIUS, (layout.barDiameterMm / 2) * s);
  const stirrupRadius = Math.max(MIN_RADIUS, (layout.stirrupDiameterMm / 2) * s);

  const group = new THREE.Group();
  const material = REBAR_MATERIAL; // ΚΟΙΝΟ άφωτο υλικό (βλ. σχόλιο ορισμού)

  // ── Διαμήκεις ράβδες: κατακόρυφοι κύλινδροι baseY → baseY + heightM ──
  const barsXY = columnLocalMmToWorld(p, layout.longitudinalBarsMm);
  const barSegs = barsXY.map((b) => ({
    a: new THREE.Vector3(b.x, baseY, -b.y),
    b: new THREE.Vector3(b.x, baseY + heightM, -b.y),
  }));
  const bars = buildRods(barSegs, barRadius, material);
  if (bars) group.add(bars);

  // ── Στεφάνια ανά τύπο ──
  // `pathXY` = κλειστή tessellated polyline με στρογγυλεμένες γωνίες (ΙΔΙΟ
  // `stirrupPathMm` με το 2Δ → SSoT· cylinder segments διατρέχουν το τόξο →
  // Revit-grade καμπύλη γωνία, ίδιος προϋπάρχων InstancedMesh αγωγός/υλικό).
  const type = r.stirrups.type ?? DEFAULT_STIRRUP_TYPE;
  const levels = computeStirrupLevelsMm(r, p.width, p.depth, heightMm);
  const pathXY = columnLocalMmToWorld(p, layout.stirrupPathMm);
  const stirrupSegs: Seg[] =
    type === 'spiral'
      ? spiralSegments(pathXY, levels, baseY)
      : ringSegments(pathXY, levels, baseY);
  if (type === 'closed-hooked') {
    // Δύο άκρα γάντζου 135° (precomputed SSoT· τόξο κάμψης + ουρά) → world ανά άκρο.
    const hookEndsXY = layout.stirrupHookEndsMm.map((end) => columnLocalMmToWorld(p, end));
    stirrupSegs.push(...hookSegments(hookEndsXY, levels, baseY));
  }
  const stirrups = buildRods(stirrupSegs, stirrupRadius, material);
  if (stirrups) group.add(stirrups);

  if (group.children.length === 0) return null;
  group.userData['bimId'] = column.id;
  group.userData['bimType'] = 'column';
  group.userData['reinforcement'] = true;
  if (levelId !== undefined) group.userData['levelId'] = levelId;
  return group;
}
