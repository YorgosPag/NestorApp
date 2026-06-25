/**
 * ADR-526 Φ5a (Tekton .TEK IMPORT) — top-level scene parser (facade).
 *
 * Parse-once ολόκληρο `.tek` περιεχόμενο → `TekSceneParseResult` (σκάλες + 2Δ primitives).
 * Ορχηστρώνει τους ανεξάρτητους extractors χωρίς να διπλασιάζει το XML parse: ο **stair**
 * extractor (Φ1) μένει 100% ανέπαφος· οι line/arc extractors (Φ5a) προστίθενται additive.
 * Επόμενες φάσεις (Φ5b: walls/openings/slabs/roofs) συνδέονται ΕΔΩ, στο ίδιο root.
 */

import { parseTektonXml } from './tek-xml-reader';
import { extractStairRecords, extractTekHead } from './tek-stair-extract';
import {
  extractLineRecords, extractArcRecords, extractTextRecords,
} from './tek-primitive-extract';
import type { TekSceneParseResult } from './tek-import-types';

/**
 * Parse `.tek` περιεχόμενο → `TekSceneParseResult`. Ρίχνει `TekParseError` μόνο αν το XML
 * είναι άκυρο ή δεν είναι Tekton αρχείο (ίδια συμπεριφορά με `parseTekStairs`).
 */
export function parseTekScene(content: string): TekSceneParseResult {
  const root = parseTektonXml(content);
  const { stairs, warnings: stairWarnings } = extractStairRecords(root);
  const { lines, warnings: lineWarnings } = extractLineRecords(root);
  const { arcs, warnings: arcWarnings } = extractArcRecords(root);
  const { texts, warnings: textWarnings } = extractTextRecords(root);
  return {
    ...extractTekHead(root),
    stairs,
    lines,
    arcs,
    texts,
    warnings: [...stairWarnings, ...lineWarnings, ...arcWarnings, ...textWarnings],
  };
}
