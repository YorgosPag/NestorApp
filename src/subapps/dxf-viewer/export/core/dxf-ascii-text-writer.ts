/**
 * ============================================================================
 * DXF ASCII TEXT WRITER — TEXT + MTEXT emitters (SSoT split, ADR-636 Φ2.3)
 * ============================================================================
 *
 * Extracted from `dxf-ascii-writer.ts` for file-size SRP (N.7.1, mirror of the
 * HATCH / TABLES writer splits). Holds the two text emitters:
 *
 *   • `emitText`  — single-line `TEXT`. Now carries optional H/V justification
 *     (codes 72/73 + 11/21 alignment point). With no `align` (or left-baseline)
 *     it is byte-identical to the historic output — Tekton/legacy stay untouched.
 *   • `emitMText` — real multi-line `MTEXT` (`\P` line breaks, code 71 attachment,
 *     40/41 height/width, 50 rotation). The content string comes from the SSoT
 *     serializer `serializeDxfTextNode` (runs → `\P`, `\`/`{`/`}` escaping,
 *     version-gated R12 → plain-TEXT downgrade). Non-ASCII (Greek) is handled
 *     downstream: UTF-8 for R2007+, or the Φ2.2 cp1253 byte-encode (which also
 *     emits `\U+XXXX` for out-of-codepage glyphs) — no escaper is duplicated here.
 *
 * ADR-636 Στάδιο 2 Φ2.3.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity, MTextEntity, TextEntity } from '../../types/entities';
import type { DxfTextNode, TextRun } from '../../text-engine/types';
import { serializeDxfTextNode } from '../../text-engine/serializer';
import { ensureTextNode } from '../../text-engine/edit/ensure-text-node';
import { DxfDocumentVersion } from '../../text-engine/types/text-toolbar.types';
import { alignmentToHJust } from '../../utils/dxf-converter-helpers';
import { attachmentToMTextCode, attachmentToVJust } from '../../utils/dxf-text-converters';
// ADR-737 §11-1 — MTEXT columns: ο marker + ο ΑΝΤΙΣΤΡΟΦΟΣ χάρτης τύπου→code 71 ζουν στον ίδιο
// leaf SSoT με τον importer (`dxf-embedded-object.ts`), ώστε τα δύο άκρα να μη διαφωνήσουν ποτέ.
import {
  EMBEDDED_OBJECT_MARKER, mtextColumnTypeCode, type MTextColumnsData,
} from '../../utils/dxf-embedded-object';
import type { Pair } from './dxf-ascii-hatch-writer';
import { emitAcDbEntity, type EntityR2018 } from './dxf-ascii-primitive-emitters';

const DEFAULT_TEXT_HEIGHT = 0.18; // output units — used if entity has no height.
const DEFAULT_STYLE = 'STANDARD'; // AutoCAD's always-present default text style (no STYLE entry needed).

/** DXF TEXT justification: `h` = code 72 (H), `v` = code 73 (V). */
export interface TextAlign {
  readonly h: 0 | 1 | 2;
  readonly v: 0 | 1 | 2 | 3;
}

/**
 * The DXF text-style NAME (group 7) for a font family. AutoCAD/ezdxf name a synthesized style
 * after its font, so we use the family itself as the style name — the ONE derivation both the
 * emitted group-7 code and the STYLE-table entry share, so they never diverge. Absent / the
 * `Standard` sentinel → `STANDARD` (implicit, no STYLE entry). Round-trips ADR-635 Φ C.5:
 * name → STYLE `fontFile` → `stripExtension` → the same family.
 */
export function textStyleName(fontFamily: string | undefined): string {
  const f = fontFamily?.trim();
  if (!f || f.toUpperCase() === DEFAULT_STYLE) return DEFAULT_STYLE;
  return f;
}

/** ADR-644 (#8) — the Greek-capable TrueType the export falls back to. The AutoCAD SHX `txt`/`txt.shx`
 *  font has NO Greek glyphs → Greek text renders as «?». Arial (Windows-ubiquitous, full Unicode) is
 *  the big-player-safe substitute the diagnosis confirmed («Arial.ttf το έλυσε»). */
