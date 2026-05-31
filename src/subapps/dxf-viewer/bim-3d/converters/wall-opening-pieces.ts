/**
 * ADR-363/396 — 3D straight-wall opening pieces (κάθετη παρειά SSoT).
 *
 * Το 3D wall punch (`buildStraightWallWithOpenings`) σπάει έναν straight τοίχο σε
 * κατακόρυφα solid κομμάτια γύρω/ανάμεσα στα ανοίγματα (jambs + ποδιά + πρέκι).
 * Κάθε κομμάτι = footprint quad (outer/inner) εξωθημένο καθ' ύψος.
 *
 * 🔴 **Root του «τραπεζοειδούς τοίχου» στο 3D (Giorgio 2026-05-30):** η παλιά
 * έκδοση όριζε την παρειά κάθε ανοίγματος ως `lerp(outerEdge, sF)` + `lerp(innerEdge, sF)`
 * με **κοινό fraction** `sF = offset/axisLen`. Σε τοίχο με **miters**, η `outerEdge`
 * και η `innerEdge` έχουν διαφορετικό μήκος/start → το ίδιο fraction πέφτει σε
 * **διαφορετική αξονική θέση** ανά πλευρά → η παρειά βγαίνει **λοξή** (ο τοίχος
 * μαζεύεται στη μία όψη, επεκτείνεται στην άλλη) → κενά/υπερβάσεις με τη μόνωση
 * περβαζιού Z4 (που χρησιμοποιεί το κάθετο `outline`).
 *
 * **Fix (κοινό jamb-plane SSoT):** η παρειά στις άκρες κάθε ανοίγματος παίρνεται
 * από τις **κάθετες γωνίες του `opening.geometry.outline`** (ίδιο SSoT με wall
 * punch 2D + Z4 reveal + Z1 cut) → collinear σε 2D ΚΑΙ 3D. Fallback σε fraction-lerp
 * μόνο όταν λείπει το outline (legacy/pre-geometry callers).
 *
 * @see ../../bim/geometry/opening-geometry (buildOutline — κάθετες jamb γωνίες)
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.4
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §3
 */

import type { Point3D } from '../../bim/types/bim-base';
import type { WallEntity } from '../../bim/types/wall-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import { mmToSceneUnits } from '../../utils/scene-units';
import { structuralRevealHeightRangeMm } from '../../bim/geometry/opening-geometry';

const MM_TO_M = 0.001;

/**
 * Ένα κατακόρυφο κομμάτι τοίχου: footprint quad (plan) + κατακόρυφο εύρος (ΜΕΤΡΑ).
 *
 * ADR-401 Phase B2 — η κορυφή μπορεί να είναι **κεκλιμένη** κατά μήκος του άξονα:
 * `zTopAM` = top στη boundary `a` (quad[0]/quad[3]), `zTopBM` = top στη boundary `b`
 * (quad[1]/quad[2]). Οριζόντια κορυφή → `zTopAM === zTopBM` (flat ExtrudeGeometry)·
 * κεκλιμένη → custom BufferGeometry (στέγη/κεκλιμένο δοκάρι, Phase E2).
 *
 * ADR-401 (γ) Phase γ2 — ΚΑΙ ο **πάτος** γίνεται μεταβλητός (base-attach): `zBotAM`
 * = base στη boundary `a`, `zBotBM` = base στη boundary `b` (mirror του top). Flat
 * base → `zBotAM === zBotBM` (back-compat με floor 0). Σκαλωτή βάση (πολλά
 * θεμέλια/upper-envelope) σπάει σε ξεχωριστά κομμάτια (κάθε ένα flat bottom)·
 * κεκλιμένη βάση (tilted host) → `zBotAM ≠ zBotBM` (wedge). Flat top **και** flat
 * base → ExtrudeGeometry· οτιδήποτε κεκλιμένο → custom BufferGeometry.
 */
