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
import { sceneUnitsToMeters } from '../../utils/scene-units';
import { scalePoints } from '../../rendering/entities/shared/geometry-vector-utils';
import { computeStirrupLevelsMm } from '../../bim/structural/reinforcement/column-rebar-layout';
import {
  resolveColumnRebarLayout,
  resolveColumnCrossTies,
} from '../../bim/structural/reinforcement/column-rebar-layout-resolve';
import { resolveColumnReinforcementSection } from '../../bim/structural/reinforcement/column-section-outline';
// ADR-404 Bug A — point-shear SSoT (reuse· ΟΧΙ ξανα-υλοποίηση της σύμβασης shear).
import { applyColumnTiltToPoints } from './mesh-slope-shear';
import { resolveActiveColumnReinforcementForParams } from '../../bim/structural/active-reinforcement';
import { DEFAULT_STIRRUP_TYPE } from '../../bim/structural/reinforcement/column-reinforcement-types';
import type { Point2D } from '../../rendering/types/Types';
// ADR-463 — shared 3Δ rebar primitives (SSoT κολώνα+θεμελίωση· pure, μηδέν store import).
import { MM_TO_M, MIN_RADIUS, REBAR_MATERIAL, buildRods, toThree, type Seg } from './rebar-3d-shared';

/**
 * ADR-404 Bug A — κεκλιμένη κολώνα: shear ΟΛΩΝ των rebar segment endpoints ΙΔΙΑ με τον
 * πυρήνα/σοβά, ΠΡΙΝ το `buildRods` (ο κλωβός είναι InstancedMesh από segment endpoints —
 * δεν shear-άρεται per-vertex όπως ένα solid). Delegate στον **SSoT** `applyColumnTiltToPoints`
 * (`mesh-slope-shear`) — ΙΔΙΑ shear math (`columnTiltShearAt`) + dedup-by-reference (κοινά
 * spiral endpoints shear-άρονται μία φορά). No-op flat fast-path.
 */
function shearRebarSegsForTilt(segs: readonly Seg[], params: ColumnEntity['params'], baseY: number): void {
  applyColumnTiltToPoints(segs.flatMap((s) => [s.a, s.b]), params, baseY);
}

/** Ανοιχτή αλυσίδα (cross-tie ευθύγραμμο) ανά στάθμη — segment-προς-segment, ΧΩΡΙΣ
 *  κλείσιμο last→first (σε αντίθεση με το `ringSegments`). */
