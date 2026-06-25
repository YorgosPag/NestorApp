/**
 * ADR-507/508 (Tekton .TEK export) — XML serialization (pure SSoT, mirror dxf-ascii-writer).
 *
 * Παράγει τα `<record>` (τοίχοι/objects) και τα εγχέει στους markers του skeleton
 * template. Το template περνά ως ΟΡΙΣΜΑ (ο adapter το lazy-load-άρει) → ο writer μένει
 * ελαφρύς/testable, ΧΩΡΙΣ να import-άρει το 2.3MB skeleton.
 */

import { escapeXml } from '@/lib/xml/escape-xml';
import {
  WALL_RECORD_TEMPLATE,
  OPEN_RECORD_TEMPLATE,
  PLANE_RECORD_TEMPLATE,
  PLANE_POINT_TEMPLATE,
  AUTOROOF_RECORD_TEMPLATE,
  AUTOROOF_POINT_TEMPLATE,
  AUTOROOF_V3_TEMPLATE,
  LINE_RECORD_TEMPLATE,
  ARC_RECORD_TEMPLATE,
  STAIR_RECORD_HEAD,
  STAIR_RECORD_TAIL,
} from './tek-record-templates';
import type {
  TekArc, TekLine, TekOpening, TekPlane, TekPlanePoint, TekRoof, TekRoofFace, TekRoofPoint,
  TekStair, TekStairPoint, TekWall, TekXMatrix,
} from './tek-types';

export { escapeXml }; // SSoT στο src/lib/xml — re-export για consumers/tests του TEK module.

// Markers — literal-synced με το auto-generated tek-skeleton.template.ts (μηδέν import εκεί).
const TEK_WALL_MARKER = '<!--TEK_WALL_RECORDS-->';
const TEK_OBJECT_MARKER = '<!--TEK_OBJECT_RECORDS-->';
const TEK_PLANE_MARKER = '<!--TEK_PLANE_RECORDS-->';
const TEK_AUTOROOF_MARKER = '<!--TEK_AUTOROOF_RECORDS-->';
const TEK_LINE_MARKER = '<!--TEK_LINE_RECORDS-->';
const TEK_ARC_MARKER = '<!--TEK_ARC_RECORDS-->';
const TEK_STAIR_MARKER = '<!--TEK_STAIR_RECORDS-->';

/** Tekton-friendly αριθμός: δεκαδικά, χωρίς εκθετική μορφή, trimmed. */
export function tekNum(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return Number(n.toFixed(9)).toString();
}

/** Κανονικοποίηση χρώματος → 6-ψήφιο hex (κεφαλαία, χωρίς `#`)· fallback default τοίχου. */
export function colorHex6(hex: string): string {
  const h = hex.replace('#', '').toUpperCase();
  return /^[0-9A-F]{6}$/.test(h) ? h : '80BCFC';
}

/** `<xmatrix>` element (σειρά x00,x01,x10,x11,x20,x21 όπως το δείγμα). */
export function xmatrixXml(m: TekXMatrix): string {
  return (
    `<xmatrix>` +
    `<x00>${tekNum(m.x00)}</x00><x01>${tekNum(m.x01)}</x01>` +
    `<x10>${tekNum(m.x10)}</x10><x11>${tekNum(m.x11)}</x11>` +
    `<x20>${tekNum(m.x20)}</x20><x21>${tekNum(m.x21)}</x21>` +
    `</xmatrix>`
  );
}

/** Γεμίζει το parameterized wall record template με τις τιμές ενός τοίχου. */
export function buildWallRecordXml(w: TekWall): string {
  return WALL_RECORD_TEMPLATE
    .replace('{{ID}}', String(w.id))
    .replace('{{NAME}}', escapeXml(w.name))
    .replace('{{HEIGHT}}', tekNum(w.heightM))
    .replace('{{ELEVATION}}', tekNum(w.elevationM))
    .replace('{{COLOR}}', colorHex6(w.colorHex))
    .replace('{{XMATRIX}}', xmatrixXml(w.xmatrix))
    .replace('{{OPEN}}', w.openXml ?? '');
}

