/**
 * =============================================================================
 * hierarchyLookup — Greek administrative hierarchy adapter (ADR-332 §3.9 / Phase 9)
 * =============================================================================
 *
 * Thin abstraction over `administrative-hierarchy.json` (ELSTAT/Καλλικράτης) so
 * that pure helpers — `validateGreekHierarchy`, `postalCodeAutoFill` — can be
 * unit-tested with in-memory fixtures, while production code lazy-loads the
 * full 20,721-entity dataset on demand.
 *
 * @module components/shared/addresses/editor/helpers/hierarchyLookup
 * @see ADR-332 §3.9 Hierarchy validation, §4 Phase 9 deliverable
 * @see src/hooks/useAdministrativeHierarchy.ts (canonical loader)
 */

import { ADMIN_LEVELS, type AdminEntity, type AdminLevel } from '@/hooks/useAdministrativeHierarchy';

/**
 * Functional interface required by Phase 9 helpers.
 *
 * Both real data and test fixtures implement this. Helpers receive it as a
 * parameter (dependency injection — Google testability standard).
 */
export interface HierarchyLookup {
  /** Find a single entity by id (e.g. `settlement:0101010101`). */
  findById(id: string): AdminEntity | undefined;
  /** Find all settlements (level 8) carrying the given postal code. */
  findSettlementsByPostalCode(postalCode: string): readonly AdminEntity[];
  /** Walk parents up to the root, lowest level first. */
  resolveAncestors(entityId: string): readonly AdminEntity[];
  /** Get all entities at a specific level. */
  getByLevel(level: AdminLevel): readonly AdminEntity[];
}

interface RawEntity {
  id: string;
  n: string;
  sn: string;
  nn: string;
  c: string;
  p: string | null;
  l: number;
  pc?: string;
  a?: string;
}

interface RawData {
  meta: Record<string, unknown>;
  data: RawEntity[];
}

function rawToEntity(raw: RawEntity): AdminEntity {
  const entity: AdminEntity = {
    id: raw.id,
    name: raw.n,
    shortName: raw.sn,
    normalizedName: raw.nn,
    code: raw.c,
    parentId: raw.p,
    level: raw.l,
  };
  if (raw.pc) entity.postalCode = raw.pc;
  if (raw.a) entity.article = raw.a;
  return entity;
}

/** Build an in-memory lookup from a raw entity array (test fixtures or real data). */
export function buildHierarchyLookup(entities: readonly AdminEntity[]): HierarchyLookup {
  const byId = new Map<string, AdminEntity>();
  const byLevel = new Map<number, AdminEntity[]>();
  const byPostalCode = new Map<string, AdminEntity[]>();

  for (const e of entities) {
    byId.set(e.id, e);
    const levelBucket = byLevel.get(e.level);
    if (levelBucket) levelBucket.push(e);
    else byLevel.set(e.level, [e]);
    if (e.postalCode) {
      const pcBucket = byPostalCode.get(e.postalCode);
      if (pcBucket) pcBucket.push(e);
      else byPostalCode.set(e.postalCode, [e]);
    }
  }

  return {
    findById: (id) => byId.get(id),
    findSettlementsByPostalCode: (pc) => byPostalCode.get(pc) ?? [],
    resolveAncestors: (id) => {
      const chain: AdminEntity[] = [];
      let current = byId.get(id);
      while (current) {
        chain.push(current);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
      return chain;
    },
    getByLevel: (level) => byLevel.get(level) ?? [],
  };
}

let cachedLookup: HierarchyLookup | null = null;
let loadingPromise: Promise<HierarchyLookup> | null = null;

/**
 * Lazy-load the production hierarchy (3.2 MB raw / ~490 KB gzip). Cached for
 * the lifetime of the module. Returns a `HierarchyLookup` ready for the helper
 * functions.
 */
export async function loadHierarchyLookup(): Promise<HierarchyLookup> {
  if (cachedLookup) return cachedLookup;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const raw = (await import('@/data/administrative-hierarchy.json')) as unknown as RawData;
    const entities = raw.data.map(rawToEntity);
    cachedLookup = buildHierarchyLookup(entities);
    return cachedLookup;
  })();
  return loadingPromise;
}

/** Re-export level constants for convenience. */
export { ADMIN_LEVELS };
