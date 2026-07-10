/**
 * ADR-512 (Tekton .TEK export) — γεωμετρικές μετατροπές (pure SSoT).
 *
 * Ο Τέκτων δουλεύει σε **μέτρα**. Οι BIM συντεταγμένες (start/end/position) ζουν σε
 * **scene units** (canvas)· οι διαστάσεις (thickness/height) σε **mm**. ΟΛΕΣ οι
 * μετατροπές scene→μέτρα γίνονται μέσω του SSoT `sceneUnitsToMeters` (scene-units.ts)
 * — μηδέν re-impl (ίδιο που χρησιμοποιούν οι bim-3d converters).
 *
 * xmatrix DECODED + CALIBRATED (browser-verified σε λοξούς τοίχους 2026-06-21).
 * Ο Τέκτων διαβάζει τον πίνακα **column-major**: ο point (u,v) του μοναδιαίου κελιού →
 *   X = x00·u + x10·v + x20,  Y = x01·u + x11·v + x21
 * άρα ο **άξονας μήκους** (u) = (x00,x01) και ο **άξονας πάχους** (v) = (x10,x11):
 *   (x00,x01) = E−S            (διάνυσμα μήκους)
 *   (x10,x11) = n̂ · thickness   (n̂ = μοναδιαίο κάθετο)
 *   (x20,x21) = σημείο εκκίνησης (γωνία/παρειά)
 * ΠΡΟΣΟΧΗ: το δείγμα ήταν οριζόντιο (x01=x10=0 → degenerate)· οι λοξοί τοίχοι έδειξαν
 * ότι χρειάζεται transpose (αλλιώς ο Τέκτων ζωγραφίζει ΡΟΜΒΟ αντί ορθογωνίου).
 */

import { sceneUnitsToMeters, type SceneUnits } from '../../../utils/scene-units';
import type { Point3D } from '../../../bim/types/bim-base';
import type { Point2D } from '../../../rendering/types/Types';
import type { TekXMatrix, TekPlanePoint, TekRoofPoint } from './tek-types';

/** mm → μέτρα. Reuse του SSoT (sceneUnitsToMeters('mm') = 0.001) αντί magic /1000. */
export const MM_TO_M = sceneUnitsToMeters('mm');

/** mm → μέτρα (διαστάσεις params αποθηκεύονται σε mm). */
export function mmToMeters(mm: number): number {
  return mm * MM_TO_M;
}

/**
 * **ΜΕΤΡΑ Τέκτονα → scene units** (αντίστροφο της export `v.x * sceneUnitsToMeters`).
 * SSoT μετατροπής μονάδων ΚΑΙ για το IMPORT (ADR-526) — μηδέν 2η διαδρομή.
 */
export function metersToScene(meters: number, units: SceneUnits): number {
  return meters / sceneUnitsToMeters(units);
}

/**
 * **Τέκτων point (μέτρα, Y-up) → καμβά point (scene units, Y-down).** Αντίστροφο της
 * Y-negation του `buildXMatrix`/`footprintRingToMeters`: `canvasY = −tektonY`. ΕΝΑ σημείο
 * για το import Y-flip (`|| 0` αποφεύγει −0). SSoT καθρέφτης του export Y-flip.
 */
export function tekMetersToScene(xMeters: number, yMeters: number, units: SceneUnits): Point2D {
  return { x: metersToScene(xMeters, units), y: -metersToScene(yMeters, units) || 0 };
}

/**
 * **Σκηνή point (x,y, scene units, Y-down) → Τέκτων point (μέτρα, Y-up).** Το ΕΝΑ SSoT
 * σημείο της export Y-flip: `xM = x·f`, `yM = −y·f` (`|| 0` αποφεύγει −0). ΟΛΟΙ οι
 * point/ring exporters (footprint πλάκας/στέγης, σκάλα) περνούν από εδώ — μηδέν inline
 * Y-flip ανά builder. Αντίστροφο της `tekMetersToScene` (import).
 */
export function sceneXYToTekMeters(x: number, y: number, metersPerSceneUnit: number): Point2D {
  return { x: x * metersPerSceneUnit, y: -y * metersPerSceneUnit || 0 };
}

