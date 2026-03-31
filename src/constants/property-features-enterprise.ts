/**
 * 🏢 ENTERPRISE PROPERTY FEATURES SYSTEM
 *
 * Enterprise-class κεντρικοποιημένο σύστημα για property features και lookups
 * Self-contained αρχείο με όλα τα property feature definitions
 * Following the pattern of property-statuses-enterprise.ts
 *
 * @created 2026-01-23
 * @author Claude AI Assistant
 * @version 1.0.5
 * @enterprise Production-ready property features management system
 */


// =============================================================================
// 🏢 REUSE EXISTING PROPERTY TYPE (from src/types/property.ts)
// =============================================================================

export type { PropertyType } from '@/types/property';

// =============================================================================
// 🏢 ORIENTATION CONSTANTS (STORED VALUES = FULL NAMES)
// =============================================================================

/**
 * ORIENTATION ENCODING DECISION: Stored values are FULL NAMES (not abbreviations)
 * Example usage: orientations: ['north', 'east'] NOT ['N', 'E']
 */
export const Orientation = {
  N: 'north',
  NE: 'northeast',
  E: 'east',
  SE: 'southeast',
  S: 'south',
  SW: 'southwest',
  W: 'west',
  NW: 'northwest'
} as const;

// =============================================================================
// 🏢 VIEW TYPE CONSTANTS
// =============================================================================

export const ViewType = {
  SEA: 'sea',
  MOUNTAIN: 'mountain',
  CITY: 'city',
  PARK: 'park',
  GARDEN: 'garden',
  COURTYARD: 'courtyard'
} as const;

// =============================================================================
// 🏢 INTERIOR FEATURE CODES
// =============================================================================

export const InteriorFeatureCode = {
  FIREPLACE: 'fireplace',
  JACUZZI: 'jacuzzi',
  SAUNA: 'sauna',
  SMART_HOME: 'smart-home',
  SOLAR_PANELS: 'solar-panels',
  UNDERFLOOR_HEATING: 'underfloor-heating',
  AIR_CONDITIONING: 'air-conditioning',
  ALARM_SYSTEM: 'alarm-system'
} as const;

// =============================================================================
// 🏢 SECURITY FEATURE CODES
// =============================================================================

export const SecurityFeatureCode = {
  ALARM: 'alarm',
  SECURITY_DOOR: 'security-door',
  CCTV: 'cctv',
  ACCESS_CONTROL: 'access-control',
  INTERCOM: 'intercom',
  MOTION_SENSORS: 'motion-sensors'
} as const;

// =============================================================================
// 🏢 AMENITY CODES
// =============================================================================

export const AmenityCode = {
  POOL: 'pool',
  ELEVATOR: 'elevator',
  GYM: 'gym',
  DOORMAN: 'doorman',
  GARDEN: 'garden',
  PLAYGROUND: 'playground',
  PARKING_GARAGE: 'parking-garage'
} as const;

// =============================================================================
// 🏢 ENERGY CLASS CONSTANTS
// =============================================================================

export const EnergyClass = {
  A_PLUS: 'A+',
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  E: 'E',
  F: 'F',
  G: 'G'
} as const;

// =============================================================================
// 🏢 TYPE EXPORTS (Following XType pattern from property-statuses-enterprise.ts)
// =============================================================================

/**
 * ENTERPRISE PATTERN: All types use consistent XType naming
 * Following the existing pattern from property-statuses-enterprise.ts
 */

export type OrientationType = typeof Orientation[keyof typeof Orientation];
export type ViewTypeValue = typeof ViewType[keyof typeof ViewType];
export type InteriorFeatureCodeType = typeof InteriorFeatureCode[keyof typeof InteriorFeatureCode];
export type SecurityFeatureCodeType = typeof SecurityFeatureCode[keyof typeof SecurityFeatureCode];
export type AmenityCodeType = typeof AmenityCode[keyof typeof AmenityCode];
export type EnergyClassType = typeof EnergyClass[keyof typeof EnergyClass];

// =============================================================================
// 🏢 SIMPLE TYPE DEFINITIONS (No complex objects/constants)
// =============================================================================

export type ViewQuality = 'full' | 'partial' | 'distant';
export type OperationalStatusType = 'ready' | 'under-construction';
export type ConditionType = 'new' | 'excellent' | 'good' | 'needs-renovation';
export type HeatingType = 'central' | 'autonomous' | 'heat-pump' | 'solar' | 'none';
export type FuelType = 'natural-gas' | 'oil' | 'electricity' | 'solar' | 'heat-pump';
export type CoolingType = 'central-air' | 'split-units' | 'fan-coil' | 'none';
export type WaterHeatingType = 'electric' | 'gas' | 'solar' | 'heat-pump';
export type FlooringType = 'tiles' | 'wood' | 'laminate' | 'marble' | 'carpet';
export type FrameType = 'aluminum' | 'pvc' | 'wood';
export type GlazingType = 'single' | 'double' | 'triple' | 'energy';
export type BuildingType = 'apartment-complex' | 'villa' | 'maisonette' | 'commercial';
export type LocationTagType = 'nearSea' | 'nearMetro' | 'quietArea' | 'cityCenter' | 'suburban';

// =============================================================================
// 🏢 I18N KEY MAPPINGS (for translation)
// =============================================================================

/**
 * i18n keys for orientation labels
 * Components use these with useTranslation hook
 */
export const ORIENTATION_LABELS: Record<OrientationType, string> = {
  'north': 'units.orientation.north',
  'northeast': 'units.orientation.northeast',
  'east': 'units.orientation.east',
  'southeast': 'units.orientation.southeast',
  'south': 'units.orientation.south',
  'southwest': 'units.orientation.southwest',
  'west': 'units.orientation.west',
  'northwest': 'units.orientation.northwest'
};

/**
 * i18n keys for view type labels
 */
export const VIEW_TYPE_LABELS: Record<ViewTypeValue, string> = {
  'sea': 'units.views.sea',
  'mountain': 'units.views.mountain',
  'city': 'units.views.city',
  'park': 'units.views.park',
  'garden': 'units.views.garden',
  'courtyard': 'units.views.courtyard'
};

/**
 * i18n keys for energy class labels
 */
export const ENERGY_CLASS_LABELS: Record<EnergyClassType, string> = {
  'A+': 'units.energy.aPlus',
  'A': 'units.energy.a',
  'B': 'units.energy.b',
  'C': 'units.energy.c',
  'D': 'units.energy.d',
  'E': 'units.energy.e',
  'F': 'units.energy.f',
  'G': 'units.energy.g'
};

// =============================================================================
// 🏢 DISPLAY COLORS (Following design system)
// =============================================================================

/**
 * Energy class colors for visual representation
 */
export const ENERGY_CLASS_COLORS: Record<EnergyClassType, string> = {
  'A+': 'hsl(var(--status-success))',      // 🟢 Dark Green - Best
  'A': 'hsl(var(--status-success-light))', // 🟢 Green - Excellent
  'B': 'hsl(var(--status-info))',          // 🔵 Blue - Good
  'C': 'hsl(var(--status-warning))',       // 🟡 Yellow - Average
  'D': 'hsl(var(--status-warning-dark))',  // 🟠 Orange - Below Average
  'E': 'hsl(var(--status-error-light))',   // 🔴 Light Red - Poor
  'F': 'hsl(var(--status-error))',         // 🔴 Red - Very Poor
  'G': 'hsl(var(--status-error-dark))'     // 🔴 Dark Red - Worst
};