/** Γεμίζει το parameterized opening record template με τις τιμές ενός κουφώματος. */
export function buildOpenRecordXml(o: TekOpening): string {
  return OPEN_RECORD_TEMPLATE
    .replace('{{NAME}}', escapeXml(o.name))
    .replace('{{ELEVATION}}', tekNum(o.sillM))
    .replace('{{TOP}}', tekNum(o.headM))
    .replace('{{SIDE}}', String(o.side))
    .replace('{{STYLE}}', String(o.style))
    .replace('{{TXTPOS_X}}', tekNum(o.txtX))
    .replace('{{TXTPOS_Y}}', tekNum(o.txtY))
    .replace('{{XMATRIX}}', xmatrixXml(o.xmatrix));
}

/** Σειριοποιεί τις κορυφές footprint ενός επίπλου σε `<point3d>` records (μέτρα). */
export function buildPlanePointsXml(points: readonly TekPlanePoint[]): string {
  return points
    .map((p) =>
      PLANE_POINT_TEMPLATE
        .replace('{{X}}', tekNum(p.x))
        .replace('{{Y}}', tekNum(p.y))
        .replace('{{Z}}', tekNum(p.z)),
    )
    .join('\n');
}

/** Γεμίζει το parameterized plane record template με τις τιμές ενός επίπλου-κουτιού. */
export function buildPlaneRecordXml(p: TekPlane): string {
  return PLANE_RECORD_TEMPLATE
    .replace('{{COLOR}}', colorHex6(p.colorHex))
    .replace('{{WIDTH}}', tekNum(p.widthM))
    .replace('{{POINTS}}', `\n${buildPlanePointsXml(p.points)}\n`);
}

/**
 * Συναρμολογεί το `{{OPEN}}` payload ενός τοίχου από τα κουφώματά του. Κενό → `''`
 * (το wall template εκπέμπει `<open></open>`)· αλλιώς `\n<record>…</record>\n` ώστε να
 * προκύψει `<open>\n<record>…\n</record>\n</open>` όπως το δείγμα.
 */
export function buildOpenXml(openings: readonly TekOpening[]): string {
  if (openings.length === 0) return '';
  return `\n${openings.map(buildOpenRecordXml).join('\n')}\n`;
}

/** Σειριοποιεί τις footprint κορυφές μιας στέγης σε `<point><record>` (μέτρα + κλίση rad). */
export function buildRoofPointsXml(points: readonly TekRoofPoint[]): string {
  return points
    .map((p) =>
      AUTOROOF_POINT_TEMPLATE
        .replace('{{X}}', tekNum(p.x))
        .replace('{{Y}}', tekNum(p.y))
        .replace('{{ANGLE}}', tekNum(p.angleRad)),
    )
    .join('\n');
}

/** Σειριοποιεί τα «νερά» (faces) μιας στέγης σε `<v3list>` → `<onev3list><v3>…</v3></onev3list>`. */
export function buildRoofV3ListXml(faces: readonly TekRoofFace[]): string {
  return faces
    .map((face) => {
      const v3s = face
        .map((v) =>
          AUTOROOF_V3_TEMPLATE
            .replace('{{X}}', tekNum(v.x))
            .replace('{{Y}}', tekNum(v.y))
            .replace('{{Z}}', tekNum(v.z)),
        )
        .join('\n');
      return `<onev3list>\n${v3s}</onev3list>`;
    })
    .join('\n');
}

