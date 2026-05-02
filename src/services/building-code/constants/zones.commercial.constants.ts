/**
 * @related ADR-186 Building Code Module — Modular ΝΟΚ
 *
 * General urban, out-of-plan, and mixed zone parameters per ν.4067/2012 / ΦΕΚ.
 * D_m = mandatory rear setback Δ per ΝΟΚ ν.4067/2012.
 * delta_m = mandatory lateral setback δ per ΝΟΚ ν.4067/2012.
 * ΕΚΤ D_m = 10.0 m per ΠΔ 6.10.1978.
 */
import type { ZoneParameters } from '@/services/building-code/types/zone.types';
import {
  CENTRAL_USES,
  MIXED_USES,
  RESIDENTIAL_USES,
} from '@/services/building-code/constants/zones.residential.constants';

export const OUT_OF_PLAN_USES = ['Κατοικία', 'Τουρισμός', 'Αγροτική χρήση'] as const;
export const OUT_EXCEPTION = {
  minArea_m2: 2000, minFrontage_m: 25, condition: 'Πριν 1977',
} as const;

export const COMMERCIAL_ZONE_PARAMETERS: Record<string, ZoneParameters> = {
  'Γ2': {
    zoneId: 'Γ2', displayName: 'Κεντρικές Λειτουργίες Β\'',
    SD: 1.6, coverage_pct: 70, maxHeight_m: 13.0, D_m: 4.0, delta_m: 2.5, areaRegime: 'in_plan',
    artiotita: { minArea_m2: 150, minFrontage_m: 6 },
    allowedUses: CENTRAL_USES, nokBonusEligible: true,
    sourceFek: 'ν.4067/2012 αρ.9',
  },
  'ΓΠ': {
    zoneId: 'ΓΠ', displayName: 'Γενική Πολεοδομική',
    SD: 0.8, coverage_pct: 60, maxHeight_m: 10.5, D_m: 3.0, delta_m: 2.5, areaRegime: 'in_plan',
    artiotita: { minArea_m2: 200, minFrontage_m: 8 },
    allowedUses: MIXED_USES, nokBonusEligible: true,
    sourceFek: 'ΓΠΣ/ΣΧΟΟΑΠ τοπικής ΑΔΑ',
    notes: 'Τυπικές τιμές ΦΕΚ Θεσσαλονίκης — επιβεβαίωσε με τοπική διάταξη',
  },
  'ΓΠ-1': {
    zoneId: 'ΓΠ-1', displayName: 'Γενική Πολεοδομική Α\'',
    SD: 0.4, coverage_pct: 40, maxHeight_m: 7.5, D_m: 3.0, delta_m: 2.5, areaRegime: 'in_plan',
    artiotita: { minArea_m2: 300, minFrontage_m: 12 },
    allowedUses: RESIDENTIAL_USES, nokBonusEligible: false,
    sourceFek: 'ΓΠΣ/ΣΧΟΟΑΠ τοπικής ΑΔΑ',
    notes: 'Τυπικές τιμές ΦΕΚ Θεσσαλονίκης — επιβεβαίωσε με τοπική διάταξη',
  },
  'ΓΠ-2': {
    zoneId: 'ΓΠ-2', displayName: 'Γενική Πολεοδομική Β\'',
    SD: 0.8, coverage_pct: 50, maxHeight_m: 8.5, D_m: 3.0, delta_m: 2.5, areaRegime: 'in_plan',
    artiotita: { minArea_m2: 250, minFrontage_m: 10 },
    allowedUses: RESIDENTIAL_USES, nokBonusEligible: false,
    sourceFek: 'ΓΠΣ/ΣΧΟΟΑΠ τοπικής ΑΔΑ',
    notes: 'Τυπικές τιμές ΦΕΚ Θεσσαλονίκης — επιβεβαίωσε με τοπική διάταξη',
  },
  'ΓΠ-3': {
    zoneId: 'ΓΠ-3', displayName: 'Γενική Πολεοδομική Γ\'',
    SD: 1.2, coverage_pct: 60, maxHeight_m: 10.5, D_m: 3.0, delta_m: 2.5, areaRegime: 'in_plan',
    artiotita: { minArea_m2: 200, minFrontage_m: 8 },
    allowedUses: MIXED_USES, nokBonusEligible: true,
    sourceFek: 'ΓΠΣ/ΣΧΟΟΑΠ τοπικής ΑΔΑ',
    notes: 'Τυπικές τιμές ΦΕΚ Θεσσαλονίκης — επιβεβαίωσε με τοπική διάταξη',
  },
  'ΕΚΤ': {
    zoneId: 'ΕΚΤ', displayName: 'Εκτός Σχεδίου',
    SD: 0.2, coverage_pct: 20, maxHeight_m: 7.5, D_m: 10.0, delta_m: 5.0, areaRegime: 'out_of_plan',
    artiotita: { minArea_m2: 4000, minFrontage_m: 45 },
    artiotitaException: OUT_EXCEPTION,
    allowedUses: OUT_OF_PLAN_USES, nokBonusEligible: false,
    sourceFek: 'ΠΔ 6.10.1978',
  },
  'ΖΟΕ-Α': {
    zoneId: 'ΖΟΕ-Α', displayName: 'ΖΟΕ Α\'',
    SD: 0.2, coverage_pct: 20, maxHeight_m: 7.5, D_m: 3.0, delta_m: 2.5, areaRegime: 'out_of_plan',
    artiotita: { minArea_m2: 4000, minFrontage_m: 45 },
    artiotitaException: OUT_EXCEPTION,
    allowedUses: OUT_OF_PLAN_USES, nokBonusEligible: false,
    sourceFek: 'ΠΔ ΖΟΕ τοπικής ΑΔΑ',
  },
  'ΖΟΕ-Β': {
    zoneId: 'ΖΟΕ-Β', displayName: 'ΖΟΕ Β\'',
    SD: 0.4, coverage_pct: 30, maxHeight_m: 7.5, D_m: 3.0, delta_m: 2.5, areaRegime: 'out_of_plan',
    artiotita: { minArea_m2: 2000, minFrontage_m: 25 },
    allowedUses: OUT_OF_PLAN_USES, nokBonusEligible: false,
    sourceFek: 'ΠΔ ΖΟΕ τοπικής ΑΔΑ',
  },
  'Κ': {
    zoneId: 'Κ', displayName: 'Κεντρική',
    SD: 2.4, coverage_pct: 70, maxHeight_m: 16.0, D_m: 4.0, delta_m: 2.5, areaRegime: 'in_plan',
    artiotita: { minArea_m2: 100, minFrontage_m: 6 },
    allowedUses: CENTRAL_USES, nokBonusEligible: true,
    sourceFek: 'ν.4067/2012 αρ.9',
  },
};
