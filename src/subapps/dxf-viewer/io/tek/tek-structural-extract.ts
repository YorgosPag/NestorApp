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
import type {
  TekDimRecord, TekDimSeg, TekWallRecord, TekOpeningRecord, TekPlaneRecord, TekPillarRecord,
} from './tek-import-types';

const DIM_ENTITY_TYPE = 0;
const WALL_ENTITY_TYPE = 1;
const OPENING_ENTITY_TYPE = 2;
const PLANE_ENTITY_TYPE = 10;

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
      endsColor: childText(record, 'ends_color') ?? '',
      drvColor: childText(record, 'drv_color') ?? '',
      arrowLenM: childNumber(record, 'arrow_len', 0),
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

/**
 * ADR-531 Φ5b.5 — flag `<pillar>1` ⇒ το record είναι **κολώνα/τοιχίο** (ΟΧΙ αρχιτεκτονικός τοίχος).
 * Ο Τέκτων αποθηκεύει κολώνες & τοίχους στο ΙΔΙΟ `<wall>` container (και τα δύο type 1)· η μόνη
 * διάκριση είναι αυτό το flag. `<pillar>0`/απόν = αρχιτεκτονικός τοίχος.
 */
function isPillarRecord(record: Element): boolean {
  return Math.round(childNumber(record, 'pillar', 0)) === 1;
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
    // ADR-531 Φ5b.5 — τα `<pillar>1` records ΔΕΝ είναι τοίχοι· τα χειρίζεται το
    // `extractPillarRecords` → BIM κολώνα/τοιχίο. Χωρίς αυτό, η κολώνα θα εισαγόταν ως
    // στραβός τοίχος (decode wall-centerline από pillar-box matrix).
    if (isPillarRecord(record)) continue;
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

// ─── Pillars (columns / shear walls) ────────────────────────────────────────

/**
 * ADR-531 Φ5b.5 — εξάγει όλες τις **κολώνες/τοιχία** (`<pillar>1` records μέσα στο `<wall>`
 * container, type 1). Reuse `recordsInFloors('wall')` + `isEntityType(1)` (ίδια διαδρομή με τον
 * τοίχο)· φιλτράρει με το `<pillar>` flag. Καθαρή εξαγωγή — η μετατροπή geometry/units/χρώματος
 * + η διάκριση κολώνα↔τοιχίο (σχέση πλευρών) γίνονται στον mapper `tek-pillar-to-column`.
 */
export function extractPillarRecords(root: Element): { pillars: TekPillarRecord[]; warnings: string[] } {
  const pillars: TekPillarRecord[] = [];
  const warnings: string[] = [];
  for (const record of recordsInFloors(root, 'wall')) {
    if (!isEntityType(record, WALL_ENTITY_TYPE)) continue;
    if (!isPillarRecord(record)) continue;
    pillars.push({
      matrix: readXMatrix(record),
      round: Math.round(childNumber(record, 'round', 0)) === 1,
      heightM: childNumber(record, 'height', 0),
      elevationM: childNumber(record, 'elevation', 0),
      color: childText(record, 'color') ?? '',
    });
  }
  return { pillars, warnings };
}

// ─── Slabs (planes) ──────────────────────────────────────────────────────────

/** Εξάγει όλες τις πλάκες (`<plane>` type 10) — footprint polygon + πάχος εξώθησης. */
export function extractPlaneRecords(root: Element): { planes: TekPlaneRecord[]; warnings: string[] } {
  const planes: TekPlaneRecord[] = [];
  const warnings: string[] = [];
  for (const record of recordsInFloors(root, 'plane')) {
    if (!isEntityType(record, PLANE_ENTITY_TYPE)) {
      warnings.push('plane record χωρίς type=10 — παραλείφθηκε.');
      continue;
    }
    const ptContainer = firstChild(record, 'point3d');
    const vertices = ptContainer
      ? directChildren(ptContainer, 'record').map((r) => ({
        x: childNumber(r, 'pointX', 0), y: childNumber(r, 'pointY', 0),
      }))
      : [];
    if (vertices.length < 3) {
      warnings.push('plane record με <3 κορυφές — παραλείφθηκε.');
      continue;
    }
    planes.push({
      vertices,
      widthM: childNumber(record, 'width', 0),
      elevationM: childNumber(record, 'elev1', 0),
      color: childText(record, 'color') ?? '',
    });
  }
  return { planes, warnings };
}
