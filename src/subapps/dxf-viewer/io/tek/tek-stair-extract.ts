/**
 * ADR-526 (Tekton .TEK IMPORT) — εξαγωγή `<stair>` records (entity type 21) → `TekStairRecord`.
 *
 * Δομή στο XML: `tekton > body > floor[] > stair > record[]`. Κάθε stair `<record>` έχει:
 *   - πολλαπλά `<point2d>` (ακμές βαθμίδων + εσωτ./εξωτ. περίγραμμα + γραμμή πορείας),
 *     καθένα με `<record><pX/><pY/></record>` κορυφές (μέτρα, Y προς τα πάνω),
 *   - scalar πεδία ως άμεσα παιδιά (`<start_elevation>`, `<steps>`, `<stair_width>`,
 *     `<horiz_b>` πάτημα, `<vert_b>` ρίχτι, `<slope_h>` μηρός, `<wlength>`, …).
 *
 * Καθαρή εξαγωγή — ΚΑΜΙΑ μετατροπή μονάδων/Y-flip εδώ (γίνεται στον mapper).
 */

import {
  parseTektonXml, directChildren, firstChild, childNumber, childText,
} from './tek-xml-reader';
import type { TekPoint2D, TekStairRecord, TekParseResult } from './tek-import-types';

/** Entity type του `<stair>` record στον Τέκτονα. */
const STAIR_ENTITY_TYPE = 21;

/** Διαβάζει μία `<point2d>` λίστα → κορυφές (μέτρα). Παραλείπει κενές. */
function readPolyline(point2dEl: Element): TekPoint2D[] {
  return directChildren(point2dEl, 'record').map((r) => ({
    x: childNumber(r, 'pX', 0),
    y: childNumber(r, 'pY', 0),
  }));
}

/** Σειριοποιεί ένα Element πίσω σε XML (preserve-and-replay)· native, καμία εξάρτηση (N.5). */
function serializeElement(el: Element): string {
  return typeof XMLSerializer !== 'undefined'
    ? new XMLSerializer().serializeToString(el)
    : el.outerHTML;
}

/** Μετατρέπει ένα stair `<record>` (type 21) → `TekStairRecord`. */
function readStairRecord(record: Element): TekStairRecord {
  const polylines = directChildren(record, 'point2d')
    .map(readPolyline)
    .filter((pl) => pl.length > 0);
  return {
    // Αυθεντικό XML για byte-faithful export (preserve-and-replay, ADR-526 Φ3).
    rawXml: serializeElement(record),
    polylines,
    startElevationM: childNumber(record, 'start_elevation', 0),
    endElevationM: childNumber(record, 'end_elevation', 0),
    steps: Math.round(childNumber(record, 'steps', 0)),
    landings: Math.round(childNumber(record, 'landings', 0)),
    stairWidthM: childNumber(record, 'stair_width', 0),
    treadGoingM: childNumber(record, 'horiz_b', 0),
    riserHeightM: childNumber(record, 'vert_b', 0),
    waistThicknessM: childNumber(record, 'slope_h', 0),
    walklineLengthM: childNumber(record, 'wlength', 0),
    minStepWidthM: childNumber(record, 'min_step_width', 0),
    stepsNumbering: childNumber(record, 'steps_numbering', 0) === 1,
  };
}

/** `true` αν το record είναι έγκυρη σκάλα (type 21 + έχει γεωμετρία). */
function isValidStairRecord(record: Element): boolean {
  return Math.round(childNumber(record, 'type', -1)) === STAIR_ENTITY_TYPE;
}

/**
 * Εξάγει ΟΛΑ τα stair records ενός parsed Tekton root, με σειρά ορόφου. Άδειες
 * `<stair></stair>` ενότητες (όροφοι χωρίς σκάλα) παραλείπονται σιωπηλά.
 */
export function extractStairRecords(root: Element): {
  stairs: TekStairRecord[];
  warnings: string[];
} {
  const stairs: TekStairRecord[] = [];
  const warnings: string[] = [];
  const body = firstChild(root, 'body');
  if (!body) {
    warnings.push('Λείπει το <body> — κανένας όροφος για ανάγνωση.');
    return { stairs, warnings };
  }
  // Οι όροφοι ζουν κάτω από `<building>` (πραγματικά αρχεία)· fallback σε άμεσα παιδιά
  // του body για ανθεκτικότητα σε απλοποιημένες δομές.
  const floorContainer = firstChild(body, 'building') ?? body;
  directChildren(floorContainer, 'floor').forEach((floor, floorIdx) => {
    const stairContainer = firstChild(floor, 'stair');
    if (!stairContainer) return;
    for (const record of directChildren(stairContainer, 'record')) {
      if (!isValidStairRecord(record)) {
        warnings.push(`Όροφος ${floorIdx}: stair record χωρίς type=21 — παραλείφθηκε.`);
        continue;
      }
      const stair = readStairRecord(record);
      if (stair.polylines.length === 0) {
        warnings.push(`Όροφος ${floorIdx}: σκάλα χωρίς γεωμετρία (point2d) — παραλείφθηκε.`);
        continue;
      }
      stairs.push(stair);
    }
  });
  return { stairs, warnings };
}

/**
 * Top-level: parse ολόκληρο `.tek` περιεχόμενο → `TekParseResult` (stair-first scope).
 * Ρίχνει `TekParseError` μόνο αν το XML είναι άκυρο ή δεν είναι Tekton αρχείο.
 */
export function parseTekStairs(content: string): TekParseResult {
  const root = parseTektonXml(content);
  const head = firstChild(root, 'head');
  const { stairs, warnings } = extractStairRecords(root);
  return {
    fileVersion: head ? Math.round(childNumber(head, 'fileversion', NaN)) || null : null,
    tektonVersion: head ? childText(head, 'version') : null,
    floorCount: head ? Math.round(childNumber(head, 'numfloors', 0)) : 0,
    stairs,
    warnings,
  };
}
