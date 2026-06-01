/**
 * host-footprint-eval.ts — SSoT for **point-based** structural-host face evaluation.
 *
 * ADR-401 (Top/Base Attach-to-Structural), Phase G Boy-Scout (N.0.2).
 *
 * Pure (no scene, no React, no command). ONE place owns the «is plan-point `pt`
 * under/over host `h`, and at what absolute Z» primitives that an axis-less
 * attachable entity (column footprint corners, stair run sample points) needs:
 *
 *   - `hostUndersideAt(h, pt)` — κάτω-παρειά του host στο `pt` (lower-envelope
 *     consumers: «μην διαπεράσεις το ταβάνι/δοκάρι»), ή `null` αν δεν καλύπτεται.
 *   - `hostTopsideAt(h, pt)`   — άνω-παρειά του host στο `pt` (upper-envelope
 *     consumers: «κάτσε πάνω στο θεμέλιο/πλάκα»), ή `null`.
 *   - `collectHostFootprints(ids, resolve)` — resolve FK ids → inputs + missing.
 *   - `makeHostFootprintResolver(hosts)` — `Map<hostId, input>` lookup.
 *
 * Generalises the private copies that lived in `column-vertical-profile.ts`
 * (which now re-exports these). The wall resolver uses a DIFFERENT primitive
 * (axis-projection → `HostUndersidePlan`, `wall-host-plan-builder.ts`); this
 * module is strictly the **point-in-footprint** variant.
 *
 * Convention μονάδων: `pt` + `h.footprint` στο **ίδιο** plan space (mm). Τα `z*mm`
 * είναι απόλυτα mm από project origin (ADR-369 §2 datum). Κεκλιμένα hosts μέσω
 * `undersideZmmAt`/`topsideZmmAt` (Phase E2 SSoT).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §5 (Phase F/G)
 * @see bim/geometry/column-vertical-profile.ts — per-corner consumer (re-exports these)
 * @see bim/geometry/stair-vertical-profile.ts — per-run-sample consumer
 * @see bim/geometry/wall-host-plan-builder.ts — HostFootprintInput + entity adapters
 */

import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import type { HostFootprintInput, Pt2 } from './wall-host-plan-builder';

/** Όριο για να θεωρηθούν δύο Z τιμές ίσες (mm). */
export const HOST_Z_EPS = 1e-6;

/** Κάτω-παρειά host στο plan-point `pt` (απόλυτο mm), ή null αν δεν το καλύπτει. */
export function hostUndersideAt(h: HostFootprintInput, pt: Pt2): number | null {
  if (h.footprint.length < 3) return null;
  if (!isPointInPolygon(pt, [...h.footprint])) return null;
  return h.undersideZmmAt ? h.undersideZmmAt(pt) : h.undersideZmm;
}

/** Άνω-παρειά host στο plan-point `pt` (απόλυτο mm), ή null αν δεν το καλύπτει / λείπει. */
export function hostTopsideAt(h: HostFootprintInput, pt: Pt2): number | null {
  if (h.footprint.length < 3) return null;
  if (!isPointInPolygon(pt, [...h.footprint])) return null;
  if (h.topsideZmmAt) return h.topsideZmmAt(pt);
  return h.topsideZmm ?? null;
}

/** Resolve attach-host inputs ανά id, μαζεύοντας τα missing (σβησμένα hosts). */
export function collectHostFootprints(
  ids: readonly string[],
  resolve: ((id: string) => HostFootprintInput | null) | undefined,
): { hosts: HostFootprintInput[]; missingHostIds: string[] } {
  const hosts: HostFootprintInput[] = [];
  const missingHostIds: string[] = [];
  for (const id of ids) {
    const h = resolve?.(id) ?? null;
    if (h) hosts.push(h);
    else missingHostIds.push(id);
  }
  return { hosts, missingHostIds };
}

/**
 * Lookup builder από host inputs: ΕΝΑΣ τόπος για το `Map<hostId, HostFootprintInput>`
 * που τρώνε οι point-based resolvers (column corners / stair run samples).
 */
export function makeHostFootprintResolver(
  hosts: readonly HostFootprintInput[],
): (id: string) => HostFootprintInput | null {
  const byId = new Map<string, HostFootprintInput>();
  for (const h of hosts) byId.set(h.hostId, h);
  return (id: string) => byId.get(id) ?? null;
}
