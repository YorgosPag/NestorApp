/**
 * ADR-512 (Tekton .TEK export) — BIM → Tekton records mapper (SSoT).
 *
 * Φάση 1: ΤΟΙΧΟΙ (straight). Φάση 2: ΚΟΥΦΩΜΑΤΑ (πόρτες/παράθυρα → nested `<open>`).
 * Κάθε BIM `wall` → ένα `<record>` με xmatrix από το centerline (params.start/end) +
 * πάχος. Κάθε `opening` ομαδοποιείται στον host του (`params.wallId`) και σειριοποιείται
 * στο `<open>` του τοίχου. Έπιπλα/στατικά = επόμενη φάση.
 *
 * Reuse: `mmToMeters`/`buildWallXMatrix`/`buildOpeningPlacement` (tek-geometry) +
 * `buildWallRecordXml`/`buildOpenXml` (tek-xml-writer) + `sceneUnitsToMeters` (SSoT).
 * Μηδέν re-impl μετατροπών.
 */

import type { Entity } from '../../../types/entities';
import { isWallEntity, isOpeningEntity, isFurnitureEntity, isRoofEntity } from '../../../types/entities';
import { isWindowKind } from '../../../bim/types/opening-types';
import type { OpeningEntity } from '../../../bim/types/opening-types';
import type { WallEntity } from '../../../bim/types/wall-types';
import type { SceneUnits } from '../../../utils/scene-units';
import { computeOpeningGeometry } from '../../../bim/geometry/opening-geometry';
import { sceneUnitsToMeters } from '../../../utils/scene-units';
import { extractEntityFootprintRing, extractHeightMm } from '../bim-to-dxf-primitives';
import {
  mmToMeters,
  buildWallXMatrix,
  buildOpeningXMatrix,
  footprintRingToMeters,
} from './tek-geometry';
import { buildWallRecordXml, buildOpenXml, buildPlaneRecordXml } from './tek-xml-writer';
import type { TekOpening, TekPlane } from './tek-types';

export interface TekCollectResult {
  /** Σειριοποιημένα `<record>` τοίχων (join με newline) έτοιμα για injection. */
  readonly wallsXml: string;
  /** Πλήθος τοίχων που εξήχθησαν. */
  readonly wallCount: number;
  /** Πλήθος κουφωμάτων που εξήχθησαν (nested στους τοίχους). */
  readonly openingCount: number;
  /** Παραλείψεις (π.χ. μη-straight τοίχοι, ορφανά κουφώματα). */
  readonly warnings: string[];
}

/** Centerline τοίχου σε μέτρα + πάχος — κοινή πηγή για wall xmatrix ΚΑΙ openings. */
interface WallCenterlineM {
  readonly sx: number;
  readonly sy: number;
  readonly ex: number;
  readonly ey: number;
  readonly thicknessM: number;
}

/** Centerline (μέτρα) ενός straight wall από τα params (scene units → μέτρα). */
function wallCenterlineM(e: Extract<Entity, { type: 'wall' }>): WallCenterlineM {
  const p = e.params;
  const f = sceneUnitsToMeters(p.sceneUnits ?? 'mm');
  return {
    sx: p.start.x * f, sy: p.start.y * f,
    ex: p.end.x * f, ey: p.end.y * f,
    thicknessM: mmToMeters(p.thickness),
  };
}

/**
 * Ένα BIM opening → `TekOpening` πάνω στον host του (μέτρα). Θέση/άξονας από τον SSoT
 * `computeOpeningGeometry` (κέντρο `position` + `rotation`)· εδώ μόνο scene→μέτρα + Tekton xmatrix.
 */
