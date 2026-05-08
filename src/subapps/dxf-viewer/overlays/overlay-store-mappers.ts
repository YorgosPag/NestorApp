/**
 * 🔷 OVERLAY STORE MAPPERS (ADR-340 Phase 9 STEP G)
 *
 * Pure helpers translating between the multi-kind SSoT shape
 * (`FloorplanOverlay` from src/types/floorplan-overlays.ts, exposed by
 * `useFloorOverlays`) and the legacy DXF Viewer `Overlay` shape consumed by
 * 33 callers across the subapp.
 *
 * The DXF Viewer overlay store is layering-only — it manages closed polygons
 * with a semantic role (`property`/`parking`/`storage`/`footprint`). Other
 * geometric kinds (line/circle/arc/measurement/text) are persisted via
 * `completeEntity({ persistToOverlays })` and never enter this store.
 *
 * Therefore: legacy `Overlay.polygon` ⇄ new `geometry.vertices` (closed:true);
 * legacy `Overlay.kind` ⇄ new `role`; style and linked fields are 1:1.
 */

import type { Point2D as DxfPoint2D } from '../rendering/types/Types';
import type {
  CreateFloorplanOverlayPayload,
  UpdateFloorplanOverlayPayload,
  UpsertFloorplanOverlayPayload,
} from '@/services/floorplan-overlay-mutation-gateway';
import type {
  FloorplanOverlay,
  OverlayGeometry,
  OverlayLinked,
  OverlayRole,
  OverlayStyle as SsotOverlayStyle,
} from '@/types/floorplan-overlays';
import type { FloorOverlayItem } from '@/hooks/useFloorOverlays';
import type { Overlay, OverlayKind, OverlayStyle, Status, UpdateOverlayData } from './types';

// ─── Internal: only the 4 layering roles map back to OverlayKind ──────────────

const KIND_TO_ROLE: Record<OverlayKind, OverlayRole> = {
  property:  'property',
  parking:   'parking',
  storage:   'storage',
  footprint: 'footprint',
};

const ROLE_TO_KIND: Partial<Record<OverlayRole, OverlayKind>> = {
  property:  'property',
  parking:   'parking',
  storage:   'storage',
  footprint: 'footprint',
};

export function kindToRole(kind: OverlayKind): OverlayRole {
  return KIND_TO_ROLE[kind];
}

export function roleToKind(role: OverlayRole): OverlayKind | null {
  return ROLE_TO_KIND[role] ?? null;
}

// ─── Geometry ⇄ polygon helpers ───────────────────────────────────────────────

export function tupleArrayToVertices(
  polygon: ReadonlyArray<readonly [number, number]>,
): DxfPoint2D[] {
  return polygon.map(([x, y]) => ({ x, y }));
}

export function verticesToTupleArray(
  vertices: ReadonlyArray<DxfPoint2D>,
): Array<[number, number]> {
  return vertices.map(({ x, y }) => [x, y] as [number, number]);
}

export function polygonGeometryFromTuples(
  polygon: ReadonlyArray<readonly [number, number]>,
): OverlayGeometry {
  return {
    type: 'polygon',
    vertices: tupleArrayToVertices(polygon),
    closed: true,
  };
}

// ─── Style ⇄ legacy style ─────────────────────────────────────────────────────

export function ssotStyleToLegacy(style: SsotOverlayStyle | undefined): OverlayStyle | undefined {
  if (!style) return undefined;
  return {
    ...(style.stroke !== undefined ? { stroke: style.stroke } : {}),
    ...(style.fill !== undefined ? { fill: style.fill } : {}),
    ...(style.strokeWidth !== undefined ? { lineWidth: style.strokeWidth } : {}),
    ...(style.opacity !== undefined ? { opacity: style.opacity } : {}),
  };
}

export function legacyStyleToSsot(style: OverlayStyle | undefined): SsotOverlayStyle | undefined {
  if (!style) return undefined;
  return {
    ...(style.stroke !== undefined ? { stroke: style.stroke } : {}),
    ...(style.fill !== undefined ? { fill: style.fill } : {}),
    ...(style.lineWidth !== undefined ? { strokeWidth: style.lineWidth } : {}),
    ...(style.opacity !== undefined ? { opacity: style.opacity } : {}),
  };
}

