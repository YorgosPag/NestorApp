'use client';

/**
 * BIM Audit Helpers (ADR-XXX — BIM Entity Audit Coverage).
 *
 * SSoT for building `AuditFieldChange[]` payloads from BIM entity snapshots.
 * Used by all five BIM audit-clients (wall/column/slab/beam/opening) so the
 * payload semantics (create / update / delete) stay identical across types.
 *
 * Why a shared helper:
 *   - Five entity types had copy-pasted `buildXxxChanges()` functions that
 *     emitted only `{ field: 'kind', oldValue: X, newValue: Y }` placeholders.
 *     Every wall / column / slab / beam / opening mutation produced an audit
 *     row with a single useless `kind` entry — no width, no material, no
 *     dimensional intent. ADR-195 row diffs require real tracked fields.
 *
 * Routing:
 *   - `created` → `diffTrackedFields({}, snapshot, defs)` → one entry per
 *     non-null tracked field, `oldValue: null → newValue: X`.
 *   - `updated` → `diffTrackedFields(prev, next, defs)` → only changed
 *     fields. Empty result = no-op (caller MUST skip the POST; the route
 *     validator rejects `changes: []` with 400).
 *   - `deleted` → reverse-iterate tracked fields, emit each non-null as
 *     `oldValue: X → newValue: null`. (The diff engine's "fields in newDoc"
 *     guard would otherwise emit nothing.)
 */

import { diffTrackedFields, serializeScalar, type TrackedFieldDef } from '@/lib/audit/audit-diff';
import type { AuditFieldChange } from '@/types/audit-trail';

/**
 * Minimum shape required to compute an audit payload. Full entities satisfy
 * this trivially; the delete-fallback path can pass a minimal `{ id, kind }`
 * stub (params absent → only `kind`/`layerId` emit, which is the legacy
 * behavior preserved for entities that vanished from the scene before the
 * delete handler captured a snapshot).
 */
export interface BimAuditSnapshot {
  readonly kind: string;
  readonly layerId?: string;
  readonly params?: Readonly<Record<string, unknown>>;
}

function toFlat(snapshot: BimAuditSnapshot): Record<string, unknown> {
  return {
    kind: snapshot.kind,
    ...(snapshot.layerId !== undefined ? { layerId: snapshot.layerId } : {}),
    ...(snapshot.params ?? {}),
  };
}

/** Build `created` audit changes from a freshly persisted entity snapshot. */
export function buildBimCreationChanges(
  snapshot: BimAuditSnapshot,
  defs: Record<string, TrackedFieldDef>,
): AuditFieldChange[] {
  return diffTrackedFields({}, toFlat(snapshot), defs);
}

/**
 * Build `updated` audit changes between previous and next entity snapshots.
 * Returns `[]` when nothing tracked changed — caller MUST skip the POST.
 */
export function buildBimUpdateChanges(
  prev: BimAuditSnapshot,
  next: BimAuditSnapshot,
  defs: Record<string, TrackedFieldDef>,
): AuditFieldChange[] {
  return diffTrackedFields(toFlat(prev), toFlat(next), defs);
}

/**
 * Build `deleted` audit changes from the last-known entity snapshot. Each
 * non-null tracked field is emitted as `oldValue: X → newValue: null` so the
 * history tab shows what was lost. Collection-kind defs are skipped (granular
 * remove entries would explode the payload for slabs with many openings).
 */
export function buildBimDeletionChanges(
  snapshot: BimAuditSnapshot,
  defs: Record<string, TrackedFieldDef>,
): AuditFieldChange[] {
  const flat = toFlat(snapshot);
  const out: AuditFieldChange[] = [];
  for (const [field, def] of Object.entries(defs)) {
    if (def.kind === 'collection') continue;
    const v = serializeScalar(flat[field]);
    if (v === null) continue;
    out.push({ field, oldValue: v, newValue: null, label: def.label });
  }
  return out;
}

/**
 * `changes: []` triggers HTTP 400 server-side. For create/delete this almost
 * never happens (kind is always set), but the guard keeps the payload valid
 * if a future change drops `kind` from a registry.
 */
export function ensureNonEmptyChanges(
  changes: AuditFieldChange[],
  fallback: AuditFieldChange,
): AuditFieldChange[] {
  return changes.length > 0 ? changes : [fallback];
}
