/**
 * @related ADR-186 Building Code Module — Modular ΝΟΚ
 *
 * Residential and central in-plan zone parameters (Α–Γ1) per ν.4067/2012.
 * D_m = mandatory rear setback Δ per ΝΟΚ ν.4067/2012 Art. 9.
 * delta_m = mandatory lateral setback δ per ΝΟΚ ν.4067/2012 Art. 9.
 */
import type { ZoneParameters } from '@/services/building-code/types/zone.types';

export const RESIDENTIAL_USES = ['Κατοικία', 'Τουρισμός', 'Αθλητισμός'] as const;
export const MIXED_USES = ['Κατοικία', 'Εμπόριο', 'Γραφεία', 'Τουρισμός', 'Αθλητισμός'] as const;
export const CENTRAL_USES = ['Κατοικία', 'Εμπόριο', 'Γραφεία', 'Εστίαση', 'Τουρισμός', 'Πολιτισμός'] as const;
export const RESIDENTIAL_EXCEPTION = {
  minArea_m2: 150, minFrontage_m: 6, condition: 'Πριν ν.1577/1985',
} as const;

export const RESIDENTIAL_ZONE_PARAMETERS: Record<string, ZoneParameters> = {
  'Α': {
    zoneId: 'Α', displayName: 'Αμιγής Κατοικία',
    SD: 0.8, coverage_pct: 60, maxHeight_m: 7.5, D_m: 3.0, delta_m: 2.5, areaRegime: 'in_plan',
    artiotita: { minArea_m2: 200, minFrontage_m: 8 },
    artiotitaException: RESIDENTIAL_EXCEPTION,
    allowedUses: RESIDENTIAL_USES, nokBonusEligible: false,
    sourceFek: 'ν.4067/2012 αρ.9',
  },
  'Β': {
    zoneId: 'Β', displayName: 'Γενική Κατοικία',
    SD: 1.2, coverage_pct: 60, maxHeight_m: 10.5, D_m: 3.0, delta_m: 2.5, areaRegime: 'in_plan',
    artiotita: { minArea_m2: 200, minFrontage_m: 8 },
    artiotitaException: RESIDENTIAL_EXCEPTION,
    allowedUses: MIXED_USES, nokBonusEligible: true,
    sourceFek: 'ν.4067/2012 αρ.9',
  },
  'Β1': {
    zoneId: 'Β1', displayName: 'Γενική Κατοικία Α\'',
    SD: 0.8, coverage_pct: 60, maxHeight_m: 7.5, D_m: 3.0, delta_m: 2.5, areaRegime: 'in_plan',
    artiotita: { minArea_m2: 200, minFrontage_m: 8 },
    artiotitaException: RESIDENTIAL_EXCEPTION,
    allowedUses: MIXED_USES, nokBonusEligible: false,
    sourceFek: 'ν.4067/2012 αρ.9',
  },
  'Β2': {
    zoneId: 'Β2', displayName: 'Γενική Κατοικία Β\'',
    SD: 1.2, coverage_pct: 60, maxHeight_m: 10.5, D_m: 3.0, delta_m: 2.5, areaRegime: 'in_plan',
    artiotita: { minArea_m2: 200, minFrontage_m: 8 },
    artiotitaException: RESIDENTIAL_EXCEPTION,
    allowedUses: MIXED_USES, nokBonusEligible: true,
    sourceFek: 'ν.4067/2012 αρ.9',
  },
  'Γ': {
    zoneId: 'Γ', displayName: 'Κεντρικές Λειτουργίες',
    SD: 2.4, coverage_pct: 70, maxHeight_m: 16.0, D_m: 4.0, delta_m: 2.5, areaRegime: 'in_plan',
    artiotita: { minArea_m2: 150, minFrontage_m: 6 },
    allowedUses: CENTRAL_USES, nokBonusEligible: true,
    sourceFek: 'ν.4067/2012 αρ.9',
  },
  'Γ1': {
    zoneId: 'Γ1', displayName: 'Κεντρικές Λειτουργίες Α\'',
    SD: 1.6, coverage_pct: 70, maxHeight_m: 13.0, D_m: 4.0, delta_m: 2.5, areaRegime: 'in_plan',
    artiotita: { minArea_m2: 150, minFrontage_m: 6 },
    allowedUses: CENTRAL_USES, nokBonusEligible: true,
    sourceFek: 'ν.4067/2012 αρ.9',
  },
};
