/**
 * DROPDOWN & MISCELLANEOUS LABELS
 *
 * Dropdown placeholders, unit/storage/parking status values, measurement units,
 * relationship labels, CRM labels, and general-purpose labels.
 *
 * @domain Shared UI Labels & Status Values
 * @consumers ~15 files
 */

// ============================================================================
// UNIT SALE STATUS
// ============================================================================

export const UNIT_SALE_STATUS = {
  NOT_SOLD: 'NOT_SOLD',
  SOLD: 'SOLD',
  RESERVED: 'RESERVED',
  PENDING: 'PENDING'
} as const;

// Operational Status Labels (physical/construction status)
export const OPERATIONAL_STATUS_LABELS = {
  ready: 'units.operationalStatus.ready',
  'under-construction': 'units.operationalStatus.underConstruction',
  inspection: 'units.operationalStatus.inspection',
  maintenance: 'units.operationalStatus.maintenance',
  draft: 'units.operationalStatus.draft'
} as const;
// ============================================================================
// OBLIGATION STATUS
// ============================================================================

export const OBLIGATION_STATUS_LABELS = {
  draft: 'common:documentStatus.draft',
  'in-review': 'common:documentStatus.inReview',
  returned: 'common:documentStatus.returned',
  approved: 'common:documentStatus.approved',
  issued: 'common:documentStatus.issued',
  superseded: 'common:documentStatus.superseded',
  archived: 'common:documentStatus.archived',
  completed: 'common:documentStatus.completed'
} as const;

export const getObligationStatusLabel = (status: string): string => {
  return OBLIGATION_STATUS_LABELS[status as keyof typeof OBLIGATION_STATUS_LABELS] || status;
};

// ============================================================================
// STORAGE & PROJECT TYPE LABELS
// ============================================================================

export const PROJECT_TYPE_LABELS = {
  residential: 'filters.types.residential',
  commercial: 'filters.types.commercial',
  infrastructure: 'filters.types.infrastructure'
} as const;

// ============================================================================
// DROPDOWN PLACEHOLDER LABELS
// ============================================================================

export const DROPDOWN_PLACEHOLDERS = {
  SELECT_COMPANY: 'common.dropdowns.selectCompany',
  SELECT_PROJECT: 'common.dropdowns.selectProject',
  SELECT_BUILDING: 'common.dropdowns.selectBuilding',
  SELECT_UNIT: 'common.dropdowns.selectUnit',
  SELECT_CLIENT: 'common.dropdowns.selectClient',
  SELECT_CONTACT: 'common.dropdowns.selectContact',
  SELECT_FILE: 'common.dropdowns.selectFile',
  SELECT_ENCODING: 'common.dropdowns.selectEncoding',
  SELECT_FLOOR: 'common.dropdowns.selectFloor',
  SELECT_TYPE: 'common.dropdowns.selectType',
  SELECT_STATUS: 'common.dropdowns.selectStatus',
  SELECT_STAGE: 'common.dropdowns.selectStage',
  GENERIC_SELECT: 'common.dropdowns.select'
} as const;

// ============================================================================
// STORAGE LABELS
// ============================================================================

export const STORAGE_LABELS = {
  LARGE: 'storage.sizes.large',
  SMALL: 'storage.sizes.small',
  BASEMENT_STORAGE: 'storage.locations.basement',
  GROUND_STORAGE: 'storage.locations.ground',
  SPECIAL_STORAGE: 'storage.locations.special',
  BUILDING_A: 'building.names.buildingA',
  BUILDING_B: 'building.names.buildingB',
  BUILDING_C: 'building.names.buildingC',
  BUILDING_D: 'building.names.buildingD',
  BUILDING_E: 'building.names.buildingE',
  BASEMENT_MINUS_2: 'building.floors.basementMinus2',
  BASEMENT_MINUS_1: 'building.floors.basementMinus1',
  GROUND_FLOOR: 'building.floors.ground',
  FIRST_FLOOR: 'building.floors.floor1',
  SECOND_FLOOR: 'building.floors.floor2',
  OTHER_FLOORS: 'building.floors.other'
} as const;


// ============================================================================
// GENERAL-PURPOSE LABELS
// ============================================================================

export const CONTACT_BUSINESS_TYPE_LABELS = {
  customer: 'contacts.businessTypes.customer',
  supplier: 'contacts.businessTypes.supplier',
  agent: 'contacts.businessTypes.agent',
  contractor: 'contacts.businessTypes.contractor'
} as const;

// ============================================================================
// PARKING TABLE COLUMN LABELS — ΔΙΑΓΡΑΦΗΚΕ (ADR-771 Φ.5, 2026-08-07)
// ============================================================================
//
// Το `PARKING_TABLE_COLUMN_LABELS` είχε **έναν** καταναλωτή, το
// `components/parking/parking-spot-table/config/columns.ts`, το οποίο ανήκε στο νεκρό
// υποδέντρο που έσβησε η Φ.5 (μηδέν διαδρομές το έφταναν). Χωρίς αυτόν, η σταθερά γινόταν
// νεκρό barrel export μέσω του `property-statuses-enterprise.ts` ⇒ παλινδρόμηση στο CHECK 3.30.
//
// ⚠️ Τα κλειδιά `parkingManagement.columns.*` **παραμένουν** στα `locales/{el,en}/projects-data.json`
// επίτηδες: η εκκαθάριση αχρησιμοποίητων κλειδιών locale είναι **άλλη ερώτηση** (και αγγίζει
// τα artifacts των CHECK 3.33/3.34). Δηλωμένο υπόλοιπο, όχι παράλειψη.
