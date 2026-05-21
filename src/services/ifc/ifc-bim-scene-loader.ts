/**
 * IFC4 BIM Scene Loader (ADR-369 §Q8.4)
 *
 * One-shot async loader που:
 *   1. Φορτώνει όλες τις 5 BIM Firestore collections (walls/slabs/beams/
 *      columns/openings) για το active project (one query each).
 *   2. Hydrates Firestore docs → runtime entities (μέσω SSoT
 *      `bim-readonly-hydration.ts`).
 *   3. **Patches** το IfcEntityMixin (ifcGuid + ifcType) όταν λείπει —
 *      Firestore docs που γράφτηκαν πριν το ADR-369 Q8.1 persistence rollout
 *      δεν το μεταφέρουν. ΕΞΥΠΗΡΕΤΕΙ προσωρινό export end-to-end · η σταθερή
 *      lifetime του ifcGuid θα έρθει όταν persist-layer ενημερωθεί.
 *   4. Γκρουπάρει entities per floor μέσω `floorId` / `params.storeyId`.
 *
 * NOT a React hook — έχει async fetch + group, καλείται από EventBus handler.
 */

import { where } from 'firebase/firestore';

import { firestoreQueryService } from '@/services/firestore';
import { generateIfcGuid } from '@/services/enterprise-id-convenience';
import {
  hydrateWall,
  hydrateSlab,
  hydrateBeam,
  hydrateColumn,
  hydrateOpening,
} from '@/components/shared/files/media/bim-readonly-hydration';

import type { WallDoc } from '@/subapps/dxf-viewer/bim/walls/wall-firestore-service';
import type { SlabDoc } from '@/subapps/dxf-viewer/bim/slabs/slab-firestore-service';
import type { BeamDoc } from '@/subapps/dxf-viewer/bim/beams/beam-firestore-service';
import type { ColumnDoc } from '@/subapps/dxf-viewer/bim/columns/column-firestore-service';
import type { OpeningDoc } from '@/subapps/dxf-viewer/bim/walls/opening-firestore-service';

import type { WallEntity } from '@/subapps/dxf-viewer/bim/types/wall-types';
import type { SlabEntity } from '@/subapps/dxf-viewer/bim/types/slab-types';
import type { BeamEntity } from '@/subapps/dxf-viewer/bim/types/beam-types';
import type { ColumnEntity } from '@/subapps/dxf-viewer/bim/types/column-types';
import type { OpeningEntity, OpeningKind } from '@/subapps/dxf-viewer/bim/types/opening-types';
import type { SceneModel, AnySceneEntity } from '@/subapps/dxf-viewer/types/scene';
import type { FloorDocument } from '@/app/api/floors/floors.types';

// ─── Helpers — IFC patching ─────────────────────────────────────────────────

interface IfcDocOverlay {
  readonly ifcGuid?: string;
  readonly ifcType?: string;
  readonly floorId?: string;
  readonly params?: { storeyId?: string };
}

function readIfcGuid(doc: unknown): string {
  return (doc as IfcDocOverlay).ifcGuid ?? generateIfcGuid();
}

function readFloorIdFromDoc(doc: unknown): string | undefined {
  const d = doc as IfcDocOverlay;
  return d.floorId ?? d.params?.storeyId;
}

function inferWallIfcType(kind: string): 'IfcWall' | 'IfcWallStandardCase' {
  return kind === 'straight' ? 'IfcWallStandardCase' : 'IfcWall';
}

function inferOpeningIfcType(kind: OpeningKind): 'IfcDoor' | 'IfcWindow' {
  if (kind === 'window' || kind === 'fixed') return 'IfcWindow';
  return 'IfcDoor';
}

// ─── Per-type patching ──────────────────────────────────────────────────────

function patchWall(doc: WallDoc): WallEntity {
  const base = hydrateWall(doc);
  return {
    ...base,
    ifcGuid: readIfcGuid(doc),
    ifcType: inferWallIfcType(doc.kind),
    floorId: readFloorIdFromDoc(doc),
  } as WallEntity;
}

