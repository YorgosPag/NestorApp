/**
 * ADR-650 M10 — runtime SSoT for the ACTIVE project geo-reference (canonical mm).
 *
 * The durable home of the geo-reference is the `Project` doc (ADR-369
 * `basePoint`/`northRotation`, metres — see `geo-reference-schema.ts`). This vanilla
 * store is the RUNTIME mirror the render path reads: hydrated from the Project on load
 * and updated optimistically by the geo-referencing tool (auto-align / manual common
 * point). `null` = the project is NOT geo-referenced → identity (renders unchanged).
 *
 * Pattern: `createExternalStore` (ADR-040) — zero React state. Consumers:
 *   - `regenerate-topo.ts` reads `getGeoReference()` to project the terrain (world ΕΓΣΑ)
 *     into the building's LOCAL frame so contours land on the plan.
 *   - `useTopoPersistence` subscribes to re-regenerate when the reference changes (the
 *     building «κουμπώνει» live as the user aligns it).
 *
 * @see ./geo-reference-schema.ts — Project (metres) ↔ GeoReference (mm)
 * @see ../topography/persistence/regenerate-topo.ts — the render consumer
 */

import { createExternalStore } from '../../stores/createExternalStore';
import type { GeoReference } from './geo-transform';

const store = createExternalStore<GeoReference | null>(null);

/** Active geo-reference (canonical mm), or `null` when the project is not referenced. */
export function getGeoReference(): GeoReference | null {
  return store.get();
}

/** Set/replace the active geo-reference (`null` clears it → identity). */
export function setGeoReference(geo: GeoReference | null): void {
  store.set(geo);
}

/** Subscribe to reference changes; returns unsubscribe (useSyncExternalStore-compatible). */
export function subscribeGeoReference(listener: () => void): () => void {
  return store.subscribe(listener);
}