export const GREEK_CAPABLE_FONT = 'Arial.ttf';

/**
 * ADR-644 (#8) — resolve a STYLE record's `fontFile` (group 3) to a Greek-capable one. The imported
 * families collapse to the non-Unicode SHX `txt` (→ «?» for Greek); substitute a Unicode TrueType.
 * A real named font (already a `.ttf`/other) is kept verbatim (assume it can render its own script).
 */
export function resolveExportFont(fontFamily: string | undefined): string {
  const f = fontFamily?.trim();
  if (!f || /^(txt|standard)(\.shx)?$/i.test(f)) return GREEK_CAPABLE_FONT;
  return f;
}

/** Read a TEXT/MTEXT entity's first-run font family off its `textNode` (absent → ''). */
export function readTextEntityFamily(e: Entity): string {
  const node = (e as TextEntity | MTextEntity).textNode;
  return node?.paragraphs?.[0]?.runs?.[0] && 'text' in node.paragraphs[0].runs[0]
    ? (node.paragraphs[0].runs[0] as TextRun).style?.fontFamily ?? ''
    : '';
}

/**
 * Read the export justification off a `type:'text'` entity, mirroring the import
 * maps in reverse (`alignmentToHJust` / `attachmentToVJust`). Returns `undefined`
 * for the DXF default (left + baseline) so the writer omits 72/73/11/21 entirely
 * → historic bytes preserved. Vertical comes ONLY from an explicit `textNode`
 * attachment (never the `ensureTextNode` fallback, which would fabricate a
 * middle-left attachment and shift every legacy TEXT).
 */
export function alignFromTextEntity(e: TextEntity): TextAlign | undefined {
  const h = alignmentToHJust(e.alignment);
  const v = e.textNode ? attachmentToVJust(e.textNode.attachment) : 0;
  return h === 0 && v === 0 ? undefined : { h, v };
}

/**
 * Emit a single-line `TEXT`. `align` adds H/V justification (72/73) with the
 * repeated 11/21 alignment point the DXF spec requires once 72/73 are non-zero.
 * Absent/left-baseline `align` → no justification codes (byte-identical legacy).
 */
export function emitText(
  p: Point2D, text: string, height: number | undefined, layer: string, aci: number, s: number, pair: Pair,
  rotationDeg = 0, align?: TextAlign, styleName: string = DEFAULT_STYLE, r2018?: EntityR2018,
): void {
  pair(0, 'TEXT');
  // ADR-644 (#9e) — R2018 TEXT: AcDbEntity common block, then `100 AcDbText`, then a SECOND
  // `100 AcDbText` before the vertical-justification `73` (the AutoCAD two-subclass TEXT quirk).
  if (r2018) { emitAcDbEntity(pair, layer, aci, r2018); pair(100, 'AcDbText'); }
  pair(10, p.x * s); pair(20, p.y * s);
  if (r2018) pair(30, 0);
  pair(40, height != null ? height * s : DEFAULT_TEXT_HEIGHT);
  pair(1, sanitizeText(text));
  pair(50, rotationDeg); // rotation (CCW degrees)
  pair(41, 1);           // width factor
  pair(7, styleName);    // text style (group 7) — round-trips the STYLE table (ADR-636 D.5)
  if (r2018) {
    pair(72, align?.h ?? 0);
    if (align && (align.h !== 0 || align.v !== 0)) { pair(11, p.x * s); pair(21, p.y * s); pair(31, 0); }
    pair(100, 'AcDbText');
    pair(73, align?.v ?? 0);
    return;
  }
  if (align && (align.h !== 0 || align.v !== 0)) {
    // 11/21 == 10/20 on purpose: `p` IS the entity's attachment point (see `text-box.ts`),
    // and once 72/73 are non-zero AutoCAD reads the anchor from 11/21 and ignores 10/20 —
    // so writing the same point to both is correct AND round-trips through the importer's
    // `resolveTextAnchor` (ADR-635 Φ C.25). Do NOT "fix" this into an insertion point.
    pair(72, align.h);
    pair(11, p.x * s); pair(21, p.y * s);
    if (align.v !== 0) pair(73, align.v);
  }
  pair(8, layer);
  pair(62, aci);
}

