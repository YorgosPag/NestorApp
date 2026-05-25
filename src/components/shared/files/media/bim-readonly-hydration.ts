/**
 * ADR-370 — Pure hydration of BIM Firestore docs → scene entities for read-only render.
 *
 * Mirrors `docToEntity` pattern from `useXxxPersistence` hooks, without the
 * persistence/dirty-tracking machinery. Geometry is recomputed via SSoT
 * `computeXxxGeometry()` functions when not stored.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-370-bim-readonly-visualization.md
 */

import { nowTimestamp } from '@/lib/firestore-now';
import { computeWallGeometry } from '@/subapps/dxf-viewer/bim/geometry/wall-geometry';
import { computeSlabGeometry } from '@/subapps/dxf-viewer/bim/geometry/slab-geometry';
import { computeBeamGeometry } from '@/subapps/dxf-viewer/bim/geometry/beam-geometry';
import { computeColumnGeometry } from '@/subapps/dxf-viewer/bim/geometry/column-geometry';
import { computeOpeningGeometry } from '@/subapps/dxf-viewer/bim/geometry/opening-geometry';
import { computeSlabOpeningGeometry } from '@/subapps/dxf-viewer/bim/geometry/slab-opening-geometry';
import { computeStairGeometry } from '@/subapps/dxf-viewer/bim/geometry/stairs/StairGeometryService';
import { validateWallParams } from '@/subapps/dxf-viewer/bim/validators/wall-validator';
import { validateSlabParams } from '@/subapps/dxf-viewer/bim/validators/slab-validator';
import { validateBeamParams } from '@/subapps/dxf-viewer/bim/validators/beam-validator';
import { validateColumnParams } from '@/subapps/dxf-viewer/bim/validators/column-validator';
import { validateOpeningParams } from '@/subapps/dxf-viewer/bim/validators/opening-validator';
import { validateSlabOpeningParams } from '@/subapps/dxf-viewer/bim/validators/slab-opening-validator';

import type { WallDoc } from '@/subapps/dxf-viewer/bim/walls/wall-firestore-service';
import type { SlabDoc } from '@/subapps/dxf-viewer/bim/slabs/slab-firestore-service';
import type { BeamDoc } from '@/subapps/dxf-viewer/bim/beams/beam-firestore-service';
import type { ColumnDoc } from '@/subapps/dxf-viewer/bim/columns/column-firestore-service';
import type { OpeningDoc } from '@/subapps/dxf-viewer/bim/walls/opening-firestore-service';
import type { SlabOpeningDoc } from '@/subapps/dxf-viewer/bim/slab-openings/slab-opening-firestore-service';

import type { WallEntity, WallParams } from '@/subapps/dxf-viewer/bim/types/wall-types';
import type { SlabEntity } from '@/subapps/dxf-viewer/bim/types/slab-types';
import type { BeamEntity } from '@/subapps/dxf-viewer/bim/types/beam-types';
import type { ColumnEntity } from '@/subapps/dxf-viewer/bim/types/column-types';
import type { OpeningEntity } from '@/subapps/dxf-viewer/bim/types/opening-types';
import type { SlabOpeningEntity } from '@/subapps/dxf-viewer/bim/types/slab-opening-types';
import type {
  StairDoc,
  StairEntity,
  StairParams,
  StairValidationState,
} from '@/subapps/dxf-viewer/bim/types/stair-types';

function migrateWallParamsToMm(params: WallParams): WallParams {
  if (params.sceneUnits) return params;
  if (params.height >= 100) return { ...params, sceneUnits: 'mm' };
  const k = 1000;
  return {
    ...params,
    height: params.height * k,
    thickness: params.thickness * k,
    dna: params.dna
      ? {
          ...params.dna,
          totalThickness: params.dna.totalThickness * k,
          layers: params.dna.layers.map((l) => ({ ...l, thickness: l.thickness * k })),
        }
      : undefined,
    sceneUnits: 'mm',
  };
}

export function hydrateWall(doc: WallDoc): WallEntity {
  const params = migrateWallParamsToMm(doc.params);
  const validation = doc.validation ?? validateWallParams(params).bimValidation;
  return {
    id: doc.id,
    type: 'wall',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params,
    geometry: doc.geometry ?? computeWallGeometry(params, doc.kind),
    validation,
    visible: true,
    editingBy: doc.editingBy,
  } as WallEntity;
}

export function hydrateSlab(doc: SlabDoc): SlabEntity {
  const validation = doc.validation ?? validateSlabParams(doc.params).bimValidation;
  return {
    id: doc.id,
    type: 'slab',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: computeSlabGeometry(doc.params),
    validation,
    visible: true,
  } as SlabEntity;
}

export function hydrateBeam(doc: BeamDoc): BeamEntity {
  const validation = doc.validation ?? validateBeamParams(doc.params).bimValidation;
  return {
    id: doc.id,
    type: 'beam',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeBeamGeometry(doc.params),
    validation,
    visible: true,
  } as BeamEntity;
}

export function hydrateColumn(doc: ColumnDoc): ColumnEntity {
  const validation = doc.validation ?? validateColumnParams(doc.params).bimValidation;
  return {
    id: doc.id,
    type: 'column',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeColumnGeometry(doc.params),
    validation,
    visible: true,
  } as ColumnEntity;
}

export function hydrateOpening(doc: OpeningDoc, hostWall: WallEntity | null): OpeningEntity | null {
  if (!hostWall) return null;
  const validation = doc.validation ?? validateOpeningParams(doc.params, hostWall).bimValidation;
  return {
    id: doc.id,
    type: 'opening',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeOpeningGeometry(doc.params, hostWall, hostWall.params.sceneUnits ?? 'mm'),
    validation,
    visible: true,
  } as OpeningEntity;
}

export function hydrateSlabOpening(doc: SlabOpeningDoc): SlabOpeningEntity {
  const validation = doc.validation ?? validateSlabOpeningParams(doc.params, null).bimValidation;
  return {
    id: doc.id,
    type: 'slab-opening',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeSlabOpeningGeometry(doc.params),
    validation,
    visible: true,
  } as SlabOpeningEntity;
}

// Mirrors `use-stair-persistence.hydrateLegacyParams` (private). ADR-358 Phase 3f/3g
// back-compat: legacy l-shape without cornerStyle → 'landing'; nokSubType 'secondary' → 'low-rise'.
function hydrateLegacyStairParams(params: StairParams): StairParams {
  let out: StairParams = params;
  const v = out.variant;
  if (v.kind === 'l-shape' && (v as { cornerStyle?: string }).cornerStyle === undefined) {
    out = { ...out, variant: { ...v, cornerStyle: 'landing' } as typeof v };
  }
  if (out.nokSubType === 'secondary') {
    out = { ...out, nokSubType: 'low-rise' };
  }
  return out;
}

export function hydrateStair(doc: StairDoc): StairEntity {
  const params = hydrateLegacyStairParams(doc.params);
  const validation: StairValidationState = doc.validation ?? {
    hasCodeViolations: false,
    violationKeys: [],
    lastValidatedAt: nowTimestamp(),
  };
  return {
    id: doc.id,
    type: 'stair',
    kind: doc.kind,
    params,
    geometry: doc.geometry ?? computeStairGeometry(params),
    validation,
    layerId: doc.layer ?? 'STAIRS',
    levelId: doc.levelId,
    floorId: doc.floorId,
    buildingId: doc.buildingId,
    visible: true,
    editingBy: doc.editingBy,
    qto: doc.qto,
  } as StairEntity;
}
