/**
 * =============================================================================
 * 🏢 ENTERPRISE: Unit Fields Form Constants
 * =============================================================================
 *
 * Extracted from UnitFieldsBlock.tsx for SRP compliance (ADR N.7.1).
 * Single source of truth for all dropdown/select option arrays.
 *
 * @module features/property-details/components/unit-fields-constants
 * @since 2026-03-27
 */

import type { UnitType, CommercialStatus, OperationalStatus } from '@/types/unit';
import type {
  OrientationType,
  ConditionType,
  EnergyClassType,
  HeatingType,
  CoolingType,
  FlooringType,
  FrameType,
  GlazingType,
  InteriorFeatureCodeType,
  SecurityFeatureCodeType,
} from '@/constants/unit-features-enterprise';

export const ORIENTATION_OPTIONS: OrientationType[] = [
  'north', 'northeast', 'east', 'southeast',
  'south', 'southwest', 'west', 'northwest',
];

export const CONDITION_OPTIONS: ConditionType[] = [
  'new', 'excellent', 'good', 'needs-renovation',
];

export const ENERGY_CLASS_OPTIONS: EnergyClassType[] = [
  'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G',
];

export const HEATING_OPTIONS: HeatingType[] = [
  'central', 'autonomous', 'heat-pump', 'solar', 'none',
];

export const COOLING_OPTIONS: CoolingType[] = [
  'central-air', 'split-units', 'fan-coil', 'none',
];

export const FLOORING_OPTIONS: FlooringType[] = [
  'tiles', 'wood', 'laminate', 'marble', 'carpet',
];

export const FRAME_OPTIONS: FrameType[] = [
  'aluminum', 'pvc', 'wood',
];

export const GLAZING_OPTIONS: GlazingType[] = [
  'single', 'double', 'triple', 'energy',
];

export const INTERIOR_FEATURE_OPTIONS: InteriorFeatureCodeType[] = [
  'fireplace', 'jacuzzi', 'sauna', 'smart-home', 'solar-panels',
  'underfloor-heating', 'air-conditioning', 'alarm-system',
];

export const SECURITY_FEATURE_OPTIONS: SecurityFeatureCodeType[] = [
  'alarm', 'security-door', 'cctv', 'access-control', 'intercom', 'motion-sensors',
];

export const UNIT_TYPE_OPTIONS: UnitType[] = [
  'studio', 'apartment_1br', 'apartment', 'apartment_2br',
  'apartment_3br', 'maisonette', 'penthouse', 'loft',
  'detached_house', 'villa', 'shop', 'office', 'hall', 'storage',
];

// Transaction statuses (reserved, sold, rented) require buyer/tenant selection
// and can ONLY be set through SalesActionDialogs (ReserveDialog/SellDialog).
// See: Sentry fix 2026-03-24 — ApiClientError "Buyer contact is required"
export const COMMERCIAL_STATUS_OPTIONS: CommercialStatus[] = [
  'unavailable', 'for-sale', 'for-rent', 'for-sale-and-rent',
];

export const OPERATIONAL_STATUS_OPTIONS: OperationalStatus[] = [
  'draft', 'under-construction', 'inspection', 'ready', 'maintenance',
];