/** Γεμίζει το parameterized autoroof record template με τις τιμές μιας στέγης. */
export function buildAutoroofRecordXml(r: TekRoof): string {
  return AUTOROOF_RECORD_TEMPLATE
    .replace('{{ID}}', String(r.id))
    .replace('{{ELEVATION}}', tekNum(r.elevationM))
    .replace('{{VOLUME}}', tekNum(r.volumeM3))
    .replace('{{WIDTH}}', tekNum(r.widthM))
    .replace('{{COLOR}}', colorHex6(r.colorHex))
    .replace('{{V3LIST}}', r.faces.length > 0 ? `\n${buildRoofV3ListXml(r.faces)}\n` : '')
    .replace('{{POINTS}}', `\n${buildRoofPointsXml(r.points)}\n`);
}

/** Γεμίζει το line record template (DXF line / polyline segment → `<line><record>`). */
export function buildLineRecordXml(l: TekLine): string {
  return LINE_RECORD_TEMPLATE
    .replace('{{N}}', String(l.id))
    .replace('{{V0X}}', tekNum(l.v0.x))
    .replace('{{V0Y}}', tekNum(l.v0.y))
    .replace('{{ELEV0}}', tekNum(l.elevation0))
    .replace('{{V1X}}', tekNum(l.v1.x))
    .replace('{{V1Y}}', tekNum(l.v1.y))
    .replace('{{ELEV1}}', tekNum(l.elevation1))
    .replace('{{COLOR}}', colorHex6(l.colorHex));
}

/** Γεμίζει το arc record template (DXF arc / circle → `<arc><record>`). */
export function buildArcRecordXml(a: TekArc): string {
  return ARC_RECORD_TEMPLATE
    .replace('{{N}}', String(a.id))
    .replace('{{CIRCLE}}', a.isCircle ? '1' : '0')
    .replace('{{CX}}', tekNum(a.centre.x))
    .replace('{{CY}}', tekNum(a.centre.y))
    .replace('{{P0X}}', tekNum(a.p0.x))
    .replace('{{P0Y}}', tekNum(a.p0.y))
    .replace('{{P1X}}', tekNum(a.p1.x))
    .replace('{{P1Y}}', tekNum(a.p1.y))
    .replace('{{ELEV}}', tekNum(a.elevation))
    .replace('{{COLOR}}', colorHex6(a.colorHex));
}

/**
 * Segment-types μιας πολυγραμμής σκάλας (slots 1/3) — όλα `2` (ευθεία). Ο Τέκτων διαβάζει
 * τα point2d των slots αυτών ως **ανεξάρτητα τμήματα**: μία γραμμή (type 2) καταναλώνει **2
 * σημεία** (τόξο/type 1 = 3). Άρα `segCount = κορυφές / 2` (ΟΧΙ N−1 συνδεδεμένης πολυγραμμής —
 * αλλιώς ο parser ζητά 2×segCount σημεία, βρίσκει λιγότερα και το αρχείο ΔΕΝ ανοίγει).
 * Ground-truth: slot 8 σημείων → intlist 4· slot 17 σημείων (winder) → 4 γραμμές + 3 τόξα.
 */
function straightSegmentTypes(points: readonly TekStairPoint[]): number[] {
  return new Array<number>(Math.floor(points.length / 2)).fill(2);
}

/** Serializes a stair polyline into `<point2d>` (empty -> `<point2d>\n</point2d>`). */
export function buildStairPoint2dXml(points: readonly TekStairPoint[]): string {
  if (points.length === 0) return '<point2d>\n</point2d>';
  const recs = points
    .map((p) => `<record>\n<pX>${tekNum(p.x)}</pX><pY>${tekNum(p.y)}</pY></record>`)
    .join('\n');
  return `<point2d>\n${recs}\n</point2d>`;
}

/** Serializes a segment-types list into `<intlist>` (empty -> `<intlist>\n</intlist>`). */
export function buildStairIntlistXml(values: readonly number[]): string {
  if (values.length === 0) return '<intlist>\n</intlist>';
  const items = values.map((v) => `<i>${Math.round(v)}</i>`).join('');
  return `<intlist>\n${items}</intlist>`;
}