/**
 * Γενικό affine SSoT (column-major): origin + άξονας-u (x00,x01) + άξονας-v (x10,x11).
 * ΟΛΟΙ οι builders (wall/opening/object) περνούν από εδώ — μηδέν 2ος affine από το μηδέν.
 * Ο Τέκτων διαβάζει point(u,v) → X=x00·u+x10·v+x20, Y=x01·u+x11·v+x21.
 *
 * **Y-FLIP (SSoT):** ο καμβάς του Νέστορα έχει Y «προς τα κάτω» (screen), ο Τέκτων Y «προς τα
 * πάνω» (CAD) → χωρίς αναστροφή το σχέδιο βγαίνει mirror (πάνω↔κάτω). Αρνούμαστε τα Y-components
 * (x01,x11,x21) ώστε Y_Τέκτων = −Y_καμβά. Εφαρμόζεται ΕΔΩ (όχι στους callers) → όλα τα xmatrix
 * entities (τοίχοι/κουφώματα/objects) διορθώνονται ομοιόμορφα από ΕΝΑ σημείο.
 */
export function buildXMatrix(
  ox: number, oy: number, ux: number, uy: number, vx: number, vy: number,
): TekXMatrix {
  return { x00: ux, x01: -uy, x10: vx, x11: -vy, x20: ox, x21: -oy };
}

/**
 * xmatrix τοίχου από centerline άκρα (ΜΕΤΡΑ) + πάχος (ΜΕΤΡΑ). Το origin μετατοπίζεται
 * −n̂·(t/2) ώστε το δικό μας centerline να αντιστοιχεί στην παρειά-αναφορά του Τέκτονα
 * (το πρόσημο επιβεβαιώνεται στο 1ο browser round-trip).
 */
export function buildWallXMatrix(
  sx: number, sy: number, ex: number, ey: number, thicknessM: number,
): TekXMatrix {
  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len; // μοναδιαίο κάθετο
  const ny = dx / len;
  const half = thicknessM / 2;
  // column-major: άξονας μήκους u=(dx,dy)=E−S· άξονας πάχους v=n̂·t· origin=centerline→παρειά.
  return buildXMatrix(sx - nx * half, sy - ny * half, dx, dy, nx * thicknessM, ny * thicknessM);
}

/**
 * Affine κουφώματος (ΜΕΤΡΑ) από το **κέντρο** + **γωνία άξονα** του host τοίχου + πλάτος.
 *
 * SSoT: το κέντρο (`centerX/Y`) και η `rotationRad` ΔΕΝ υπολογίζονται εδώ — έρχονται από το
 * `computeOpeningGeometry` (`bim/geometry/opening-geometry.ts`), τη μοναδική πηγή θέσης/άξονα
 * κουφώματος (την ίδια που τρέφει renderers/3D/grips· χειρίζεται straight+curved+polyline hosts).
 * Εδώ μένει ΜΟΝΟ η Tekton-specific σύνθεση του xmatrix:
 *   - origin = κέντρο − â·(width/2)   (κοντινή ακμή πάνω στον άξονα)
 *   - άξονας-u = â·width              (x00,x01 = πλάτος κατά μήκος του τοίχου)
 *   - άξονας-v = n̂ = (−sin,cos)       (x10,x11 = ΜΟΝΑΔΙΑΙΟ κάθετο — όπως το δείγμα x11=−1·
 *     ο Τέκτων κόβει το άνοιγμα στο πάχος του host, άρα v=unit, ΟΧΙ ·thickness)
 * Λοξό-safe by construction (â=(cosθ,sinθ) από τον verified SSoT άξονα).
 */
export function buildOpeningXMatrix(
  centerXm: number, centerYm: number, rotationRad: number, widthM: number,
): TekXMatrix {
  const ax = Math.cos(rotationRad); // μοναδιαίος άξονας τοίχου
  const ay = Math.sin(rotationRad);
  const half = widthM / 2;
  // origin = κέντρο − â·(w/2)· u = â·w· v = n̂ μοναδιαίο.
  return buildXMatrix(centerXm - ax * half, centerYm - ay * half, ax * widthM, ay * widthM, -ay, ax);
}