function toTekOpening(
  op: OpeningEntity, hostWall: WallEntity, metersPerSceneUnit: number, index: number,
): TekOpening {
  const p = op.params;
  const geo = computeOpeningGeometry(p, hostWall, hostWall.params.sceneUnits ?? 'mm');
  const centerXm = geo.position.x * metersPerSceneUnit;
  const centerYm = geo.position.y * metersPerSceneUnit;
  const sillM = mmToMeters(p.sillHeight);
  return {
    name: p.mark ?? String(index),
    sillM,
    headM: sillM + mmToMeters(p.height),
    // style: 0=παράθυρο (υαλοπίνακας) / 1=πόρτα (φύλλο) — decoded από το δείγμα.
    style: isWindowKind(p.kind) ? 0 : 1,
    // side 0/1 (μεντεσές/φορά)· cosmetic — από handing (default 0).
    side: p.handing === 'right' ? 1 : 0,
    xmatrix: buildOpeningXMatrix(centerXm, centerYm, geo.rotation, mmToMeters(p.width)),
    txtX: centerXm,
    txtY: centerYm,
  };
}

/**
 * Συλλέγει τους τοίχους + τα κουφώματά τους μιας scope-filtered λίστας entities.
 * Straight τοίχοι μόνο· curved/polyline → warning + skip (DEFER). Κουφώματα ομαδοποιούνται
 * ανά `wallId`· ορφανά (host απών/μη-straight) → warning + skip.
 */
export function collectTekWalls(entities: readonly Entity[]): TekCollectResult {
  const warnings: string[] = [];

  // 1) Group openings ανά host wallId (μία διέλευση).
  const openingsByWall = new Map<string, OpeningEntity[]>();
  for (const e of entities) {
    if (!isOpeningEntity(e)) continue;
    const list = openingsByWall.get(e.params.wallId);
    if (list) list.push(e);
    else openingsByWall.set(e.params.wallId, [e]);
  }
  const hostedWallIds = new Set<string>();

  // 2) Walls → records, με τα κουφώματά τους nested.
  const records: string[] = [];
  let id = 1;
  let openingCount = 0;
  for (const e of entities) {
    if (!isWallEntity(e)) continue;
    if (e.kind !== 'straight') {
      warnings.push(`Τοίχος ${e.id}: ο τύπος "${e.kind}" δεν υποστηρίζεται ακόμη στο .TEK (φάση 2) — παραλείφθηκε.`);
      continue;
    }
    const cl = wallCenterlineM(e);
    const f = sceneUnitsToMeters(e.params.sceneUnits ?? 'mm');
    const hosted = openingsByWall.get(e.id) ?? [];
    if (hosted.length > 0) hostedWallIds.add(e.id);
    const tekOpenings = hosted.map((op, i) => toTekOpening(op, e, f, i + 1));
    openingCount += tekOpenings.length;
    records.push(buildWallRecordXml({
      id,
      name: String(id),
      heightM: mmToMeters(e.params.height),
      elevationM: 0,
      colorHex: '80BCFC',
      xmatrix: buildWallXMatrix(cl.sx, cl.sy, cl.ex, cl.ey, cl.thicknessM),
      openXml: buildOpenXml(tekOpenings),
    }));
    id += 1;
  }

  // 3) Ορφανά κουφώματα (host απών ή μη-straight → δεν μπήκαν πουθενά).
  for (const [wallId, list] of openingsByWall) {
    if (!hostedWallIds.has(wallId)) {
      warnings.push(`${list.length} κούφωμα(τα) με host τοίχο ${wallId} (απών/μη-straight) — παραλείφθηκαν.`);
    }
  }

  return { wallsXml: records.join('\n'), wallCount: records.length, openingCount, warnings };
}

/** Fallback χρώμα plane-κουτιού όταν το entity δεν φέρει δικό του (ίδιο με το δείγμα plane). */
const DEFAULT_PLANE_COLOR = 'BC80FC';

export interface TekPlaneCollectResult {
  /** Serialized record elements (newline-joined) ready for injection into the plane element. */
  readonly planesXml: string;
  /** Πλήθος planes που εξήχθησαν. */
  readonly planeCount: number;
}

