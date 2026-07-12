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
    // Alignment point (11/21) mirrors the insertion point; 73 only when non-baseline.
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