/**
 * ADR-531 Φ5b.2 — **ΑΝΤΙΣΤΡΟΦΟ** του {@link buildWallXMatrix} (import). Αποκωδικοποιεί ένα
 * `<wall>` xmatrix → centerline άκρα + πάχος, στο **matrix-frame** (Tekton μέτρα, Y-up — ΟΧΙ
 * scene): ο caller περνά τα start/end από το SSoT {@link tekMetersToScene} (Y-flip) όπως ΟΛΟ το
 * υπόλοιπο import (mirror του `localPoint` στο `tek-window-symbol`). Καθαρή αντιστροφή:
 *   (x00,x01) = διάνυσμα μήκους (E−S)·  |(x10,x11)| = πάχος·  n̂ = (x10,x11)/πάχος
 *   start = (x20,x21) + n̂·(t/2)  (παρειά-origin → centerline)·  end = start + (E−S)
 * Round-trip-verified έναντι του `buildWallXMatrix` (identity σε λοξό τοίχο).
 */
export function decodeWallXMatrix(
  m: TekXMatrix,
): { start: Point2D; end: Point2D; thicknessM: number } {
  const dx = m.x00;
  const dy = m.x01;
  const thicknessM = Math.hypot(m.x10, m.x11) || 0;
  const nx = thicknessM > 0 ? m.x10 / thicknessM : 0;
  const ny = thicknessM > 0 ? m.x11 / thicknessM : 0;
  const half = thicknessM / 2;
  const start: Point2D = { x: m.x20 + nx * half, y: m.x21 + ny * half };
  const end: Point2D = { x: start.x + dx, y: start.y + dy };
  return { start, end, thicknessM };
}

/**
 * ADR-531 Φ5b.2 — **ΑΝΤΙΣΤΡΟΦΟ** του {@link buildOpeningXMatrix} (import). Αποκωδικοποιεί ένα
 * `<open>` xmatrix → **κέντρο** ανοίγματος + **πλάτος**, στο matrix-frame (Tekton μέτρα, Y-up):
 *   πλάτος = |(x00,x01)| (u-άξονας)·  κέντρο = midpoint του u-span = origin + (u/2).
 * Ο caller περνά το κέντρο από το {@link tekMetersToScene} (Y-flip) όπως το wall decode.
 */
export function decodeOpeningXMatrix(m: TekXMatrix): { center: Point2D; widthM: number } {
  const widthM = Math.hypot(m.x00, m.x01) || 0;
  const center: Point2D = { x: m.x20 + m.x00 / 2, y: m.x21 + m.x01 / 2 };
  return { center, widthM };
}

/**
 * ADR-531 Φ5b.5 — αποκωδικοποιεί ένα `<pillar>` (κολώνα/τοιχίο) xmatrix → **κέντρο** +
 * **πλάτος** (u-άξονας) + **βάθος** (v-άξονας) + **γωνία** u-άξονα, στο matrix-frame (Tekton
 * μέτρα, Y-up). Σε αντίθεση με τον τοίχο (line + πάχος), η κολώνα είναι **centered box/circle**:
 *   width = |(x00,x01)| (u-extent)·  depth = |(x10,x11)| (v-extent)·  angle = atan2(x01,x00)
 *   κέντρο = origin(u=0,v=0 γωνία) + u/2 + v/2   (ΙΔΙΑ [0,1]² σύμβαση με wall/opening origin)
 * Ο caller περνά το κέντρο από το {@link tekMetersToScene} (Y-flip) και αρνείται τη γωνία (Y-down).
 */
export function decodePillarXMatrix(
  m: TekXMatrix,
): { center: Point2D; widthM: number; depthM: number; rotationRad: number } {
  const widthM = Math.hypot(m.x00, m.x01) || 0;
  const depthM = Math.hypot(m.x10, m.x11) || 0;
  const center: Point2D = { x: m.x20 + (m.x00 + m.x10) / 2, y: m.x21 + (m.x01 + m.x11) / 2 };
  const rotationRad = Math.atan2(m.x01, m.x00);
  return { center, widthM, depthM, rotationRad };
}

/**
 * Footprint ring ενός BIM entity (κορυφές σε **scene units**, από τον γενικό export
 * extractor `extractEntityFootprintRing` — ΙΔΙΟ που τρέφει DXF/IFC) → `<point3d>` κορυφές
 * σε **world μέτρα**. Το X/Y μετατρέπεται με `metersPerSceneUnit` (ο ΙΔΙΟΣ παράγοντας με
 * τους τοίχους)· το Z = `elevationM` (στάθμη βάσης) — το footprint είναι επίπεδο, η εξώθηση
 * κατά το ύψος γίνεται από το `<width>` του plane. Γενικό: έπιπλα (Φ2b) + structural slabs (Φ3).
 */
