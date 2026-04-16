/**
 * =============================================================================
 * 🏢 ENTERPRISE: Property Fields Form Constants
 * =============================================================================
 *
 * Extracted from PropertyFieldsBlock.tsx for SRP compliance (ADR N.7.1).
 * Single source of truth for all dropdown/select option arrays.
 *
 * @module features/property-details/components/property-fields-constants
 * @since 2026-03-27
 */

import type { PropertyType, CommercialStatus, OperationalStatus } from '@/types/property';
import { CREATABLE_PROPERTY_TYPES } from '@/constants/property-types';
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
} from '@/constants/property-features-enterprise';

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

// ADR-145: PropertyType options derived from SSoT (@/constants/property-types).
// Uses CREATABLE_PROPERTY_TYPES (excludes 'storage' — ADR-287 Batch 20).
// Widened to PropertyType[] (which includes legacy Greek values) so existing
// callers that accept the broader union remain type-compatible.
export const PROPERTY_TYPE_OPTIONS: PropertyType[] = [...CREATABLE_PROPERTY_TYPES];

// Transaction statuses (reserved, sold, rented) require buyer/tenant selection
// and can ONLY be set through SalesActionDialogs (ReserveDialog/SellDialog).
// See: Sentry fix 2026-03-24 — ApiClientError "Buyer contact is required"
export const COMMERCIAL_STATUS_OPTIONS: CommercialStatus[] = [
  'unavailable', 'for-sale', 'for-rent', 'for-sale-and-rent',
];

export const OPERATIONAL_STATUS_OPTIONS: OperationalStatus[] = [
  'draft', 'under-construction', 'inspection', 'ready', 'maintenance',
];

// =============================================================================
// SSoT: Visual tokens for property detail cards (SALES_ICON_COLORS pattern)
// =============================================================================

/** Icon colors per card section — SSoT so every card header is defined once. */
export const PROPERTY_CARD_COLORS = {
  // Card headers
  identity: 'text-blue-500',
  areas: 'text-pink-600',
  layout: 'text-violet-500',
  orientation: 'text-amber-500',
  condition: 'text-orange-500',
  energy: 'text-green-500',
  systems: 'text-red-500',
  finishes: 'text-teal-500',
  features: 'text-purple-500',
  floor: 'text-emerald-500',
  linkedSpaces: 'text-purple-600',
  // Sub-icons inside cards
  conditionIcon: 'text-orange-600',
  energyIcon: 'text-green-600',
  heating: 'text-orange-500',
  cooling: 'text-blue-500',
  bedrooms: 'text-violet-600',
  bathrooms: 'text-cyan-600',
  wc: 'text-sky-500',
  parking: 'text-blue-600',
  storage: 'text-amber-600',
} as const;

/** Micro typography for compact property cards — below Tailwind's text-xs (12px). */
export const PROPERTY_MICRO_TEXT = {
  /** 12px — helper text, hints, metadata */
  helper: 'text-xs',
  /** 12px — multi-level indicators (ανά όροφο / κοινά) */
  micro: 'text-xs',
} as const;