/**
 * Emit a real `MTEXT` entity (AutoCAD path). The content string — inline `\P`
 * line breaks + `\`/`{`/`}` escaping — is produced by the SSoT serializer, which
 * downgrades to plain TEXT for R12 (no MTEXT before R2000). Height (40) is the
 * character height from the node; width (41) is the reference-rectangle width
 * (0 = no wrap); attachment (71) and rotation (50) come from the node.
 */
export function emitMText(
  e: Entity, layer: string, aci: number, s: number, pair: Pair, version: DxfDocumentVersion,
  r2018?: EntityR2018,
): void {
  const node = ensureTextNode(e as MTextEntity);
  const { content, entityType } = serializeDxfTextNode(node, { version });
  const charHeight = firstRunHeight(node) ?? (e as MTextEntity).fontSize ?? (e as MTextEntity).height;
  // ADR-636 Φ2.4 (D.5) — real group 7 from the node's font (same derivation as the STYLE table).
  const styleName = textStyleName(readTextEntityFamily(e));

  if (entityType === 'TEXT') {
    // R12 downgrade — no MTEXT: emit the (space-joined) content as plain TEXT (style carried). R12 is
    // handle-less/subclass-less, so no r2018 block (the writer gates emitHandles off for R12 anyway).
    emitText((e as MTextEntity).position, content, charHeight, layer, aci, s, pair, node.rotation, undefined, styleName);
    return;
  }

  const width = (e as MTextEntity).width ?? 0;
  pair(0, 'MTEXT');
  // ADR-644 (#9e) — R2018 MTEXT: AcDbEntity common block + `100 AcDbMText` before the data.
  if (r2018) { emitAcDbEntity(pair, layer, aci, r2018); pair(100, 'AcDbMText'); }
  else { pair(8, layer); pair(62, aci); }
  pair(10, (e as MTextEntity).position.x * s); pair(20, (e as MTextEntity).position.y * s); pair(30, 0);
  pair(40, charHeight != null ? charHeight * s : DEFAULT_TEXT_HEIGHT);
  pair(41, width * s);                             // reference rectangle width (0 = no wrap)
  pair(71, attachmentToMTextCode(node.attachment)); // 9-point attachment (1-9)
  pair(7, styleName);
  pair(50, node.rotation);                          // rotation (CCW degrees)
  pair(1, sanitizeText(content));

  // ADR-737 §11-1 — η στηλοποίηση μπαίνει **ΤΕΛΕΥΤΑΙΑ**: το `101` είναι ΤΟΜΗ ΕΝΟΤΗΤΑΣ (ισοδύναμη
  // με `0`/`100`), άρα ό,τι γραφτεί μετά ανήκει στο ενσωματωμένο αντικείμενο και ΟΧΙ στο MTEXT.
  //
  // ΔΙΠΛΗ ΠΥΛΗ — και οι δύο όροι είναι απαραίτητοι:
  //  • `version === R2018`: το embedded object είναι χαρακτηριστικό **R2018+**. Πριν το R2018 οι
  //    στήλες ζούσαν σε XDATA («ACAD» app group)· ένα `101` σε R2000/R2013 αρχείο είναι άκυρο.
  //  • `r2018` (professional path): στο **γυμνό** μονοπάτι ο dispatcher προσθέτει τους κοινούς
  //    STYLE κωδικούς (6/48/370) **ΜΕΤΑ** τον emitter (`STYLE_APPEND_TYPES` περιέχει text/mtext).
  //    Με ανοιχτή ενότητα `101` αυτοί θα κατέληγαν **μέσα** στο ενσωματωμένο αντικείμενο και θα
  //    χάνονταν στην επανεισαγωγή. Στο professional μονοπάτι είναι ήδη διπλωμένοι μέσα στο
  //    `AcDbEntity` block, πριν τη γεωμετρία — άρα δεν γράφεται τίποτα μετά το `101`.
  const columns = (e as TextEntity | MTextEntity).mtextColumns;
  if (columns && r2018 && version === DxfDocumentVersion.R2018) {
    emitMTextColumns(pair, columns, (e as MTextEntity).position, node.rotation, width, s);
  }
}

