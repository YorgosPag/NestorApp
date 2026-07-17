/**
 * Opening Frame Profile — Merge Lookup SSoT (ADR-676 Phase 3 PILOT).
 *
 * The ONE place the builtin catalog (`opening-frame-profile-catalog.ts`) and
 * the loaded user/company/project library (`opening-frame-profile-store.ts`)
 * are folded into a single lookup surface. Every non-React reader that needs
 * "is this id a real profile, builtin or saved" (the resolver, the ribbon
 * bridge) goes through this module — never re-implements the "builtin, then
 * user" merge itself (N.18 — one merge SSoT, no sibling clones).
 *
 * Precedence: builtin ALWAYS wins an id collision (a builtin id is immutable
 * catalog data; a same-named user save cannot shadow it — mirrors the
 * family-type "catalog wins" idiom used across the domain).
 *
 * @see ./opening-frame-profile-catalog.ts — builtin SSoT (immutable)
 * @see ./opening-frame-profile-store.ts — loaded user-library SSoT
 * @see ./resolve-opening-frame-profile.ts — sole non-bridge consumer
 * @see ../../ui/ribbon/hooks/bridge/opening-frame-profile-bridge.ts — combobox consumer
 * @see docs/centralized-systems/reference/adrs/ADR-676-opening-component-library.md
 */

import type { OpeningFrameProfile } from '../types/opening-frame-profile';
import {
  getFrameProfileById,
  listFrameProfiles,
  listFrameProfileManufacturers,
} from './opening-frame-profile-catalog';
import { getUserFrameProfileById, listUserFrameProfiles } from './opening-frame-profile-store';

/**
 * Resolve a frame-profile id against the builtin catalog first, then the
 * loaded user library. `undefined` when neither source knows the id (custom
 * sentinel or a stale/foreign id).
 */
export function resolveFrameProfileById(id: string): OpeningFrameProfile | undefined {
  return getFrameProfileById(id) ?? getUserFrameProfileById(id) ?? undefined;
}

/**
 * Builtin profiles first (catalog display order), then user-library profiles
 * — both filtered by `manufacturer` when given. A user profile whose id
 * collides with a builtin one is dropped (builtin wins, never listed twice).
 */
export function listMergedFrameProfiles(manufacturer?: string): OpeningFrameProfile[] {
  const builtin = listFrameProfiles(manufacturer);
  const builtinIds = new Set(builtin.map((p) => p.id));
  const user = listUserFrameProfiles().filter(
    (p) => !builtinIds.has(p.id) && (manufacturer === undefined || p.manufacturer === manufacturer),
  );
  return [...builtin, ...user];
}

/**
 * Distinct manufacturer brands across builtin + user library, builtin's
 * first-seen order first, then any user-only brands appended.
 */
export function listMergedFrameProfileManufacturers(): string[] {
  const merged = listFrameProfileManufacturers();
  const seen = new Set(merged);
  for (const p of listUserFrameProfiles()) {
    if (seen.has(p.manufacturer)) continue;
    seen.add(p.manufacturer);
    merged.push(p.manufacturer);
  }
  return merged;
}
