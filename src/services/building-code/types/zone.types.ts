/**
 * @related ADR-186 Building Code Module — Modular ΝΟΚ
 *
 * Zone parameters per ΝΟΚ ν.4067/2012 and FEK ordinances.
 */
import type { AreaRegime } from '@/services/building-code/types/site.types';

export interface ZoneArtiotita {
  readonly minArea_m2: number;
  readonly minFrontage_m: number;
}

export interface ZoneParameters {
  readonly zoneId: string;
  readonly displayName: string;
  readonly SD: number;
  readonly coverage_pct: number;
  readonly maxHeight_m: number;
  /** Mandatory rear setback Δ (m) — ΝΟΚ ν.4067/2012 Art. 9. */
  readonly D_m: number;
  /** Mandatory lateral setback δ (m) — ΝΟΚ ν.4067/2012 Art. 9. */
  readonly delta_m: number;
  readonly areaRegime: AreaRegime;
  readonly artiotita: ZoneArtiotita;
  readonly artiotitaException?: ZoneArtiotita & { readonly condition: string };
  readonly allowedUses: readonly string[];
  readonly nokBonusEligible: boolean;
  readonly sourceFek: string;
  readonly notes?: string;
}