/**
 * ADR-737 §11-1 — εξαγωγή του **embedded object** των στηλών MTEXT (DXF R2018, group `101`).
 * Σειρά κωδικών κατά ezdxf `MTextColumns.export_embedded_object` (επαληθευμένη και στα
 * «MTEXT Internals» της τεκμηρίωσης ezdxf): 70, 10/20/30, 11/21/31, 40, 41, 42, 43, 71, 72,
 * 44, 45, 73, 74, 46×n.
 *
 * ⚠️ **ΓΙΑΤΙ ΔΕΝ ξαναγράφουμε το ωμό bucket αυτούσιο**: τα ωμά ζεύγη είναι μήκη σε **μονάδες
 * πηγής**, ενώ ΟΛΟ το υπόλοιπο MTEXT εξάγεται πολλαπλασιασμένο με τον canonical-mm συντελεστή
 * `s` (ADR-462) — αυτούσια αντιγραφή ⇒ στήλες σε λάθος κλίμακα μέσα σε σωστά κλιμακωμένη
 * οντότητα. Εδώ το `* s` μπαίνει **μόνο στα μήκη** (40/41/42/43/44/45/46) και **ΠΟΤΕ** στα
 * πλήθη/σημαίες (71/72/73/74) ούτε στο **μοναδιαίο** διάνυσμα κατεύθυνσης (10/20/30).
 *
 * Οι κωδικοί που το ίδιο το embedded object αντιγράφει από τον host (70 flag, 10/20/30 text
 * direction, 11/21/31 insertion point, 40 reference column width) **ξαναπαράγονται από τον
 * host**, σωστά κλιμακωμένοι — δεν κουβαλιούνται ως δεδομένα.
 */
export function emitMTextColumns(
  pair: Pair, columns: MTextColumnsData, position: Point2D, rotationDeg: number,
  referenceWidth: number, s: number,
): void {
  const rad = (rotationDeg * Math.PI) / 180;
  pair(101, EMBEDDED_OBJECT_MARKER);
  pair(70, 1);
  pair(10, Math.cos(rad)); pair(20, Math.sin(rad)); pair(30, 0); // μοναδιαίο → ΧΩΡΙΣ `* s`
  pair(11, position.x * s); pair(21, position.y * s); pair(31, 0);
  pair(40, referenceWidth * s);                     // repeated reference column width
  pair(41, (columns.definedHeight ?? 0) * s);
  pair(42, (columns.totalWidth ?? 0) * s);
  pair(43, (columns.totalHeight ?? 0) * s);
  pair(71, mtextColumnTypeCode(columns.columnType));
  pair(72, columns.count ?? 0);                     // πλήθος — ΧΩΡΙΣ `* s`
  pair(44, (columns.width ?? 0) * s);
  pair(45, (columns.gutterWidth ?? 0) * s);
  pair(73, columns.autoHeight ? 1 : 0);             // σημαία — ΧΩΡΙΣ `* s`
  pair(74, columns.reversedFlow ? 1 : 0);           // σημαία — ΧΩΡΙΣ `* s`
  for (const h of columns.heights ?? []) pair(46, h * s);
}

/** Character height from the first real run of the node (SSoT for MTEXT code 40). */
function firstRunHeight(node: DxfTextNode): number | undefined {
  const run = node.paragraphs[0]?.runs?.[0];
  return run && 'text' in run ? (run as TextRun).style?.height : undefined;
}

/** Collapse hard line breaks — real breaks travel as `\P`, so any stray CR/LF is malformed. */
function sanitizeText(text: string): string {
  return text.replace(/[\r\n]+/g, ' ');
}