/** Scene units ενός BIM entity από τα params (default 'mm'), για το scene→μέτρα. */
function entitySceneUnits(entity: Entity): SceneUnits {
  return (entity as { params?: { sceneUnits?: SceneUnits } }).params?.sceneUnits ?? 'mm';
}

/**
 * Στάθμη βάσης (mm) ενός entity. Έπιπλο = `mountingElevationMm`· στέγη = `basePivotZ`
 * (στάθμη γείσου / eaves datum — από εκεί ξεκινά το επίπεδο footprint). Αλλιώς 0.
 */
function baseElevationMm(entity: Entity): number {
  if (isFurnitureEntity(entity)) return entity.params.mountingElevationMm;
  if (isRoofEntity(entity)) return entity.params.basePivotZ;
  return 0;
}

/**
 * Τύποι που εξάγονται ως flat `<plane>` κουτί (footprint + εξώθηση ύψους μέσω των γενικών
 * extractors): έπιπλα (Φ2b) + στέγη (Φ-A, MVP flat — η κεκλιμένη μορφή θα γίνει `<autoroof>`).
 * Νέος τύπος με cached footprint = +ένα type-guard εδώ, μηδέν άλλη αλλαγή.
 */
function isTekPlaneEntity(entity: Entity): boolean {
  return isFurnitureEntity(entity) || isRoofEntity(entity);
}

/**
 * Ένα BIM entity με footprint → `TekPlane` (κουτί πραγματικού μεγέθους). FULL SSoT reuse των
 * **γενικών export extractors** `extractEntityFootprintRing` + `extractHeightMm` — οι ΙΔΙΟΙ που
 * τρέφουν τον DXF/IFC exporter (μηδέν 2η διαδρομή, μηδέν re-derive). Εδώ μόνο scene→μέτρα:
 * footprint κορυφές + ύψος (εξώθηση `<width>`) + στάθμη (→ pointZ). `null` όταν δεν υπάρχει
 * footprint (path-based). Γενικό: έπιπλα (Φ2b) + structural slabs (Φ3).
 */
function toTekPlane(entity: Entity): TekPlane | null {
  const ring = extractEntityFootprintRing(entity);
  if (!ring) return null;
  const metersPerSceneUnit = sceneUnitsToMeters(entitySceneUnits(entity));
  const elevationM = mmToMeters(baseElevationMm(entity));
  return {
    points: footprintRingToMeters(ring, metersPerSceneUnit, elevationM),
    // Πάχος plane = ύψος entity → ο Τέκτων εξωθεί το footprint προς τα πάνω σε κουτί.
    widthM: mmToMeters(extractHeightMm(entity)),
    // Χρώμα από το ίδιο το entity (SSoT)· fallback στο δείγμα plane όταν λείπει.
    colorHex: (entity as { color?: string }).color ?? DEFAULT_PLANE_COLOR,
  };
}

/**
 * Συλλέγει τα plane-εξαγώγιμα entities (έπιπλα + στέγη) μιας scope-filtered λίστας ως
 * `<plane>` records (κουτιά πραγματικού μεγέθους). Footprint/ύψος μέσω των γενικών export
 * extractors (ίδιοι με DXF) → έτοιμο να επεκταθεί (structural slabs Φ3) προσθέτοντας τύπο
 * στο `isTekPlaneEntity`. Η στέγη εξάγεται flat (MVP)· κεκλιμένη → `<autoroof>` αργότερα.
 */
export function collectTekPlanes(entities: readonly Entity[]): TekPlaneCollectResult {
  const records: string[] = [];
  for (const e of entities) {
    if (!isTekPlaneEntity(e)) continue;
    const plane = toTekPlane(e);
    if (plane) records.push(buildPlaneRecordXml(plane));
  }
  return { planesXml: records.join('\n'), planeCount: records.length };
}
