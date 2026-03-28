/**
 * FILTER LABELS
 *
 * Centralized filter labels for property, storage, parking, and project toolbars.
 * Used across all filter/toolbar components in the application.
 *
 * @domain Filter System
 * @consumers ~20 files
 */

// ============================================================================
// COMMON FILTER LABELS (shared base)
// ============================================================================

export const COMMON_FILTER_LABELS = {
  ALL_TYPES: 'filters.allTypes',
  ALL_STATUSES: 'filters.allStatuses',
  ALL_FLOORS: 'filters.allFloors',
  ALL_UNITS: 'filters.allUnits',
  ALL_AREAS: 'filters.allAreas',
  ALL_PROJECTS: 'filters.allProjects',
  ALL_LOCATIONS: 'filters.allLocations',
  ALL_COMPANIES: 'filters.allCompanies',
  ALL_CLIENTS: 'filters.allClients',
  ALL_PRIORITIES: 'filters.allPriorities',
  ALL_ENERGY_CLASSES: 'filters.allEnergyClasses',
  ALL_RENOVATIONS: 'filters.allRenovations',
  ALL_RISK_LEVELS: 'filters.allRiskLevels',
  ALL_COMPLEXITIES: 'filters.allComplexities'
} as const;

// ============================================================================
// PROPERTY FILTER LABELS (extends COMMON)
// ============================================================================

export const PROPERTY_FILTER_LABELS = {
  ...COMMON_FILTER_LABELS,
  ALL_BUILDINGS: 'filters.allBuildings',
  // Field labels
  search: 'filters.fields.search',
  price_range: 'filters.fields.priceRange',
  area_range: 'filters.fields.areaRange',
  value_range: 'filters.fields.valueRange',
  units_range: 'filters.fields.unitsRange',
  budget_range: 'filters.fields.budgetRange',
  duration_range: 'filters.fields.durationRange',
  status: 'filters.fields.status',
  project: 'filters.fields.project',
  building: 'filters.fields.building',
  floor: 'filters.fields.floor',
  type: 'filters.fields.type',
  energy_class: 'filters.fields.energyClass',
  renovation: 'filters.fields.renovation',
  location: 'filters.fields.location',
  city: 'filters.fields.city',
  company: 'filters.fields.company',
  client: 'filters.fields.client',
  priority: 'filters.fields.priority',
  risk_level: 'filters.fields.riskLevel',
  complexity: 'filters.fields.complexity',
  year_built: 'filters.fields.yearBuilt',
  property_type: 'filters.fields.propertyType',
  contact_type: 'filters.fields.contactType',
  units_count: 'filters.fields.unitsCount',
  total_area: 'filters.fields.totalArea',
  year_range: 'filters.fields.yearRange',
  progress_range: 'filters.fields.progressRange',
  start_year_range: 'filters.fields.startYearRange',
  timeframe: 'filters.fields.timeframe',
  stage: 'filters.fields.stage',
  period: 'filters.fields.period',
  // Checkbox labels
  has_parking: 'filters.checkboxes.hasParking',
  has_elevator: 'filters.checkboxes.hasElevator',
  has_garden: 'filters.checkboxes.hasGarden',
  has_pool: 'filters.checkboxes.hasPool',
  has_storage: 'filters.checkboxes.hasStorage',
  accessibility: 'filters.checkboxes.accessibility',
  furnished: 'filters.checkboxes.furnished',
  has_properties: 'filters.checkboxes.hasProperties',
  has_permits: 'filters.checkboxes.hasPermits',
  has_financing: 'filters.checkboxes.hasFinancing',
  has_subcontractors: 'filters.checkboxes.hasSubcontractors',
  has_issues: 'filters.checkboxes.hasIssues',
  is_active: 'filters.checkboxes.isActive',
  is_favorite: 'filters.checkboxes.isFavorite',
  show_archived: 'filters.checkboxes.showArchived',
  is_ecological: 'filters.checkboxes.isEcological'
} as const;

// ============================================================================
// STORAGE & PARKING FILTER LABELS (extend COMMON)
// ============================================================================

export const STORAGE_FILTER_LABELS = {
  ...COMMON_FILTER_LABELS
} as const;

export const PARKING_FILTER_LABELS = {
  ...COMMON_FILTER_LABELS,
  ALL_LEVELS: 'filters.allLevels'
} as const;

// ============================================================================
// UNIFIED STATUS FILTER LABELS
// ============================================================================

/**
 * Unified status filter labels used across entity list views
 * (Projects, Buildings, Properties, Parking, Storage)
 */
export const UNIFIED_STATUS_FILTER_LABELS = {
  // Base statuses
  AVAILABLE: 'filters.status.available',
  SOLD: 'filters.status.sold',
  RESERVED: 'filters.status.reserved',
  MAINTENANCE: 'filters.status.maintenance',
  OCCUPIED: 'filters.status.occupied',

  // Project statuses
  PLANNING: 'filters.status.planning',
  IN_PROGRESS: 'filters.status.inProgress',
  COMPLETED: 'filters.status.completed',
  ON_HOLD: 'filters.status.onHold',

  // Contact statuses
  ACTIVE: 'filters.status.active',
  INACTIVE: 'filters.status.inactive',
  ARCHIVED: 'filters.status.archived',

  // Extended status labels
  LEAD: 'filters.status.lead',
  PENDING: 'filters.status.pending',
  CONSTRUCTION: 'filters.status.construction'
} as const;

// ============================================================================
// PRIORITY & COMPLEXITY LABELS
// ============================================================================

export const PRIORITY_LABELS = {
  high: 'filters.priority.high',
  medium: 'filters.priority.medium',
  low: 'filters.priority.low',
  urgent: 'filters.priority.urgent',
  critical: 'filters.priority.critical'
} as const;

export const RISK_COMPLEXITY_LABELS = {
  'low': 'filters.riskComplexity.low',
  'medium': 'filters.riskComplexity.medium',
  'high': 'filters.riskComplexity.high',
  'simple': 'filters.riskComplexity.simple',
  'complex': 'filters.riskComplexity.complex',
  'very_complex': 'filters.riskComplexity.veryComplex'
} as const;

// ============================================================================
// BUILDING/PROJECT STATUS & TYPE LABELS
// ============================================================================

export const BUILDING_PROJECT_STATUS_LABELS = {
  'for-sale': 'filters.buildingStatus.forSale',
  'for-rent': 'filters.buildingStatus.forRent',
  'rented': 'filters.buildingStatus.rented',
  'withdrawn': 'filters.buildingStatus.withdrawn',
  'in_progress': 'filters.buildingStatus.inProgress',
  'delayed': 'filters.buildingStatus.delayed',
  'cancelled': 'filters.buildingStatus.cancelled',
  'excellent': 'filters.condition.excellent',
  'very-good': 'filters.condition.veryGood',
  'good': 'filters.condition.good',
  'needs-renovation': 'filters.condition.needsRenovation',
  'under-renovation': 'filters.condition.underRenovation'
} as const;

export const PROPERTY_BUILDING_TYPE_LABELS = {
  'individual': 'filters.types.individual',
  'company': 'filters.types.company',
  'service': 'filters.types.service',
  'residential': 'filters.types.residential',
  'commercial': 'filters.types.commercial',
  'industrial': 'filters.types.industrial',
  'office': 'filters.types.office',
  'mixed': 'filters.types.mixed',
  'warehouse': 'filters.types.warehouse',
  'retail': 'filters.types.retail',
  'hotel': 'filters.types.hotel',
  'public': 'filters.types.public',
  'renovation': 'filters.types.renovation',
  'infrastructure': 'filters.types.infrastructure'
} as const;
