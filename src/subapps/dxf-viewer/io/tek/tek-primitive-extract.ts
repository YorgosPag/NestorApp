/**
 * ADR-526 Φ5a (Tekton .TEK IMPORT — 2Δ primitives) — εξαγωγή `<line>` (type 4) και
 * `<arc>` (type 5) records → ενδιάμεσα `TekLineRecord`/`TekArcRecord`.
 *
 * Καθρέφτης (read-side) του export `LINE_RECORD_TEMPLATE`/`ARC_RECORD_TEMPLATE`. Καθαρή
 * εξαγωγή — ΚΑΜΙΑ μετατροπή μονάδων/Y-flip/χρώματος εδώ (γίνονται στον mapper). Reuse των
 * DOM helpers του `tek-xml-reader` (SSoT) + ίδια διαδρομή ορόφων με τον stair extractor:
 *   `tekton > body > (building) > floor > [line|arc] > record`.
 */

import {
  directChildren, firstChild, childNumber, childText,
} from './tek-xml-reader';
import type { TekLineRecord, TekArcRecord } from './tek-import-types';

const LINE_ENTITY_TYPE = 4;
const ARC_ENTITY_TYPE = 5;

/** Floors container: floors live under the building element (fallback to body). */
function floorContainerOf(root: Element): Element | null {
  const body = firstChild(root, 'body');
  if (!body) return null;
  return firstChild(body, 'building') ?? body;
}

/** Όλα τα `<record>` ενός δοσμένου container-tag (π.χ. 'line'/'arc') σε όλους τους ορόφους. */
function recordsInFloors(root: Element, containerTag: string): Element[] {
  const floorContainer = floorContainerOf(root);
  if (!floorContainer) return [];
  const out: Element[] = [];
  for (const floor of directChildren(floorContainer, 'floor')) {
    const container = firstChild(floor, containerTag);
    if (!container) continue;
    out.push(...directChildren(container, 'record'));
  }
  return out;
}

/** `true` αν το record έχει την αναμενόμενη 1η `<type>` (entity type, ΟΧΙ το nested line-style). */
function isEntityType(record: Element, expected: number): boolean {
  return Math.round(childNumber(record, 'type', -1)) === expected;
}

/** Εξάγει όλα τα `<line>` records (type 4). */
export function extractLineRecords(root: Element): { lines: TekLineRecord[]; warnings: string[] } {
  const lines: TekLineRecord[] = [];
  const warnings: string[] = [];
  for (const record of recordsInFloors(root, 'line')) {
    if (!isEntityType(record, LINE_ENTITY_TYPE)) {
      warnings.push('line record χωρίς type=4 — παραλείφθηκε.');
      continue;
    }
    lines.push({
      v0x: childNumber(record, 'v0X', 0),
      v0y: childNumber(record, 'v0Y', 0),
      v1x: childNumber(record, 'v1X', 0),
      v1y: childNumber(record, 'v1Y', 0),
      color: childText(record, 'color') ?? '',
    });
  }
  return { lines, warnings };
}

/** Εξάγει όλα τα `<arc>` records (type 5) — τόξα ΚΑΙ κύκλοι. */
export function extractArcRecords(root: Element): { arcs: TekArcRecord[]; warnings: string[] } {
  const arcs: TekArcRecord[] = [];
  const warnings: string[] = [];
  for (const record of recordsInFloors(root, 'arc')) {
    if (!isEntityType(record, ARC_ENTITY_TYPE)) {
      warnings.push('arc record χωρίς type=5 — παραλείφθηκε.');
      continue;
    }
    arcs.push({
      isCircle: Math.round(childNumber(record, 'circle', 0)) === 1,
      centreX: childNumber(record, 'centreX', 0),
      centreY: childNumber(record, 'centreY', 0),
      p0x: childNumber(record, 'p0X', 0),
      p0y: childNumber(record, 'p0Y', 0),
      p1x: childNumber(record, 'p1X', 0),
      p1y: childNumber(record, 'p1Y', 0),
      color: childText(record, 'color') ?? '',
    });
  }
  return { arcs, warnings };
}
