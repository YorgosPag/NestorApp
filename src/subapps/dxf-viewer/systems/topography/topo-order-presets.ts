/**
 * ADR-650 Milestone 2 — Named column orders (config only, no logic).
 *
 * The industry ships survey points as positional text formats whose NAME is the column
 * order (Civil 3D «Point File Formats», Carlson, Trimble, Leica all use the same letters):
 *
 *   P = Point number/id     N = Northing        E = Easting
 *   Z = Elevation           D = Description (feature code)
 *
 * ⚠️ THE TRAP THIS FILE EXISTS TO KILL: **N (Northing) is Y, E (Easting) is X.**
 * `PNEZD` is therefore `id, Y, X, Z, code` — NOT `id, X, Y, Z, code`. Swapping them mirrors
 * the whole survey about the 45° line, which still «looks like a site», so the mistake ships.
 * It is encoded ONCE, here, and every importer reads it from this table.
 *
 * `ENZ`/`NEZ`/`XYZ` are the plain 3-column exports most GNSS handhelds emit.
 */

import type { OrderPreset } from './topo-import-types';

/**
 * Selectable column orders, in the order they are offered to the surveyor.
 * `PNEZD` is first: it is the de-facto default of Civil 3D and most Greek survey exports.
 */
export const TOPO_ORDER_PRESETS: readonly OrderPreset[] = [
  // Point, Northing(Y), Easting(X), Elevation, Description
  { id: 'PNEZD', mapping: ['pointId', 'y', 'x', 'z', 'code'] },
  // Point, Easting(X), Northing(Y), Elevation, Description
  { id: 'PENZD', mapping: ['pointId', 'x', 'y', 'z', 'code'] },
  // Same two, without the description column
  { id: 'PNEZ', mapping: ['pointId', 'y', 'x', 'z'] },
  { id: 'PENZ', mapping: ['pointId', 'x', 'y', 'z'] },
  // Coordinate-only exports (no point id)
  { id: 'NEZ', mapping: ['y', 'x', 'z'] },
  { id: 'ENZ', mapping: ['x', 'y', 'z'] },
  // Cartesian naming — already X-first, no swap
  { id: 'XYZ', mapping: ['x', 'y', 'z'] },
  { id: 'XYZD', mapping: ['x', 'y', 'z', 'code'] },
];

/** The zero-config default used when no preset is chosen (matches Milestone 1's parser). */
export const DEFAULT_ORDER_PRESET_ID = 'XYZD' as const;

/** Look up a preset's mapping by id; `null` when the id is unknown. */
export function getOrderPresetMapping(id: string): OrderPreset['mapping'] | null {
  return TOPO_ORDER_PRESETS.find((p) => p.id === id)?.mapping ?? null;
}
