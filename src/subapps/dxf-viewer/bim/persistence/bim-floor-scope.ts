'use client';

/**
 * ADR-420 — BIM floor-scope SSoT.
 *
 * Single source of truth for how EVERY BIM entity (`floorplan_walls`,
 * `floorplan_slabs`, `floorplan_columns`, … all 20 collections) is scoped to a
 * floor in Firestore.
 *
 * ## The problem this solves
 * Historically all BIM persistence services queried `where('floorplanId','==',
 * fileRecordId)`. `floorplanId` === `levelManager.fileRecordId` — the cadFiles
 * id of the *currently loaded DXF file*, which is **regenerated on every
 * re-import**. So re-importing a floor's plan orphaned every wall/slab/column
 * already drawn on that floor (the subscription pointed at the new, empty file
 * id). See ADR-420 root-cause analysis.
 *
 * ## The fix — stable identity key
 * BIM entities are scoped to the **building storey id** (`floorId`, `flr_*` =
 * IfcBuildingStorey). Unlike `floorplanId` (volatile file id) and `layerId`/
 * `levelId` (volatile DXF-viewer level id, regenerated on level delete+
 * recreate), `floorId` is a durable building-management identity that survives
 * re-import, file re-upload and level recreation (ADR-179 IFC hierarchy,
 * ADR-399 floor tabs).
 *
 * `floorplanId` is still written on every doc — but only as **provenance**
 * (which physical DXF file the entity came from), never again as the scope key.
 *
 * ## Fallback
 * Project / building-level canvases have no `floorId` (they are not storeys and
 * are not re-imported per-floor). For those the legacy `floorplanId` key is
 * used — `resolveBimScope` degrades gracefully so non-floor canvases keep
 * working unchanged.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-420-bim-floor-scope-ssot.md
 * @see docs/centralized-systems/reference/adrs/ADR-355-realtime-subscription-ssot-consolidation.md
 */

import { where, type QueryConstraint } from 'firebase/firestore';

/**
 * The minimal scope inputs every BIM `*FirestoreServiceConfig` must carry.
 * `floorId` is optional: present on floor-level canvases (the common case),
 * absent on project/building-level canvases (legacy `floorplanId` fallback).
 */
export interface BimScopeConfig {
  readonly projectId: string;
  /** Provenance — the source DXF FileRecord id. Always stored, never the scope key (when floorId exists). */
  readonly floorplanId: string;
  /** Stable building-storey id (`flr_*`, IfcBuildingStorey). The preferred scope key. */
  readonly floorId?: string;
}

/** Resolved scope: which field+value the Firestore query / write is keyed on. */
export interface BimFloorScope {
  readonly key: 'floorId' | 'floorplanId';
  readonly value: string;
}

/**
 * Resolve the stable scope key for a BIM entity. Prefers the durable `floorId`
 * (building storey); falls back to the legacy `floorplanId` only when no floor
 * is bound (project/building-level canvas).
 */
export function resolveBimScope(cfg: BimScopeConfig): BimFloorScope {
  if (cfg.floorId) return { key: 'floorId', value: cfg.floorId };
  return { key: 'floorplanId', value: cfg.floorplanId };
}

/**
 * Build the Firestore subscribe/query constraints for a BIM collection. The
 * tenant `companyId` constraint is auto-applied upstream by
 * `firestoreQueryService` (ADR-355) — do NOT add it here.
 *
 * Every BIM service's `subscribe*` method MUST build its constraints from this
 * helper (full SSoT — ends the 20× `where('floorplanId',…)` copy-paste).
 */
export function buildBimScopeConstraints(cfg: BimScopeConfig): QueryConstraint[] {
  const scope = resolveBimScope(cfg);
  return [
    where('projectId', '==', cfg.projectId),
    where(scope.key, '==', scope.value),
  ];
}

/**
 * The scope fields to persist on every BIM document. `floorplanId` is always
 * written (provenance); `floorId` is written whenever a floor is bound. Spread
 * into the service's `base` payload in place of the old hard-coded
 * `floorplanId: this.config.floorplanId` line.
 */
export function bimScopeWriteFields(cfg: BimScopeConfig): Record<string, string> {
  return {
    floorplanId: cfg.floorplanId,
    ...(cfg.floorId ? { floorId: cfg.floorId } : {}),
  };
}
