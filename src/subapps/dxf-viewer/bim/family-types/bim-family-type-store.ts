/**
 * BimFamilyTypeStore — Zustand store for the company's loaded BIM family types
 * (ADR-412). Holds the resolution cache consumed at scene-entity construction:
 * walls (and later other categories) with a `typeId` resolve their type-governed
 * fields from the matching `BimFamilyType` here — "type always wins" (same idiom
 * as the MEP "System always wins" pattern). Entities WITHOUT a `typeId` never
 * touch this store (legacy fast-path = zero regression).
 *
 * Family types are non-geometric and NOT scene entities, so they live in their
 * own store (mirror of `mep-system-store` / `envelope-spec-store`).
 * `useBimFamilyTypes` is the sole writer (load → `setTypes`). Read consumers call
 * `getType(id)` during resolution and subscribe to `version` to re-resolve when
 * the catalog changes (a type edit must re-flow to its placed instances).
 *
 * @see ./bim-family-type-service.ts
 * @see ./useBimFamilyTypes.ts
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { dequal } from 'dequal';
import type { BimFamilyType } from '../types/bim-family-type';

export interface BimFamilyTypeStoreState {
  /** All loaded family types, keyed by id. The resolution lookup table. */
  readonly byId: ReadonlyMap<string, BimFamilyType>;
  /**
   * Monotonic counter bumped on every content change. Consumers subscribe to
   * this to re-run resolution (re-flow type edits onto placed instances)
   * without diffing the whole map.
   */
  readonly version: number;
  /** Replaces the entire catalog. Idempotent: identical content = no notify. */
  setTypes(types: readonly BimFamilyType[]): void;
  /** Resolution lookup. Returns `null` when the id is unknown. */
  getType(id: string): BimFamilyType | null;
  /** Snapshot of the current catalog as a flat list. */
  getTypes(): readonly BimFamilyType[];
}

function buildById(
  types: readonly BimFamilyType[],
): ReadonlyMap<string, BimFamilyType> {
  const map = new Map<string, BimFamilyType>();
  for (const type of types) map.set(type.id, type);
  return map;
}

export const useBimFamilyTypeStore = create<BimFamilyTypeStoreState>()(
  subscribeWithSelector((set, get) => ({
    byId: new Map<string, BimFamilyType>(),
    version: 0,
    setTypes: (types) =>
      set((s) => {
        // Idempotent bail: a re-load maps the same docs to fresh references, so
        // compare by value — skip the notify (and the version bump) so
        // resolution subscribers don't re-run on identical data.
        const nextById = buildById(types);
        if (dequal(Array.from(s.byId.values()), Array.from(nextById.values()))) {
          return s;
        }
        return { byId: nextById, version: s.version + 1 };
      }),
    getType: (id) => get().byId.get(id) ?? null,
    getTypes: () => Array.from(get().byId.values()),
  })),
);