export function footprintRingToMeters(
  ring: readonly Point3D[], metersPerSceneUnit: number, elevationM: number,
): TekPlanePoint[] {
  return ring.map((v) => {
    const p = sceneXYToTekMeters(v.x, v.y, metersPerSceneUnit); // Y-flip SSoT
    return { x: p.x, y: p.y, z: elevationM };
  });
}

/** Ανοχή ισότητας κορυφών σε μέτρα (1 micron) για το dedup των face rings. */
const VERTEX_EPSILON_M = 1e-6;

function samePoint3D(a: TekPlanePoint, b: TekPlanePoint): boolean {
  return (
    Math.abs(a.x - b.x) < VERTEX_EPSILON_M &&
    Math.abs(a.y - b.y) < VERTEX_EPSILON_M &&
    Math.abs(a.z - b.z) < VERTEX_EPSILON_M
  );
}

/**
 * Καθαρίζει ένα face ring από **διαδοχικές διπλές κορυφές** + το **κλείσιμο** (τελευταία ==
 * πρώτη). Ο roof solver παράγει closed rings με degenerate επαναλήψεις (π.χ. ακμές μηδενικού
 * μήκους)· ο Τέκτων **απορρίπτει** τέτοια `<v3list>` faces → η στέγη δεν ζωγραφίζεται. Τα
 * έγκυρα faces του δείγματος είναι **απλά ανοιχτά πολύγωνα** (καμία επανάληψη). 3D σύγκριση
 * (xy ίδιο αλλά z διαφορετικό = γνήσια κορυφή στην κλίση, ΟΧΙ διπλή).
 */
export function dedupeFaceRing(ring: readonly TekPlanePoint[]): TekPlanePoint[] {
  const out: TekPlanePoint[] = [];
  for (const p of ring) {
    if (out.length === 0 || !samePoint3D(out[out.length - 1], p)) out.push(p);
  }
  // Drop trailing closing vertex (== first) ώστε το face να μείνει ανοιχτό όπως το δείγμα.
  while (out.length > 1 && samePoint3D(out[0], out[out.length - 1])) out.pop();
  return out;
}

/**
 * Προσημασμένο εμβαδό XY ενός ring (shoelace). > 0 = CCW, < 0 = CW (math convention,
 * Y προς τα πάνω = ο τρόπος που διαβάζει ο Τέκτων).
 */