// ─── Read mapper: FloorOverlayItem → legacy Overlay ───────────────────────────

function toMillis(ts: FloorplanOverlay['createdAt']): number {
  if (typeof ts === 'number') return ts;
  if (ts && typeof ts === 'object' && typeof (ts as { toMillis?: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return 0;
}

/**
 * Project a multi-kind read item back onto the legacy `Overlay` shape that
 * 33 DXF Viewer files still consume. Synthesizes `levelId` from the active
 * level — callers using `overlay.levelId` for routing get the right value
 * because the store only ever exposes overlays for the current floor/level.
 */
export function floorItemToLegacyOverlay(
  item: FloorOverlayItem,
  levelId: string,
): Overlay | null {
  if (item.geometry.type !== 'polygon') {
    return null;
  }
  const kind = roleToKind(item.role);
  if (!kind) {
    return null;
  }
  return {
    id: item.id,
    levelId,
    kind,
    polygon: verticesToTupleArray(item.geometry.vertices),
    ...(item.status ? { status: item.status as Status } : {}),
    ...(item.label !== undefined ? { label: item.label } : {}),
    ...(item.linked ? { linked: { ...item.linked } } : {}),
    ...(ssotStyleToLegacy(item.style) ? { style: ssotStyleToLegacy(item.style) } : {}),
    createdAt: toMillis(item.createdAt),
    updatedAt: toMillis(item.updatedAt),
    createdBy: item.createdBy,
  };
}

// ─── Write mappers: legacy data → gateway payloads ────────────────────────────

export interface CreatePayloadContext {
  backgroundId: string;
  floorId: string;
}

export function buildCreatePayload(
  data: { kind: OverlayKind; polygon: Array<[number, number]>; label?: string; linked?: OverlayLinked; style?: OverlayStyle },
  ctx: CreatePayloadContext,
): CreateFloorplanOverlayPayload {
  return {
    backgroundId: ctx.backgroundId,
    floorId: ctx.floorId,
    geometry: polygonGeometryFromTuples(data.polygon),
    role: kindToRole(data.kind),
    ...(data.linked ? { linked: data.linked } : {}),
    ...(data.label !== undefined ? { label: data.label } : {}),
    ...(legacyStyleToSsot(data.style) ? { style: legacyStyleToSsot(data.style) as SsotOverlayStyle } : {}),
  };
}

export function buildUpdatePayload(
  overlayId: string,
  patch: UpdateOverlayData,
): UpdateFloorplanOverlayPayload {
  const out: UpdateFloorplanOverlayPayload = { overlayId };
  if (patch.polygon !== undefined) {
    out.geometry = polygonGeometryFromTuples(patch.polygon);
  }
  if (patch.kind !== undefined) {
    out.role = kindToRole(patch.kind);
  }
  if (patch.label !== undefined) {
    out.label = patch.label;
  }
  if (patch.linked === null) {
    out.linked = null;
  } else if (patch.linked !== undefined) {
    out.linked = patch.linked;
  }
  if (patch.style !== undefined) {
    const ssot = legacyStyleToSsot(patch.style);
    if (ssot) out.style = ssot;
  }
  return out;
}

export function buildUpsertPayload(
  overlay: Overlay,
  ctx: CreatePayloadContext,
): UpsertFloorplanOverlayPayload {
  return {
    overlayId: overlay.id,
    backgroundId: ctx.backgroundId,
    floorId: ctx.floorId,
    geometry: polygonGeometryFromTuples(overlay.polygon),
    role: kindToRole(overlay.kind),
    ...(overlay.linked ? { linked: overlay.linked } : {}),
    ...(overlay.label !== undefined ? { label: overlay.label } : {}),
    ...(legacyStyleToSsot(overlay.style) ? { style: legacyStyleToSsot(overlay.style) as SsotOverlayStyle } : {}),
    ...(typeof overlay.createdAt === 'number' ? { createdAtMs: overlay.createdAt } : {}),
    ...(overlay.createdBy ? { createdBy: overlay.createdBy } : {}),
  };
}
