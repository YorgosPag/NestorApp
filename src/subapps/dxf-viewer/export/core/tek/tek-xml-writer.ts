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
} from './tek-record-templates';
import type {
  TekOpening, TekPlane, TekPlanePoint, TekRoof, TekRoofFace, TekRoofPoint, TekWall, TekXMatrix,
} from './tek-types';

export { escapeXml }; // SSoT στο src/lib/xml — re-export για consumers/tests του TEK module.

// Markers — literal-synced με το auto-generated tek-skeleton.template.ts (μηδέν import εκεί).
const TEK_WALL_MARKER = '<!--TEK_WALL_RECORDS-->';
const TEK_OBJECT_MARKER = '<!--TEK_OBJECT_RECORDS-->';
const TEK_PLANE_MARKER = '<!--TEK_PLANE_RECORDS-->';
const TEK_AUTOROOF_MARKER = '<!--TEK_AUTOROOF_RECORDS-->';

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
): string {
  if (
    !template.includes(TEK_WALL_MARKER) ||
    !template.includes(TEK_OBJECT_MARKER) ||
    !template.includes(TEK_PLANE_MARKER) ||
    !template.includes(TEK_AUTOROOF_MARKER)
  ) {
    throw new Error('TEK skeleton template: missing wall/object/plane/autoroof marker');
  }
  return template
    .replace(TEK_WALL_MARKER, wallsXml)
    .replace(TEK_OBJECT_MARKER, objectsXml)
    .replace(TEK_PLANE_MARKER, planesXml)
    .replace(TEK_AUTOROOF_MARKER, autoroofsXml);
}
