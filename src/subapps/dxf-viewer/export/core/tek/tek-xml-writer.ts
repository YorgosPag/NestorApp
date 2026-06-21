/**
 * ADR-507/508 (Tekton .TEK export) — XML serialization (pure SSoT, mirror dxf-ascii-writer).
 *
 * Παράγει τα `<record>` (τοίχοι/objects) και τα εγχέει στους markers του skeleton
 * template. Το template περνά ως ΟΡΙΣΜΑ (ο adapter το lazy-load-άρει) → ο writer μένει
 * ελαφρύς/testable, ΧΩΡΙΣ να import-άρει το 2.3MB skeleton.
 */

import { escapeXml } from '@/lib/xml/escape-xml';
import { WALL_RECORD_TEMPLATE, OPEN_RECORD_TEMPLATE } from './tek-record-templates';
import type { TekOpening, TekWall, TekXMatrix } from './tek-types';

export { escapeXml }; // SSoT στο src/lib/xml — re-export για consumers/tests του TEK module.

// Markers — literal-synced με το auto-generated tek-skeleton.template.ts (μηδέν import εκεί).
const TEK_WALL_MARKER = '<!--TEK_WALL_RECORDS-->';
const TEK_OBJECT_MARKER = '<!--TEK_OBJECT_RECORDS-->';

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

/**
 * Συναρμολογεί το `{{OPEN}}` payload ενός τοίχου από τα κουφώματά του. Κενό → `''`
 * (το wall template εκπέμπει `<open></open>`)· αλλιώς `\n<record>…</record>\n` ώστε να
 * προκύψει `<open>\n<record>…\n</record>\n</open>` όπως το δείγμα.
 */
export function buildOpenXml(openings: readonly TekOpening[]): string {
  if (openings.length === 0) return '';
  return `\n${openings.map(buildOpenRecordXml).join('\n')}\n`;
}

/**
 * Εγχέει τα παραγόμενα records στους markers του skeleton template. Throws αν λείπει
 * marker (σπασμένο/λάθος template) ώστε να μην βγει σιωπηλά μισό αρχείο.
 */
export function injectTekEntities(
  template: string,
  wallsXml: string,
  objectsXml: string,
): string {
  if (!template.includes(TEK_WALL_MARKER) || !template.includes(TEK_OBJECT_MARKER)) {
    throw new Error('TEK skeleton template: missing wall/object marker');
  }
  return template
    .replace(TEK_WALL_MARKER, wallsXml)
    .replace(TEK_OBJECT_MARKER, objectsXml);
}