function patchSlab(doc: SlabDoc): SlabEntity {
  const base = hydrateSlab(doc);
  return {
    ...base,
    ifcGuid: readIfcGuid(doc),
    ifcType: 'IfcSlab',
    floorId: readFloorIdFromDoc(doc),
  } as SlabEntity;
}

function patchBeam(doc: BeamDoc): BeamEntity {
  const base = hydrateBeam(doc);
  return {
    ...base,
    ifcGuid: readIfcGuid(doc),
    ifcType: 'IfcBeam',
    floorId: readFloorIdFromDoc(doc),
  } as BeamEntity;
}

function patchColumn(doc: ColumnDoc): ColumnEntity {
  const base = hydrateColumn(doc);
  return {
    ...base,
    ifcGuid: readIfcGuid(doc),
    ifcType: 'IfcColumn',
    floorId: readFloorIdFromDoc(doc),
  } as ColumnEntity;
}

function patchOpening(doc: OpeningDoc, host: WallEntity | null): OpeningEntity | null {
  const base = hydrateOpening(doc, host);
  if (!base) return null;
  return {
    ...base,
    ifcGuid: readIfcGuid(doc),
    ifcType: inferOpeningIfcType(doc.kind),
    floorId: readFloorIdFromDoc(doc),
  } as OpeningEntity;
}

// ─── Public entry point ─────────────────────────────────────────────────────

export async function loadBimScenesForProject(
  projectId: string,
  floors: readonly FloorDocument[],
): Promise<Map<string, SceneModel>> {
  const opts = { constraints: [where('projectId', '==', projectId)] };

  const [wallsRes, slabsRes, beamsRes, columnsRes, openingsRes] = await Promise.all([
    firestoreQueryService.getAll<WallDoc>('FLOORPLAN_WALLS', opts),
    firestoreQueryService.getAll<SlabDoc>('FLOORPLAN_SLABS', opts),
    firestoreQueryService.getAll<BeamDoc>('FLOORPLAN_BEAMS', opts),
    firestoreQueryService.getAll<ColumnDoc>('FLOORPLAN_COLUMNS', opts),
    firestoreQueryService.getAll<OpeningDoc>('FLOORPLAN_OPENINGS', opts),
  ]);

  const walls = wallsRes.documents.map(patchWall);
  const wallById = new Map<string, WallEntity>(walls.map((w) => [w.id, w]));
  const slabs = slabsRes.documents.map(patchSlab);
  const beams = beamsRes.documents.map(patchBeam);
  const columns = columnsRes.documents.map(patchColumn);
  const openings = openingsRes.documents
    .map((d) => patchOpening(d, wallById.get(d.params.wallId) ?? null))
    .filter((o): o is OpeningEntity => o !== null);

  return groupByFloor(floors, walls, slabs, beams, columns, openings);
}

// ─── Grouping ───────────────────────────────────────────────────────────────

function groupByFloor(
  floors: readonly FloorDocument[],
  walls: readonly WallEntity[],
  slabs: readonly SlabEntity[],
  beams: readonly BeamEntity[],
  columns: readonly ColumnEntity[],
  openings: readonly OpeningEntity[],
): Map<string, SceneModel> {
  const scenes = new Map<string, SceneModel>();
  for (const floor of floors) {
    const fid = floor.id;
    const entities: AnySceneEntity[] = [];
    for (const w of walls) if (w.floorId === fid) entities.push(w);
    for (const s of slabs) if (s.floorId === fid) entities.push(s);
    for (const b of beams) if (b.floorId === fid) entities.push(b);
    for (const c of columns) if (c.floorId === fid) entities.push(c);
    for (const o of openings) if (o.floorId === fid) entities.push(o);
    if (entities.length === 0) continue;
    scenes.set(fid, {
      entities,
      layersById: { lyr_default: { id: 'lyr_default', name: 'default' } },
      bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
      units: 'mm',
    } as unknown as SceneModel);
  }
  return scenes;
}