function chainSegments(chainXY: readonly Point2D[], levels: readonly number[], baseY: number): Seg[] {
  const segs: Seg[] = [];
  for (const zMm of levels) {
    const y = baseY + zMm * MM_TO_M;
    for (let i = 1; i < chainXY.length; i++) {
      segs.push({ a: toThree(chainXY[i - 1], y), b: toThree(chainXY[i], y) });
    }
  }
  return segs;
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
 * Χτίζει τον κλωβό οπλισμού (διαμήκεις + στεφάνια + boundary hoops/web ties) μιας
 * κολώνας **οποιουδήποτε σχήματος** (ADR-460, dispatcher) ως `THREE.Group`, ή `null`
 * αν δεν έχει οπλισμό / εκφυλισμένο ύψος. `baseY` = κατακόρυφη βάση του πυρήνα (ίδιο
 * datum → ευθυγράμμιση). `heightMm` = effective ύψος κολώνας (ίδιο με τον σοβά).
 */
export function buildColumnRebarCage(
  column: ColumnEntity,
  baseY: number,
  heightMm: number,
  levelId?: string,
): THREE.Group | null {
  const p = column.params;
  // ADR-456/460 (Giorgio 2026-06-16) — auto-mode ⇒ real-time re-derive από γεωμετρία· ΕΝΑ SSoT.
  const r = resolveActiveColumnReinforcementForParams(p);
  if (!r) return null;
  const heightM = Math.max(0, heightMm) * MM_TO_M;
  if (heightM <= 0) return null;
  const section = resolveColumnReinforcementSection(p);
  const layout = resolveColumnRebarLayout(r, section);
  if (!layout) return null;

  // ADR-462 — οι ράβδες/στεφάνια ζουν στον ίδιο canvas-unit χώρο με το footprint·
  // (α) ακτίνες = mm Ø → world metres με MM_TO_M· (β) θέσεις (canvas units από το
  // `columnLocalMmToWorld`) → world metres με sceneToM (helper `worldXY`).
  const sceneToM = sceneUnitsToMeters(p.sceneUnits ?? 'mm');
  const barRadius = Math.max(MIN_RADIUS, (layout.barDiameterMm / 2) * MM_TO_M);
  const stirrupRadius = Math.max(MIN_RADIUS, (layout.stirrupDiameterMm / 2) * MM_TO_M);
  const worldXY = (local: readonly Point2D[]): Point2D[] =>
    scalePoints(columnLocalMmToWorld(p, local), sceneToM);

  const group = new THREE.Group();
  const material = REBAR_MATERIAL; // ΚΟΙΝΟ άφωτο υλικό (βλ. σχόλιο ορισμού)

  // ── Διαμήκεις ράβδες: κατακόρυφοι κύλινδροι baseY → baseY + heightM ──
  const barsXY = worldXY(layout.longitudinalBarsMm);
  const barSegs = barsXY.map((b) => ({
    a: new THREE.Vector3(b.x, baseY, -b.y),
    b: new THREE.Vector3(b.x, baseY + heightM, -b.y),
  }));
  shearRebarSegsForTilt(barSegs, p, baseY); // ADR-404 Bug A — διαμήκεις γέρνουν με την κολώνα
  const bars = buildRods(barSegs, barRadius, material);
  if (bars) group.add(bars);

  // ── Στεφάνια ανά τύπο ──
  // `pathXY` = κλειστή tessellated polyline με στρογγυλεμένες γωνίες (ΙΔΙΟ
  // `stirrupPathMm` με το 2Δ → SSoT· cylinder segments διατρέχουν το τόξο →
  // Revit-grade καμπύλη γωνία, ίδιος προϋπάρχων InstancedMesh αγωγός/υλικό).
  const type = r.stirrups.type ?? DEFAULT_STIRRUP_TYPE;
  // ΟΛΟΙ οι τύποι (κλειστά & spiral) πυκνώνουν στις κρίσιμες ζώνες lcr (EC8): η
  // φισούνα = ΕΝΑΣ συνεχής συνδετήρας με βήμα που πυκνώνει στα άκρα, ακριβώς όπως
  // τα κλειστά στεφάνια — μόνο η σχεδίαση διαφέρει (έλικα vs ξεχωριστά δαχτυλίδια).
  const levels = computeStirrupLevelsMm(r, section.bboxWidthMm, section.bboxDepthMm, heightMm);
  const pathXY = worldXY(layout.stirrupPathMm);
  const stirrupSegs: Seg[] =
    type === 'spiral'
      ? spiralSegments(pathXY, levels, baseY)
      : ringSegments(pathXY, levels, baseY);
  if (type === 'closed-hooked') {
    // Δύο άκρα γάντζου 135° (precomputed SSoT· τόξο κάμψης + ουρά) → world ανά άκρο.
    const hookEndsXY = layout.stirrupHookEndsMm.map((end) => worldXY(end));
    stirrupSegs.push(...hookSegments(hookEndsXY, levels, baseY));
  }
  // ADR-460 — επιπλέον στεφάνια (boundary τοιχώματος / σκέλη multihoop) ανά στάθμη.
  const extraHoops = layout.extraStirrupPathsMm ?? [];
  for (let i = 0; i < extraHoops.length; i++) {
    stirrupSegs.push(...ringSegments(worldXY(extraHoops[i]), levels, baseY));
    // Γάντζος 135° ανά σκέλος-στεφάνι (multihoop)· wall boundary hoops → absent.
    if (type === 'closed-hooked' && layout.extraStirrupHookEndsMm?.[i]) {
      const hookEndsXY = layout.extraStirrupHookEndsMm[i].map((end) => worldXY(end));
      stirrupSegs.push(...hookSegments(hookEndsXY, levels, baseY));
    }
  }
  shearRebarSegsForTilt(stirrupSegs, p, baseY); // ADR-404 Bug A — στεφάνια ακολουθούν την κλίση
  const stirrups = buildRods(stirrupSegs, stirrupRadius, material);
  if (stirrups) group.add(stirrups);

  // ── Εσωτερικά συνδετήρια (cross-ties / διαμάντι, EC8) ανά στάθμη στεφανιού ──
  // Κλειστό διαμάντι = ring· ανοιχτά ευθύγραμμα = chain. Ίδια ακτίνα/υλικό με τα
  // στεφάνια, ΙΔΙΑ θέση με το 2Δ (geometry-is-SSoT).
  const crossTies = resolveColumnCrossTies(layout, section, r);
  if (crossTies.length > 0) {
    const tieSegs: Seg[] = [];
    for (const tie of crossTies) {
      const tieXY = worldXY(tie.pathMm);
      tieSegs.push(...(tie.closed ? ringSegments(tieXY, levels, baseY) : chainSegments(tieXY, levels, baseY)));
      if (type === 'closed-hooked') {
        const hookEndsXY = tie.hookEndsMm.map((end) => worldXY(end));
        tieSegs.push(...hookSegments(hookEndsXY, levels, baseY));
      }
    }
    shearRebarSegsForTilt(tieSegs, p, baseY); // ADR-404 Bug A — cross-ties ακολουθούν την κλίση
    const ties = buildRods(tieSegs, stirrupRadius, material);
    if (ties) group.add(ties);
  }

  if (group.children.length === 0) return null;
  group.userData['bimId'] = column.id;
  group.userData['bimType'] = 'column';
  group.userData['reinforcement'] = true;
  if (levelId !== undefined) group.userData['levelId'] = levelId;
  return group;
}
