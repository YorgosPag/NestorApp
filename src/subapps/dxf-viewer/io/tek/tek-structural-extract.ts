/**
 * ADR-531 Φ5b (Tekton .TEK IMPORT — structural) — εξαγωγή `<dim>` (διάσταση, type 0) και
 * `<wall>` (3Δ τοίχος, type 1) μαζί με τα nested `<open>` ανοίγματα (κούφωμα, type 2).
 *
 * Καθαρή εξαγωγή — ΚΑΜΙΑ μετατροπή μονάδων/Y-flip/χρώματος εδώ (γίνονται στον mapper). Reuse των
 * DOM helpers του `tek-xml-reader` + των floor/record helpers του `tek-primitive-extract`
 * (`recordsInFloors`, `isEntityType`, `readXMatrix`) — ΜΗΔΕΝ διπλότυπο traversal.
 *
 * Ίδια διαδρομή ορόφων με τα line/arc/text: `tekton > body > (building) > floor > [dim|wall] > record`.
 */

import { directChildren, firstChild, childNumber, childText } from './tek-xml-reader';
import { recordsInFloors, isEntityType, readXMatrix } from './tek-primitive-extract';
import type { TekDimRecord, TekDimSeg, TekWallRecord, TekOpeningRecord } from './tek-import-types';

const DIM_ENTITY_TYPE = 0;
const WALL_ENTITY_TYPE = 1;
const OPENING_ENTITY_TYPE = 2;

// ─── Dimensions ────────────────────────────────────────────────────────────────

/** Διαβάζει μία `<seg><record>` πατιά διάστασης → `TekDimSeg`. */
function readDimSeg(seg: Element): TekDimSeg {
  return {
    end0: { x: childNumber(seg, 'end0X', 0), y: childNumber(seg, 'end0Y', 0) },
    end1: { x: childNumber(seg, 'end1X', 0), y: childNumber(seg, 'end1Y', 0) },
    gap0: { x: childNumber(seg, 'gap0X', 0), y: childNumber(seg, 'gap0Y', 0) },
    gap1: { x: childNumber(seg, 'gap1X', 0), y: childNumber(seg, 'gap1Y', 0) },
    text: (childText(seg, 's') ?? '').trim(),
    textMatrix: readXMatrix(seg),
  };
}

/** Extracts all dimensions (dim type 0) — geometry lives in the seg children. */
export function extractDimRecords(root: Element): { dims: TekDimRecord[]; warnings: string[] } {
  const dims: TekDimRecord[] = [];
  const warnings: string[] = [];
  for (const record of recordsInFloors(root, 'dim')) {
    if (!isEntityType(record, DIM_ENTITY_TYPE)) {
      warnings.push('dim record χωρίς type=0 — παραλείφθηκε.');
      continue;
    }
    const segContainer = firstChild(record, 'seg');
    const segs = segContainer ? directChildren(segContainer, 'record').map(readDimSeg) : [];
    if (segs.length === 0) {
      warnings.push('dim record χωρίς <seg> πατιές — παραλείφθηκε.');
      continue;
    }
    const interContainer = firstChild(record, 'inter');
    const refPoints = interContainer
      ? directChildren(interContainer, 'record').map((r) => ({
        x: childNumber(r, 'pX', 0), y: childNumber(r, 'pY', 0),
      }))
      : [];
    dims.push({
      segs,
      color: childText(record, 'color') ?? '',
      dtextColor: childText(record, 'dtext_color') ?? '',
      textSizeM: childNumber(record, 'size', 0),
      endStyle: Math.round(childNumber(record, 'end_style', 0)),
      refPoints,
    });
  }
  return { dims, warnings };
}

// ─── Walls + openings ───────────────────────────────────────────────────────────

/** Διαβάζει ένα `<open><record>` άνοιγμα → `TekOpeningRecord`. */
function readOpening(record: Element): TekOpeningRecord {
  return {
    matrix: readXMatrix(record),
    elevationM: childNumber(record, 'elevation', 0),
    topM: childNumber(record, 'top', 0),
    style: Math.round(childNumber(record, 'style', 0)),
    side: Math.round(childNumber(record, 'side', 0)),
    frameWidthM: childNumber(record, 'frame_width', 0),
    frameThicknessM: childNumber(record, 'frame_thickness', 0),
    jambWidthM: childNumber(record, 'jamb_width', 0),
    jambThicknessM: childNumber(record, 'jamb_thickness', 0),
    ledgeHeightM: childNumber(record, 'ledge_height', 0),
    color: childText(record, 'color') ?? '',
  };
}

/** Τα ανοίγματα (`<open><record>` type 2) ενός wall record. */
function readWallOpenings(wallRecord: Element): TekOpeningRecord[] {
  const openContainer = firstChild(wallRecord, 'open');
  if (!openContainer) return [];
  const out: TekOpeningRecord[] = [];
  for (const record of directChildren(openContainer, 'record')) {
    if (!isEntityType(record, OPENING_ENTITY_TYPE)) continue;
    out.push(readOpening(record));
  }
  return out;
}

/** Εξάγει όλους τους 3Δ τοίχους (`<wall>` type 1) μαζί με τα ανοίγματά τους. */
export function extractWallRecords(root: Element): { walls: TekWallRecord[]; warnings: string[] } {
  const walls: TekWallRecord[] = [];
  const warnings: string[] = [];
  for (const record of recordsInFloors(root, 'wall')) {
    if (!isEntityType(record, WALL_ENTITY_TYPE)) {
      warnings.push('wall record χωρίς type=1 — παραλείφθηκε.');
      continue;
    }
    walls.push({
      matrix: readXMatrix(record),
      heightM: childNumber(record, 'height', 0),
      elevationM: childNumber(record, 'elevation', 0),
      innerWidthM: childNumber(record, 'inner_width', 0),
      color: childText(record, 'color') ?? '',
      openings: readWallOpenings(record),
    });
  }
  return { walls, warnings };
}