export interface WallOpeningPiece {
  /** 4 plan κορυφές `[outer@a, outer@b, inner@b, inner@a]` (ίδιο winding με buildWallShape). */
  readonly quad: readonly [Point3D, Point3D, Point3D, Point3D];
  /** Base (ΜΕΤΡΑ) στη boundary `a`. Flat πάτος → `zBotAM === zBotBM`. */
  readonly zBotAM: number;
  /** Base (ΜΕΤΡΑ) στη boundary `b`. */
  readonly zBotBM: number;
  /** Top (ΜΕΤΡΑ) στη boundary `a`. Flat piece → `zTopAM === zTopBM`. */
  readonly zTopAM: number;
  /** Top (ΜΕΤΡΑ) στη boundary `b`. */
  readonly zTopBM: number;
}

/**
 * ADR-401 Phase B2 — μεταβλητή κορυφή τοίχου (lower-envelope προφίλ) σε **τοπικά
 * μέτρα** πάνω από το δάπεδο. Όταν δοθεί, jambs/πρέκια ακολουθούν το `at(f)` αντί
 * για σταθερό `params.height`, και σπάνε στα `breakpoints` (όπου αλλάζει η κλίση).
 * Χωρίς αυτό → σταθερό ύψος (100% back-compat με flat τοίχο).
 */
export interface WallTopLocalFn {
  /** Εσωτερικά profile breakpoints (0..1) — σημεία αλλαγής κλίσης κορυφής. */
  readonly breakpoints: readonly number[];
  /** Top (τοπικά μέτρα πάνω από το δάπεδο) στο fraction `f` (0..1). */
  readonly at: (f: number) => number;
}

/**
 * ADR-401 (γ) Phase γ2 — μεταβλητός **πάτος** τοίχου (base-attach upper-envelope)
 * σε **τοπικά μέτρα** πάνω από το δάπεδο (mirror του `WallTopLocalFn`). Όταν δοθεί,
 * jambs/ποδιά πατάνε στο `at(f)` (πάνω Ή κάτω από το floor 0 — π.χ. θεμέλιο) αντί
 * για σταθερό 0, και σπάνε στα `breakpoints` (σκαλωτή βάση). Χωρίς αυτό → πάτος 0
 * (100% back-compat). Το **πρέκι** (lintel) ΔΕΝ ακολουθεί τη βάση — μένει στο
 * floor-relative ύψος του ανοίγματος.
 */
export interface WallBaseLocalFn {
  /** Εσωτερικά profile breakpoints (0..1) — σημεία αλλαγής/βήματος της βάσης. */
  readonly breakpoints: readonly number[];
  /** Base (τοπικά μέτρα πάνω από το δάπεδο, μπορεί <0) στο fraction `f` (0..1). */
  readonly at: (f: number) => number;
}

interface Boundary {
  readonly f: number;
  readonly outer: Point3D;
  readonly inner: Point3D;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerpPt(p: Point3D, q: Point3D, t: number): Point3D {
  return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, z: 0 };
}

/** Απόσταση² σημείου `p` από την άπειρη γραμμή `a→b`. */
function distToLine2(p: Point3D, a: Point3D, b: Point3D): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) { const ex = p.x - a.x, ey = p.y - a.y; return ex * ex + ey * ey; }
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  const cx = a.x + t * dx, cy = a.y + t * dy;
  const ex = p.x - cx, ey = p.y - cy;
  return ex * ex + ey * ey;
}

/**
 * Υπολογίζει τα κατακόρυφα κομμάτια ενός straight τοίχου με ανοίγματα. Pure SSoT —
 * ο 3D builder κάνει μόνο extrude + position. Επιστρέφει null σε degenerate input.
 *
 * ADR-401 Phase B2 — `wallTop` (προαιρετικό): μεταβλητή κορυφή (σκαλωτή/κεκλιμένη)·
 * jambs/πρέκια ακολουθούν το προφίλ και σπάνε στα breakpoints. Χωρίς αυτό →
 * σταθερό ύψος `params.height` (αμετάβλητη συμπεριφορά flat τοίχου).
 */
