/**
 * ADR-531 Φ5b.1+ (Tekton .TEK IMPORT — faithful window/wall symbol) — καθαρή γεωμετρία (σε
 * Tekton μέτρα, Y-up) για:
 *   - τοίχο με **κομμένα ανοίγματα** (οι παρειές σπάνε στο εύρος κάθε κουφώματος + jamb returns),
 *   - **σύμβολο παραθύρου** (υαλοπίνακας-«τζάμι» στο κέντρο του ανοίγματος).
 *
 * Ο τοίχος ορίζεται από το `<xmatrix>`: start=(x20,x21), u-άξονας=(x00,x01) [μήκος], v-άξονας=
 * (x10,x11) [πάχος]. Σημείο σε τοπικές (t κατά μήκος, f κατά πάχος) = start + u·t + v·f.
 *
 * Μηδέν μετατροπή μονάδων/Y-flip εδώ — ο mapper (`tek-structural-to-scene`) τα περνά από το SSoT.
 *
 * @module io/tek/tek-window-symbol
 */

import type { TekPoint2D, TekXMatrix, TekOpeningRecord } from './tek-import-types';
import { clamp, clamp01 } from '../../rendering/entities/shared/geometry-utils';

/** Ευθύγραμμο τμήμα σε Tekton μέτρα. */
export interface TekSeg {
  readonly a: TekPoint2D;
  readonly b: TekPoint2D;
}

/** Frame rail inset (κλάσμα πάχους) όταν λείπει `frame_thickness`. */
const FRAME_RAIL_FALLBACK_FRAC = 1 / 8;
/** Μισός διαχωρισμός των 2 γραμμών υαλοπίνακα (κλάσμα πάχους). */
const GLASS_HALF_SEP_FRAC = 1 / 14;
/** Τμήματα προσέγγισης του τεταρτοκυκλικού τόξου ανοίγματος πόρτας (polyline → slanted-safe). */
const DOOR_ARC_SEGMENTS = 12;
/**
 * `<style>` τιμές ανοιγμάτων που είναι **πόρτες** (DXF ground-truth: style=1 → πόρτα με τόξο,
 * style=0 → παράθυρο). Calibrated από `Ισόγειο 312`· άλλες τιμές θεωρούνται παράθυρα μέχρι
 * να εμφανιστούν δείγματα.
 */
const DOOR_STYLES = new Set<number>([1]);

/** `true` αν το `style` του ανοίγματος αντιστοιχεί σε πόρτα (DXF: style=1). */
export function isDoorStyle(style: number): boolean {
  return DOOR_STYLES.has(style);
}

/** Σημείο στις τοπικές συντεταγμένες (t κατά μήκος u, f κατά πάχος v) → Tekton μέτρα. */
function localPoint(m: TekXMatrix, t: number, f: number): TekPoint2D {
  return { x: m.x20 + t * m.x00 + f * m.x10, y: m.x21 + t * m.x01 + f * m.x11 };
}

const seg = (a: TekPoint2D, b: TekPoint2D): TekSeg => ({ a, b });

/**
 * Προβολή ενός ανοίγματος στον άξονα του τοίχου → διάστημα [tmin,tmax] (clamped 0..1).
 * Το άνοιγμα τοποθετείται με δικό του `<xmatrix>` (x00 = πλάτος)· προβάλλουμε τα δύο άκρα του.
 */
export function openingAxisInterval(opening: TekOpeningRecord, wall: TekXMatrix): [number, number] {
  const uLen2 = wall.x00 * wall.x00 + wall.x01 * wall.x01 || 1;
  const om = opening.matrix;
  const s = { x: om.x20, y: om.x21 };
  const e = { x: om.x20 + om.x00, y: om.x21 + om.x01 };
  const proj = (p: TekPoint2D): number =>
    ((p.x - wall.x20) * wall.x00 + (p.y - wall.x21) * wall.x01) / uLen2;
  const t0 = proj(s), t1 = proj(e);
  return [clamp01(Math.min(t0, t1)), clamp01(Math.max(t0, t1))];
}

/**
 * Παρειές τοίχου (near f=0, far f=1) **κομμένες** στα ανοίγματα + jamb returns + ακραία caps.
 * Χωρίς ανοίγματα → κλειστό ορθογώνιο (4 γραμμές, ίδιο με πριν).
 */
export function buildWallCutoutSegments(
  wall: TekXMatrix, openings: readonly TekOpeningRecord[],
): TekSeg[] {
  const intervals = openings
    .map((o) => openingAxisInterval(o, wall))
    .sort((a, b) => a[0] - b[0]);
  const out: TekSeg[] = [];

  // near + far edges, σπασμένες στα διαστήματα ανοιγμάτων
  for (const f of [0, 1]) {
    let cursor = 0;
    for (const [tmin, tmax] of intervals) {
      if (tmin > cursor) out.push(seg(localPoint(wall, cursor, f), localPoint(wall, tmin, f)));
      cursor = Math.max(cursor, tmax);
    }
    if (cursor < 1) out.push(seg(localPoint(wall, cursor, f), localPoint(wall, 1, f)));
  }

  // ακραία caps του τοίχου
  out.push(seg(localPoint(wall, 0, 0), localPoint(wall, 0, 1)));
  out.push(seg(localPoint(wall, 1, 0), localPoint(wall, 1, 1)));

  // jamb returns στα άκρα κάθε ανοίγματος (η «παρειά» του κουφώματος)
  for (const [tmin, tmax] of intervals) {
    out.push(seg(localPoint(wall, tmin, 0), localPoint(wall, tmin, 1)));
    out.push(seg(localPoint(wall, tmax, 0), localPoint(wall, tmax, 1)));
  }
  return out;
}

