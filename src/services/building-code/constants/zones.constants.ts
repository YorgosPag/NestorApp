/**
 * @related ADR-186 Building Code Module — Modular ΝΟΚ
 *
 * Zone parameters barrel — merges residential and commercial zones into
 * a single lookup Record for use throughout the application.
 *
 * ΝΟΚ zone parameters — 15 canonical zones per ν.4067/2012 and FEK ordinances.
 * Values represent typical Greek municipal settings; users should verify against
 * their specific local ordinance.
 */
import type { ZoneParameters } from '@/services/building-code/types/zone.types';
import { RESIDENTIAL_ZONE_PARAMETERS } from '@/services/building-code/constants/zones.residential.constants';
import { COMMERCIAL_ZONE_PARAMETERS } from '@/services/building-code/constants/zones.commercial.constants';

export type { ZoneParameters };
export {
  RESIDENTIAL_USES,
  MIXED_USES,
  CENTRAL_USES,
  RESIDENTIAL_EXCEPTION,
} from '@/services/building-code/constants/zones.residential.constants';
export {
  OUT_OF_PLAN_USES,
  OUT_EXCEPTION,
} from '@/services/building-code/constants/zones.commercial.constants';

export const ZONE_PARAMETERS: Record<string, ZoneParameters> = {
  ...RESIDENTIAL_ZONE_PARAMETERS,
  ...COMMERCIAL_ZONE_PARAMETERS,
};
