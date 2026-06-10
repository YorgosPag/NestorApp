/**
 * mep-wire-scene — SSoT for deriving the current circuits' home-run wire paths from a scene.
 *
 * The home-run wires are NOT scene entities — they are the derived rendering of the electrical
 * circuits (`MepSystem`), recomputed at event time from the live host transforms (fixtures +
 * panels) so they follow move/rotate for free. Three consumers need the exact same derivation —
 * the 2D overlay (`HomeRunWiresOverlay`), the click/hover hit-test, and the marquee
 * (window/crossing) selection — so it lives here once instead of being inlined per call site.
 *
 * Pure: the caller passes the live `systems` (read from `useMepSystemStore` at event time), so
 * this module stays store-free and unit-testable.
 *
 * @see ./mep-wire-routing.ts — `computeCircuitWirePaths`
 * @see ./mep-wire-resolver.ts — `resolverFromHosts`
 * @see ./mep-wire-hit.ts — `hitTestCircuitWirePaths` / `selectCircuitsInMarquee` (the consumers)
 */

import type { Entity, SceneModel } from '../../types/entities';
import type { MepConnector } from '../types/mep-connector-types';
import type { MepSystemEntity } from '../types/mep-system-types';
import { computeCircuitWirePaths, type CircuitWirePath } from './mep-wire-routing';
import { resolverFromHosts, type WireHostXform } from './mep-wire-resolver';

/**
 * Collect host transforms (fixtures + panels) from a list of scene entities — the **single**
 * SSoT wire-host source for ALL circuit-wire consumers (2D overlay, click/marquee hit-test, and
 * the 2D+3D electrical auto-design bridges). `zMm` carries the mounting elevation for the 3D
 * consumers; the 2D ones simply ignore it (`WireHostXform.zMm` is optional, resolver defaults 0).
 */
export function collectWireHosts(entities: readonly Entity[]): Map<string, WireHostXform> {
  const hosts = new Map<string, WireHostXform>();
  for (const e of entities) {
    if (e.type !== 'mep-fixture' && e.type !== 'electrical-panel') continue;
    const params = e.params as {
      position: { x: number; y: number };
      rotation: number;
      mountingElevationMm?: number;
      connectors?: readonly MepConnector[];
    };
    hosts.set(e.id, {
      x: params.position.x,
      y: params.position.y,
      rotation: params.rotation,
      zMm: params.mountingElevationMm ?? 0,
      connectors: params.connectors ?? [],
    });
  }
  return hosts;
}

/**
 * Derive every circuit's home-run wire path from the scene hosts + the live circuit systems —
 * the SAME paths the overlay draws and the hit-tests probe. Returns `[]` when there are no
 * circuits (callers can early-out).
 */
export function resolveCircuitWirePaths(
  scene: SceneModel,
  systems: readonly MepSystemEntity[],
): CircuitWirePath[] {
  if (systems.length === 0) return [];
  const resolve = resolverFromHosts(collectWireHosts(scene.entities));
  return computeCircuitWirePaths(systems, resolve);
}