/**
 * Σύμβολο παραθύρου (faithful, Φ5b.1++) = **πλαίσιο** (2 διαμήκεις ράγες inset κατά `frame_thickness`
 * από κάθε παρειά + 2 caps) + **διπλός υαλοπίνακας** (2 κεντρικές γραμμές) + **κεντρικό μπινί**
 * (κάθετο mullion στο μέσο, 2 φύλλα) — όπως το σύμβολο του Τέκτονα (target `221240`). Τα jamb returns
 * (πλήρες πάχος στα άκρα) ζωγραφίζονται από το {@link buildWallCutoutSegments}.
 */
export function buildWindowSymbolSegments(opening: TekOpeningRecord, wall: TekXMatrix): TekSeg[] {
  const [tmin, tmax] = openingAxisInterval(opening, wall);
  if (tmax - tmin < 1e-6) return [];
  const thickM = Math.hypot(wall.x10, wall.x11) || 1;
  // Ράγες πλαισίου: inset από κάθε παρειά κατά frame_thickness (fallback 1/8 πάχους), όριο [0.04,0.3].
  const railRaw = opening.frameThicknessM > 0 ? opening.frameThicknessM / thickM : FRAME_RAIL_FALLBACK_FRAC;
  const railF = clamp(railRaw, 0.04, 0.3);
  // Διπλός υαλοπίνακας: 2 γραμμές κεντραρισμένες, διαχωρισμός μέσα στο πλαίσιο.
  const g = Math.min(GLASS_HALF_SEP_FRAC, railF * 0.7);
  const gf1 = 0.5 - g, gf2 = 0.5 + g;
  const tMid = (tmin + tmax) / 2;
  return [
    // Πλαίσιο (frame box): 2 διαμήκεις ράγες + 2 caps στα άκρα.
    seg(localPoint(wall, tmin, railF), localPoint(wall, tmax, railF)),
    seg(localPoint(wall, tmin, 1 - railF), localPoint(wall, tmax, 1 - railF)),
    seg(localPoint(wall, tmin, railF), localPoint(wall, tmin, 1 - railF)),
    seg(localPoint(wall, tmax, railF), localPoint(wall, tmax, 1 - railF)),
    // Υαλοπίνακας: 2 κεντρικές γραμμές.
    seg(localPoint(wall, tmin, gf1), localPoint(wall, tmax, gf1)),
    seg(localPoint(wall, tmin, gf2), localPoint(wall, tmax, gf2)),
    // Κεντρικό μπινί (mullion): κάθετο στο μέσο, σε όλο το ύψος του πλαισίου.
    seg(localPoint(wall, tMid, railF), localPoint(wall, tMid, 1 - railF)),
  ];
}

/**
 * Σύμβολο **πόρτας** (faithful, DXF-verified `Ισόγειο 312`): **φύλλο** (γραμμή κάθετη στον τοίχο,
 * μήκος = πλάτος − 2·jamb) + **τεταρτοκυκλικό τόξο ανοίγματος** (polyline). Μεντεσές στον αρμό
 * `tmin` (t = tmin + jamb/|u|, f = `frame_width`/πάχος)· το φύλλο ανοίγει προς +n̂ (μέσα στο δωμάτιο)
 * και η κλειστή θέση πέφτει κατά μήκος του τοίχου (+û) ακριβώς στον δεύτερο αρμό. Slanted-safe
 * (û/n̂ από τον πίνακα). Τα jamb returns ζωγραφίζονται από το {@link buildWallCutoutSegments}.
 *
 * ⚠️ Calibration (browser-verify): η πλευρά μεντεσέ + φορά ανοίγματος ανά `side` (εδώ side=3) —
 * άλλες τιμές `side` μπορεί να χρειαστούν mirror (hinge στο tmax ή φύλλο προς −n̂).
 */
export function buildDoorSymbolSegments(opening: TekOpeningRecord, wall: TekXMatrix): TekSeg[] {
  const [tmin, tmax] = openingAxisInterval(opening, wall);
  if (tmax - tmin < 1e-6) return [];
  const uLen = Math.hypot(wall.x00, wall.x01) || 1;
  const thick = Math.hypot(wall.x10, wall.x11) || 1;
  const ux = wall.x00 / uLen, uy = wall.x01 / uLen; // û (κατά μήκος τοίχου)
  const nx = wall.x10 / thick, ny = wall.x11 / thick; // n̂ (κατά το πάχος)
  const jambFrac = opening.jambWidthM / uLen;
  const hingeT = tmin + jambFrac;
  const hingeF = clamp(opening.frameWidthM > 0 ? opening.frameWidthM / thick : 0.5, 0, 1);
  const hinge = localPoint(wall, hingeT, hingeF);
  const leafW = (tmax - tmin) * uLen - 2 * opening.jambWidthM;
  if (leafW <= 1e-6) return [];
  // Φύλλο (ανοιχτό, κάθετο στον τοίχο προς +n̂).
  const leafTip = { x: hinge.x + nx * leafW, y: hinge.y + ny * leafW };
  const out: TekSeg[] = [seg(hinge, leafTip)];
  // Τεταρτοκυκλικό τόξο: από ανοιχτό (+n̂) σε κλειστό (+û), N τμήματα.
  let prev = leafTip;
  for (let k = 1; k <= DOOR_ARC_SEGMENTS; k++) {
    const ang = (k / DOOR_ARC_SEGMENTS) * (Math.PI / 2);
    const dx = ux * Math.sin(ang) + nx * Math.cos(ang);
    const dy = uy * Math.sin(ang) + ny * Math.cos(ang);
    const p = { x: hinge.x + dx * leafW, y: hinge.y + dy * leafW };
    out.push(seg(prev, p));
    prev = p;
  }
  return out;
}