export function computeWallOpeningPieces(
  wall: WallEntity,
  openings: readonly OpeningEntity[],
  wallTop?: WallTopLocalFn,
  wallBase?: WallBaseLocalFn,
): WallOpeningPiece[] | null {
  const outer = wall.geometry.outerEdge.points;
  const inner = wall.geometry.innerEdge.points;
  if (outer.length < 2 || inner.length < 2) return null;
  const oS = outer[0], oE = outer[outer.length - 1];
  const iS = inner[0], iE = inner[inner.length - 1];

  const aS = wall.params.start, aE = wall.params.end;
  const axisLen = Math.hypot(aE.x - aS.x, aE.y - aS.y);
  if (axisLen < 1e-9) return null;

  const mmFactor = mmToSceneUnits(wall.params.sceneUnits ?? 'mm');
  const heightM = wall.params.height * MM_TO_M;

  const lerpBoundary = (f: number): Boundary => ({ f, outer: lerpPt(oS, oE, f), inner: lerpPt(iS, iE, f) });

  // Από δύο jamb γωνίες outline → ποια είναι στην εξωτ. (πλησιέστερη στη γραμμή outer).
  const classify = (cA: Point3D, cB: Point3D): { outer: Point3D; inner: Point3D } =>
    distToLine2(cA, oS, oE) <= distToLine2(cB, oS, oE)
      ? { outer: cA, inner: cB }
      : { outer: cB, inner: cA };

  const topAt = (f: number): number => (wallTop ? wallTop.at(f) : heightM);
  // ADR-401 (γ) — πάτος προφίλ (base-attach)· χωρίς wallBase → σταθερό floor 0.
  const baseAt = (f: number): number => (wallBase ? wallBase.at(f) : 0);
  // Union top+base breakpoints εντός (af, bf) ώστε κάθε sub-piece να έχει γραμμική
  // (flat/sloped) κορυφή ΚΑΙ βάση.
  const cutsBetween = (af: number, bf: number): number[] => {
    const set = new Set<number>();
    if (wallTop) for (const t of wallTop.breakpoints) if (t > af + 1e-6 && t < bf - 1e-6) set.add(t);
    if (wallBase) for (const t of wallBase.breakpoints) if (t > af + 1e-6 && t < bf - 1e-6) set.add(t);
    return [...set].sort((x, y) => x - y);
  };

  const pieces: WallOpeningPiece[] = [];

  /**
   * Μπάντα με σταθερή κορυφή `zTopM` (ποδιά) και πάτο που ακολουθεί το `zBotAt`
   * (base profile· συνήθως floor 0 → flat). Σκαλωτή/κεκλιμένη βάση → wedge.
   */
  const pushFlatPiece = (a: Boundary, b: Boundary, zBotAt: (f: number) => number, zTopM: number): void => {
    if (b.f - a.f < 1e-6) return;
    const zBotA = zBotAt(a.f);
    const zBotB = zBotAt(b.f);
    if (zTopM - zBotA < 1e-6 && zTopM - zBotB < 1e-6) return;
    pieces.push({ quad: [a.outer, b.outer, b.inner, a.inner], zBotAM: zBotA, zBotBM: zBotB, zTopAM: zTopM, zTopBM: zTopM });
  };

  /** Γραμμική παρεμβολή boundary outer/inner μεταξύ a→b στο global fraction `f`. */
  const lerpBetween = (a: Boundary, b: Boundary, f: number): Boundary => {
    const span = b.f - a.f;
    if (Math.abs(span) < 1e-12) return { f, outer: a.outer, inner: a.inner };
    const u = (f - a.f) / span;
    return { f, outer: lerpPt(a.outer, b.outer, u), inner: lerpPt(a.inner, b.inner, u) };
  };

  /**
   * Κομμάτι που η κορυφή ΚΑΙ ο πάτος του ακολουθούν προφίλ (jamb full-height /
   * πρέκι). Σπάει στα union top+base breakpoints εντός (a.f, b.f) ώστε κάθε
   * sub-piece να έχει γραμμική (flat/sloped) κορυφή ΚΑΙ βάση. `zBotAt` = base
   * profile (jamb) ή σταθερό lintel (πρέκι). Παραλείπει sub-pieces όπου top ≤ base.
   */
  const pushTopPiece = (a: Boundary, b: Boundary, zBotAt: (f: number) => number): void => {
    if (b.f - a.f < 1e-6) return;
    const cuts = cutsBetween(a.f, b.f);
    const fs = [a.f, ...cuts, b.f];
    for (let i = 0; i < fs.length - 1; i++) {
      const fa = fs[i];
      const fb = fs[i + 1];
      const sa = i === 0 ? a : lerpBetween(a, b, fa);
      const sb = i === fs.length - 2 ? b : lerpBetween(a, b, fb);
      // Interior-biased αποτίμηση: σκαλωτό (ασυνεχές) προφίλ → στο breakpoint η
      // τιμή είναι αμφίσημη· δειγματίζουμε ελάχιστα ΜΕΣΑ στο sub-interval ώστε να
      // πιάσουμε το σωστό segment (σφάλμα ein·κλίση = αμελητέο για κεκλιμένο).
      const ein = (fb - fa) * 1e-4;
      const zBotA = zBotAt(fa + ein);
      const zBotB = zBotAt(fb - ein);
      const zA = Math.max(topAt(fa + ein), zBotA);
      const zB = Math.max(topAt(fb - ein), zBotB);
      if (zA - zBotA < 1e-6 && zB - zBotB < 1e-6) continue; // top κάτω/ίσο με base → κενό
      pieces.push({ quad: [sa.outer, sb.outer, sb.inner, sa.inner], zBotAM: zBotA, zBotBM: zBotB, zTopAM: zA, zTopBM: zB });
    }
  };

  const sorted = [...openings].sort((a, b) => a.params.offsetFromStart - b.params.offsetFromStart);
  let cursor: Boundary = lerpBoundary(0);

  for (const op of sorted) {
    // ADR-396 — STRUCTURAL κενό: η μόνωση Z4 τρώει τον τοίχο → το κόψιμο διευρύνεται
    // κατά `t` περιμετρικά (πλάτος ±t κατά άξονα· ύψος structuralRevealHeightRangeMm).
    // Χωρίς reveal → tScene=0 + structural range = free (αμετάβλητο).
    const tScene = (op.params.revealInsulation?.thickness_m ?? 0) * 1000 * mmFactor;
    const startMm = op.params.offsetFromStart * mmFactor;
    const sF = clamp01((startMm - tScene) / axisLen);
    const eF = clamp01((startMm + op.params.width * mmFactor + tScene) / axisLen);
    if (eF <= sF) continue;

    // Κάθετη παρειά από το STRUCTURAL outline (SSoT)· fallback fraction-lerp όταν λείπει.
    const verts = (op.geometry?.revealOutline ?? op.geometry?.outline)?.vertices;
    let sBound: Boundary, eBound: Boundary;
    if (verts && verts.length >= 4) {
      const s = classify(verts[0], verts[3]); // start jamb γωνίες
      const e = classify(verts[1], verts[2]); // end jamb γωνίες
      sBound = { f: sF, outer: s.outer, inner: s.inner };
      eBound = { f: eF, outer: e.outer, inner: e.inner };
    } else {
      sBound = lerpBoundary(sF);
      eBound = lerpBoundary(eF);
    }

    if (sF > cursor.f + 1e-6) pushTopPiece(cursor, sBound, baseAt); // jamb πριν (κορυφή+βάση προφίλ)
    const { bottomMm, topMm } = structuralRevealHeightRangeMm(op.params);
    const bottomM = bottomMm * MM_TO_M;
    const topM = topMm * MM_TO_M;
    if (bottomM > 1e-6) pushFlatPiece(sBound, eBound, baseAt, Math.min(bottomM, heightM)); // ποδιά (πάτος=βάση)
    pushTopPiece(sBound, eBound, () => topM); // πρέκι (lintel σταθερό → κορυφή προφίλ· ΔΕΝ ακολουθεί βάση)
    cursor = eBound;
  }
  if (cursor.f < 1 - 1e-6) pushTopPiece(cursor, lerpBoundary(1), baseAt); // jamb μετά

  return pieces.length > 0 ? pieces : null;
}
