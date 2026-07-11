/**
 * 🏢 ENTERPRISE: DXF MLINE Converter (ADR-635 Φάση B)
 *
 * MLINE (multiline) = N παράλληλες γραμμές ορισμένες από ένα MLINESTYLE object
 * (offsets/caps/line-elements) που ζει στο OBJECTS section, προσβάσιμο μόνο μέσω
 * handle pointer (code 340) — ΔΕΝ αναλύεται σε αυτό το Φάση B MVP.
 *
 * MVP: εξάγουμε τη REFERENCE/κεντρική διαδρομή (vertices 11/21, justification-
 * independent) ως ΕΝΑ `type:'polyline'`. Πλήρες multi-offset rendering (N
 * παράλληλες γραμμές) είναι follow-up εφόσον χρειαστεί MLINESTYLE parsing.
 *
 * ⚠️ Δουλεύει πάνω σε ORDERED `pairs` (ίδιο idiom με HATCH/POLYLINE) — το flat
 * `data` map θα κρατούσε μόνο το ΤΕΛΕΥΤΑΙΟ 11/21 ζεύγος (πολλαπλά vertices).
 *
 * @see AutoCAD DXF Reference: MLINE entity
 * @see dxf-hatch-converter.ts — ίδιο pattern (ordered pairs state machine)
 */

import type { AnySceneEntity } from '../types/scene';
import type { Point2D } from '../rendering/types/Types';
import { extractEntityColor } from './dxf-converter-helpers';
import { dwarn } from '../debug';

type DxfPairs = ReadonlyArray<readonly [string, string]>;

/**
 * Διαβάζει τα vertex-coordinate codes 11/21 (ΟΧΙ 10/20 — αυτά είναι το duplicate
 * "start point" της οντότητας). Codes 12/13/22/23/74/41/75/42 (direction/miter/
 * element params) παρεμβάλλονται ανάμεσα σε διαδοχικά 11/21 ζεύγη αλλά δεν ταιριάζουν
 * στο pattern-match, άρα αγνοούνται φυσικά — ίδιο idiom με parseVerticesFromPairs.
 */
function parseMlineVertices(pairs: DxfPairs): Point2D[] {
  const vertices: Point2D[] = [];
  let pendingX: number | undefined;

  for (const [code, value] of pairs) {
    if (code === '11') {
      const x = parseFloat(value);
      pendingX = Number.isNaN(x) ? undefined : x;
    } else if (code === '21' && pendingX !== undefined) {
      const y = parseFloat(value);
      if (!Number.isNaN(y)) vertices.push({ x: pendingX, y });
      pendingX = undefined;
    }
  }

  return vertices;
}

/**
 * Convert MLINE entity → reference-line `polyline` scene entity (ADR-635 Φάση B MVP).
 * ΔΕΝ αναπαράγει τις N παράλληλες γραμμές του MLINESTYLE (offsets) — follow-up.
 */
export function convertMline(
  pairs: DxfPairs,
  layer: string,
  index: number,
): AnySceneEntity | null {
  const vertices = parseMlineVertices(pairs);

  if (vertices.length < 2) {
    dwarn('EntityConverter', `⚠️ Skipping MLINE ${index}: insufficient vertices (11/21)`, vertices.length);
    return null;
  }

  // 71 bit 2 = closed (ΟΧΙ 70 bit 1 όπως LWPOLYLINE — διαφορετικό bitmask spec).
  const flags71Entry = pairs.find(([code]) => code === '71');
  const flags71 = flags71Entry ? parseInt(flags71Entry[1], 10) || 0 : 0;
  const isClosed = (flags71 & 2) === 2;

  // extractEntityColor διαβάζει flat Record — μετατρέπουμε το πρώτο 62 σε mini-map.
  const colorEntry = pairs.find(([code]) => code === '62');
  const color = colorEntry ? extractEntityColor({ '62': colorEntry[1] }) : undefined;

  return {
    id: `mline_${index}`,
    type: 'polyline',
    layerId: layer,
    visible: true,
    vertices,
    closed: isClosed,
    ...(color && { color }),
  };
}
