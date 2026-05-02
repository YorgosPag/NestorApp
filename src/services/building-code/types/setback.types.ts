/**
 * @related ADR-186 Building Code Module — Modular ΝΟΚ
 *
 * Types for the per-edge setback engine (Δ rear / δ lateral).
 * ΝΟΚ ν.4067/2012 Άρθρο 9: Δ ≠ δ for rear vs lateral boundaries.
 */

/** Role of a polygon edge relative to the plot frontage(s). */
export type EdgeRole = 'frontage' | 'rear' | 'lateral';

/** Per-edge setback assignment after edge classification. */
export interface EdgeSetback {
  readonly edgeIdx: number;
  readonly role: EdgeRole;
  /** Setback distance (m) — prassia for frontage, D_m for rear, delta_m for lateral. */
  readonly setback_m: number;
  /** Human-readable label (e.g. "Α→Β") */
  readonly label: string;
}

/** Complete setback computation result — derived from site data. */
export interface SetbackResult {
  readonly edges: readonly EdgeSetback[];
  /** Inset polygon vertices defining the buildable footprint. */
  readonly buildableFootprint: readonly [number, number][];
  /** Buildable area in m² (shoelace of buildableFootprint). */
  readonly buildableArea_m2: number;
  /** Minimum edge length of the buildable footprint polygon (m). */
  readonly minBuildableSide_m: number;
  /** Warnings (e.g. "min side < 9m"). */
  readonly warnings: readonly string[];
}