/**
 * Συναρμολογεί ένα stair `<record>` (type 21): κεφαλή + 3 point2d (βέλος/—/γραμμές βαθμίδων)
 * + 7 intlist (segment-types — straight ⇒ όλα `2`) + 5 point2d (εσωτ./εξωτ. περίγραμμα/πορεία
 * + 2 κενά) + scalar ουρά. Ίδια σειρά στοιχείων με το δείγμα ΣΚΑΛΑ.tek (FESPA-fixed schema).
 */
export function buildStairRecordXml(s: TekStair): string {
  const blocks = [
    buildStairPoint2dXml(s.arrow),
    buildStairPoint2dXml([]),
    buildStairPoint2dXml(s.stepLines),
    buildStairIntlistXml(straightSegmentTypes(s.arrow)),
    buildStairIntlistXml([]),
    buildStairIntlistXml(straightSegmentTypes(s.stepLines)),
    buildStairIntlistXml([]),
    buildStairIntlistXml([]),
    // 6η intlist: flag triple `0 0 0` — σταθερό από το ground-truth ΣΚΑΛΑ.tek (μετα-δεδομένα,
    // ΟΧΙ segment-types· εμφανίζεται και σε straight & winder δείγματα).
    buildStairIntlistXml([0, 0, 0]),
    buildStairIntlistXml([]),
    buildStairPoint2dXml(s.innerContour),
    buildStairPoint2dXml(s.outerContour),
    buildStairPoint2dXml(s.walkline),
    buildStairPoint2dXml([]),
    buildStairPoint2dXml([]),
  ];
  const tail = STAIR_RECORD_TAIL
    .replace('{{START}}', tekNum(s.startElevationM))
    .replace('{{END}}', tekNum(s.endElevationM))
    .replace('{{WIDTH}}', tekNum(s.stairWidthM))
    .replace('{{MIN_STEP}}', tekNum(s.minStepWidthM))
    .replace('{{STEPS_NUMBERING}}', s.stepsNumbering ? '1' : '0')
    .replace('{{STEPS}}', String(Math.round(s.steps)))
    .replace('{{LANDINGS}}', String(Math.round(s.landings)))
    .replace('{{WLENGTH}}', tekNum(s.walklineLengthM))
    .replace('{{GOING}}', tekNum(s.treadGoingM))
    .replace('{{RISER}}', tekNum(s.riserHeightM))
    .replace('{{WAIST}}', tekNum(s.waistThicknessM));
  return `${STAIR_RECORD_HEAD.replace('{{N}}', String(s.id))}${blocks.join('\n')}\n${tail}`;
}

/**
 * Εγχέει τα παραγόμενα records στους markers του skeleton template. Throws αν λείπει
 * marker (σπασμένο/λάθος template) ώστε να μην βγει σιωπηλά μισό αρχείο.
 */
export function injectTekEntities(
  template: string,
  wallsXml: string,
  objectsXml: string,
  planesXml = '',
  autoroofsXml = '',
  linesXml = '',
  arcsXml = '',
  stairsXml = '',
): string {
  if (
    !template.includes(TEK_WALL_MARKER) ||
    !template.includes(TEK_OBJECT_MARKER) ||
    !template.includes(TEK_PLANE_MARKER) ||
    !template.includes(TEK_AUTOROOF_MARKER) ||
    !template.includes(TEK_LINE_MARKER) ||
    !template.includes(TEK_ARC_MARKER) ||
    !template.includes(TEK_STAIR_MARKER)
  ) {
    throw new Error('TEK skeleton template: missing wall/object/plane/autoroof/line/arc/stair marker');
  }
  return template
    .replace(TEK_WALL_MARKER, wallsXml)
    .replace(TEK_OBJECT_MARKER, objectsXml)
    .replace(TEK_PLANE_MARKER, planesXml)
    .replace(TEK_AUTOROOF_MARKER, autoroofsXml)
    .replace(TEK_LINE_MARKER, linesXml)
    .replace(TEK_ARC_MARKER, arcsXml)
    .replace(TEK_STAIR_MARKER, stairsXml);
}
