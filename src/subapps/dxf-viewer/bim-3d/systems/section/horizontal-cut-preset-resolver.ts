/**
 * ADR-366 §C.6.Q1 — Horizontal cut preset resolver.
 *
 * Pure function: building floors (ADR-326 / ADR-369 StoreyRef.elevation) →
 * ElevationPreset[]. Used to populate the Y-axis horizontal cut dropdown.
 *
 * Elevation source: FloorRef.elevation (metres, world Y).
 * Sorted ascending; lowest floor = index 0 (Ισόγειο).
 */

export interface ElevationPreset {
  /** Human-readable label (e.g. "3,0 μ. (1ος Όροφος)"). */
  readonly label: string;
  /** World-space Y elevation in meters. NaN = custom (manual slider). */
  readonly elevationM: number;
}

interface FloorLike {
  readonly id: string;
  readonly elevation?: number;
}

/**
 * Converts building floors to Y-axis preset elevations.
 * Floors sorted ascending by elevation; index 0 = ground floor.
 *
 * @param floors  Array from Bim3DEntitiesStore.floors.
 * @param tFn     i18n translator bound to 'bim3d' namespace.
 */
export function resolveFloorPresets(
  floors: ReadonlyArray<FloorLike>,
  tFn: (key: string, opts?: Record<string, unknown>) => string,
): ElevationPreset[] {
  const sorted = [...floors]
    .filter((f) => f.elevation !== undefined)
    .sort((a, b) => (a.elevation ?? 0) - (b.elevation ?? 0));

  const presets: ElevationPreset[] = sorted.map((floor, idx) => {
    const elevationM = floor.elevation ?? 0;
    const formattedM = Math.abs(elevationM).toLocaleString('el-GR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    const sign = elevationM < 0 ? '−' : '';
    const floorLabel =
      idx === 0
        ? tFn('section.presets.groundFloor')
        : tFn('section.presets.floorN', { n: idx });
    return {
      label: `${sign}${formattedM} μ. (${floorLabel})`,
      elevationM,
    };
  });

  presets.push({
    label: tFn('section.presets.custom'),
    elevationM: NaN,
  });
  return presets;
}