export function signedAreaXY(ring: readonly { x: number; y: number }[]): number {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

/**
 * Αντιστρέφει το winding ενός roof footprint **διατηρώντας σωστά την κλίση ανά ακμή**. Η
 * `angleRad` κάθε κορυφής είναι η κλίση της **εξερχόμενης** ακμής (vertex i → i+1). Όταν
 * αντιστρέφεται η σειρά, η εξερχόμενη ακμή της νέας κορυφής `j` είναι η αντίστροφη μιας
 * παλιάς ακμής → η κλίση πρέπει να μετατοπιστεί (όχι απλό `reverse()`):
 *   reversed[j] = { κορυφή p[n-1-j],  angle p[(n-2-j) mod n] }.
 */
export function reverseRoofFootprint(points: readonly TekRoofPoint[]): TekRoofPoint[] {
  const n = points.length;
  return points.map((_, j) => {
    const vertex = points[n - 1 - j];
    const angleSrc = points[(((n - 2 - j) % n) + n) % n];
    return { x: vertex.x, y: vertex.y, angleRad: angleSrc.angleRad };
  });
}

/**
 * 3D ring ενός roof «νερού» (face outline· **canvas-unit xy + mm z absolute**, από το
 * `RoofGeometry.faces[].outline`) → `<v3>` κορυφές σε **world μέτρα**. Σε αντίθεση με το
 * `footprintRingToMeters` (που ισοπεδώνει το Z), εδώ το **Z διατηρείται per-vertex** (mm→m)
 * γιατί το κεκλιμένο face έχει διαφορετικό ύψος σε κάθε κορυφή (γείσο→κορφιάς). Το ring
 * περνά από `dedupeFaceRing` (αφαίρεση degenerate επαναλήψεων — απαραίτητο για να το δεχτεί ο Τέκτων).
 */
export function roofFaceRingToMeters(
  ring: readonly Point3D[], metersPerSceneUnit: number,
): TekPlanePoint[] {
  return dedupeFaceRing(
    ring.map((v) => {
      const p = sceneXYToTekMeters(v.x, v.y, metersPerSceneUnit); // Y-flip SSoT
      return { x: p.x, y: p.y, z: (v.z ?? 0) * MM_TO_M };
    }),
  );
}

/** Ανοχή «ridge apex πάνω στην ακμή-αέτωμα» ως κλάσμα του μήκους ακμής (solver jitter). */
const GABLE_ON_EDGE_FRACTION = 0.02;

/**
 * Κατασκευάζει τα **αετώματα** (gable end faces) ως κατακόρυφα `<v3list>` πολύγωνα.
 *
 * Ο roof solver (`solveLowerEnvelope`) παράγει ΜΟΝΟ τα κεκλιμένα «νερά» — τα αετώματα
 * (κατακόρυφες τριγωνικές όψεις στις μη-κεκλιμένες ακμές) ΔΕΝ ανήκουν στη lower envelope,
 * άρα λείπουν από το `geometry.faces`. Ο Τέκτων ΧΡΕΙΑΖΕΤΑΙ αυτά τα faces στο `<v3list>`:
 * ground-truth `ΣΤΕΓΗ_ΔΙΡΡΥΧΤΗ_ΚΑΘΕΤΑ_ΑΕΤΩΜΑΤΑ.tek` = δίρριχτη με **2 νερά + 2 αετώματα τρίγωνα**.
 * Χωρίς αυτά, τα αετώματα μένουν ανοιχτά → «οι γραμμές δεν ταυτίζονται» στις κορυφές.
 *
 * Κάθε αέτωμα = η κατακόρυφη όψη πάνω από μια μη-κεκλιμένη ακμή A→B (z=base) που ανεβαίνει
 * στο/στα ridge apex (z=ridge) που κείνται πάνω σ' αυτή την ακμή. **FULL SSoT reuse:** τα apex
 * έρχονται από τα **ήδη υπολογισμένα** `geometry.ridges` — μηδέν re-derive κορυφογραμμής.
 * Χρησιμοποιεί το ΑΡΧΙΚΟ footprint winding (ίδιο σύστημα με τα water faces, ΟΧΙ το CCW-flipped
 * `<point>` output). Επίπεδη στέγη (καμία κεκλιμένη ακμή) → κανένα αέτωμα.
 */
export function buildGableFaces(
  vertices: readonly { x: number; y: number }[],
  edges: readonly ({ definesSlope?: boolean } | undefined)[],
  ridges: readonly { a: Point3D; b: Point3D }[] | undefined,
  basePivotZmm: number,
  metersPerSceneUnit: number,
): TekPlanePoint[][] {
  if (!ridges || ridges.length === 0) return []; // χωρίς κορυφογραμμή → κανένα αέτωμα
  if (!edges.some((e) => e?.definesSlope)) return [];
  const ridgePts: Point3D[] = ridges.flatMap((r) => [r.a, r.b]);
  const n = vertices.length;
  const out: TekPlanePoint[][] = [];
  for (let i = 0; i < n; i++) {
    if (edges[i]?.definesSlope) continue; // κεκλιμένη ακμή = νερό, όχι αέτωμα
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    const abLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (abLen < 1e-6) continue;
    const eps = abLen * GABLE_ON_EDGE_FRACTION;
    // ridge apex που κείνται πάνω στην ακμή A→B (xy), ταξινομημένα κατά μήκος a→b.
    const apexes = ridgePts
      .map((p) => {
        const ap = Math.hypot(p.x - a.x, p.y - a.y);
        const pb = Math.hypot(b.x - p.x, b.y - p.y);
        const t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (abLen * abLen);
        return { p, onEdge: Math.abs(ap + pb - abLen) < eps, t };
      })
      .filter((u) => u.onEdge)
      .sort((u, v) => u.t - v.t)
      .map((u) => u.p);
    if (apexes.length === 0) continue;
    // Κατακόρυφο αέτωμα: A(base) → B(base) → apex(es) σε φθίνον t (κλείνει το πολύγωνο).
    const ring: Point3D[] = [
      { x: a.x, y: a.y, z: basePivotZmm },
      { x: b.x, y: b.y, z: basePivotZmm },
      ...[...apexes].reverse(),
    ];
    out.push(roofFaceRingToMeters(ring, metersPerSceneUnit));
  }
  return out;
}
