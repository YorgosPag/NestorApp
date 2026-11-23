/**
 * @fileoverview **DXF drawing → its text labels with their plan position** (ADR-920 Β6.11 Ζ1).
 * @related ./dxf-polylines (the outlines these labels name) · ./dxf-ocs · ./dxf-section-scan
 *
 * A surveyor letters the corners of the plot (Α, Β, Γ … or 1, 2, 3 …) with TEXT placed next to each vertex. Those
 * letters are evidence that a closed polyline IS the plot outline, so the owner's import needs them — outside the
 * DXF Viewer (CHECK 3.62).
 *
 *   TEXT  → 1 = the string · 10/20/30 = insertion (OCS) · 11/21/31 = alignment point (OCS), used when 72/73 ≠ 0 ·
 *           210/220/230 extrusion
 *   MTEXT → 1 (+ 3 chunks) = the string · 10/20/30 = insertion (WCS — MTEXT is not an OCS entity, see `dxf-ocs`)
 *
 * ⚠️ **MTEXT with formatting codes is NOT read here — it is counted.** Its content is a markup (`\P`, `{\f…;…}`,
 * format runs that split one number across three pieces); decoding it with a regex reads the first piece and loses
 * the rest, silently (ADR-745 §2.3 Παγίδα Α). The decoder lives in the viewer (`mtextToSegments`). A plain MTEXT
 * (no `\` and no `{`) IS its text, so it is read; a formatted one adds to `formattedMtextSkipped`, so a caller can tell
 * «no labels» from «labels I could not read».
 *
 * Only the ENTITIES section is scanned (BLOCK definitions are templates, ADR-635 Φ2). Positions in DRAWING units.
 */

import type { PlanarPoint } from '@/lib/geometry/planar-polygon';

import { isEmbeddedObjectCode, ownFirstTags } from './dxf-embedded-object';
import { splitDxfLines } from './dxf-line-stream';
import { dxfOcsToWcs, dxfRealOr, readDxfExtrusion } from './dxf-ocs';
import { collectDxfRecordPairs, findDxfSectionRange, type DxfCodePair } from './dxf-section-scan';

export interface DxfTextLabel {
  /** The text exactly as written (no homoglyph folding — that belongs to whoever interprets it). */
  readonly text: string;
  /** Plan (WCS) anchor of the text, DRAWING units. */
  readonly at: PlanarPoint;
  readonly layer: string;
}

export interface DxfTextLabelScan {
  readonly labels: readonly DxfTextLabel[];
  /** MTEXT entities whose content carries formatting codes — not decoded here (see the file header). */
  readonly formattedMtextSkipped: number;
}

/** The point the writer anchored the text to: the alignment point when TEXT is justified (72/73 ≠ 0), else 10/20. */
function textAnchorOcs(tags: Record<string, string>): { x: number; y: number; z: number } {
  const justified = dxfRealOr(tags['72'], 0) !== 0 || dxfRealOr(tags['73'], 0) !== 0;
  const hasAlignment = tags['11'] !== undefined && tags['21'] !== undefined;
  const [cx, cy, cz] = justified && hasAlignment ? ['11', '21', '31'] : ['10', '20', '30'];
  return { x: dxfRealOr(tags[cx], Number.NaN), y: dxfRealOr(tags[cy], Number.NaN), z: dxfRealOr(tags[cz], 0) };
}

function textLabelOf(tags: Record<string, string>): DxfTextLabel | null {
  const text = tags['1'] ?? '';
  const ocs = textAnchorOcs(tags);
  if (text.trim() === '' || !Number.isFinite(ocs.x) || !Number.isFinite(ocs.y)) return null;
  const wcs = dxfOcsToWcs(ocs, readDxfExtrusion(tags));
  return { text, at: { x: wcs.x, y: wcs.y }, layer: tags['8'] || '0' };
}

/** MTEXT content = the `3` chunks in order, then the final `1` (DXF Reference, «MTEXT»). */
function mtextContentOf(pairs: readonly DxfCodePair[]): string {
  const chunks: string[] = [];
  let last = '';
  for (const [code, value] of pairs) {
    if (isEmbeddedObjectCode(code)) break;
    if (code === '3') chunks.push(value);
    else if (code === '1') last = value;
  }
  return chunks.join('') + last;
}

const MTEXT_MARKUP = /[\\{}]/;

function mtextLabelOf(pairs: readonly DxfCodePair[]): DxfTextLabel | 'formatted' | null {
  const text = mtextContentOf(pairs);
  if (MTEXT_MARKUP.test(text)) return 'formatted';
  const tags = ownFirstTags(pairs);
  const x = dxfRealOr(tags['10'], Number.NaN);
  const y = dxfRealOr(tags['20'], Number.NaN);
  if (text.trim() === '' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { text, at: { x, y }, layer: tags['8'] || '0' };
}

/** Scan raw DXF text for its TEXT / plain MTEXT labels. Never throws. */
export function scanDxfTextLabels(text: string): DxfTextLabelScan {
  const lines = splitDxfLines(text);
  const range = findDxfSectionRange(lines, 'ENTITIES') ?? { start: 0, end: lines.length };
  const labels: DxfTextLabel[] = [];
  let formattedMtextSkipped = 0;

  for (let i = range.start; i < range.end; ) {
    const kind = lines[i]?.trim() === '0' ? lines[i + 1]?.trim() : undefined;
    if (kind !== 'TEXT' && kind !== 'MTEXT') { i += 2; continue; }
    const { pairs, next } = collectDxfRecordPairs(lines, i + 2, range.end);
    const label = kind === 'TEXT' ? textLabelOf(ownFirstTags(pairs)) : mtextLabelOf(pairs);
    if (label === 'formatted') formattedMtextSkipped++;
    else if (label) labels.push(label);
    i = next;
  }

  return { labels, formattedMtextSkipped };
}
