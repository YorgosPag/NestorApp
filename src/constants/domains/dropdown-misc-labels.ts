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

export const UNIT_SALE_STATUS_LABELS = {
  [UNIT_SALE_STATUS.NOT_SOLD]: 'units.saleStatus.notSold',
  [UNIT_SALE_STATUS.SOLD]: 'units.saleStatus.sold',
  [UNIT_SALE_STATUS.RESERVED]: 'units.saleStatus.reserved',
  [UNIT_SALE_STATUS.PENDING]: 'units.saleStatus.pending'
} as const;

// Operational Status Labels (physical/construction status)
export const OPERATIONAL_STATUS_LABELS = {
  ready: 'units.operationalStatus.ready',
  'under-construction': 'units.operationalStatus.underConstruction',
  inspection: 'units.operationalStatus.inspection',
  maintenance: 'units.operationalStatus.maintenance',
  draft: 'units.operationalStatus.draft'
} as const;

export type OperationalStatusValue = keyof typeof OPERATIONAL_STATUS_LABELS;

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

export const STORAGE_TYPE_LABELS = {
  storage: 'storage.types.storage',
  parking: 'storage.types.parking'
} as const;

export const STORAGE_STATUS_LABELS = {
  available: 'storage.general.status.available',
  sold: 'storage.general.status.sold',
  reserved: 'storage.general.status.reserved',
  maintenance: 'storage.general.status.maintenance'
} as const;

export const PROJECT_TYPE_LABELS = {
  residential: 'filters.types.residential',
  commercial: 'filters.types.commercial',
  infrastructure: 'filters.types.infrastructure'
} as const;

// ============================================================================
// PRICE FILTER
// ============================================================================

export const PRICE_FILTER_LABELS = {
  ALL_PRICES: 'filters.allPrices'
} as const;

export function generatePriceRanges(currencySymbol: string = '€'): Array<{ value: string; label: string }> {
  return [
    { value: '', label: PRICE_FILTER_LABELS.ALL_PRICES },
    { value: '0-50000', label: `${currencySymbol}0 - ${currencySymbol}50.000` },
    { value: '50000-100000', label: `${currencySymbol}50.000 - ${currencySymbol}100.000` },
    { value: '100000-200000', label: `${currencySymbol}100.000 - ${currencySymbol}200.000` },
    { value: '200000+', label: `${currencySymbol}200.000+` }
  ];
}

// ============================================================================
// PROPERTY STANDARD FLOORS & LEGACY BRIDGE
// ============================================================================

export const PROPERTY_STANDARD_FLOORS: string[] = [
  'building.floors.basement3',
  'building.floors.basement2',
  'building.floors.basement1',
  'building.floors.basement',
  'building.floors.ground',
  'building.floors.floor1',
  'building.floors.floor2',
  'building.floors.floor3',
  'building.floors.floor4',
  'building.floors.floor5',
  'building.floors.floor6',
  'building.floors.floor7',
  'building.floors.floor8',
  'building.floors.floor9'
];

export const LEGACY_BRIDGE_IMPORTS = {} as const;

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
// PROCESS STEP LABELS (DXF Import & Project Creation)
// ============================================================================

export const PROCESS_STEP_LABELS = {
  STEP_1_COMPANY: 'dxfViewer.steps.selectCompany',
  STEP_2_PROJECT: 'dxfViewer.steps.selectProject',
  STEP_3_BUILDING: 'dxfViewer.steps.selectBuilding',
  STEP_4_UNIT: 'dxfViewer.steps.selectUnit',
  FILE_SELECTION: 'dxfViewer.steps.fileSelection',
  ENCODING_SELECTION: 'dxfViewer.steps.encodingSelection',
  DESTINATION_SELECTION: 'dxfViewer.steps.destinationSelection'
} as const;

// ============================================================================
// MEASUREMENT UNIT LABELS
// ============================================================================

export const MEASUREMENT_UNIT_LABELS = {
  MILLIMETERS: 'common.units.millimeters',
  CENTIMETERS: 'common.units.centimeters',
  METERS: 'common.units.meters',
  INCHES: 'common.units.inches',
  FEET: 'common.units.feet'
} as const;

export const MEASUREMENT_UNITS_OPTIONS = [
  { value: 'mm', label: MEASUREMENT_UNIT_LABELS.MILLIMETERS },
  { value: 'cm', label: MEASUREMENT_UNIT_LABELS.CENTIMETERS },
  { value: 'm', label: MEASUREMENT_UNIT_LABELS.METERS },
  { value: 'in', label: MEASUREMENT_UNIT_LABELS.INCHES },
  { value: 'ft', label: MEASUREMENT_UNIT_LABELS.FEET }
] as const;

// ============================================================================
// RELATIONSHIP LABELS
// ============================================================================

export const RELATIONSHIP_STATUS_LABELS = {
  ACTIVE: 'contacts.relationships.status.active',
  INACTIVE: 'contacts.relationships.status.inactive',
  PENDING: 'contacts.relationships.status.pending',
  TERMINATED: 'contacts.relationships.status.terminated',
  SUSPENDED: 'contacts.relationships.status.suspended'
} as const;

export const RELATIONSHIP_STATUS_OPTIONS = [
  { value: 'active', label: RELATIONSHIP_STATUS_LABELS.ACTIVE },
  { value: 'inactive', label: RELATIONSHIP_STATUS_LABELS.INACTIVE },
  { value: 'pending', label: RELATIONSHIP_STATUS_LABELS.PENDING },
  { value: 'terminated', label: RELATIONSHIP_STATUS_LABELS.TERMINATED },
  { value: 'suspended', label: RELATIONSHIP_STATUS_LABELS.SUSPENDED }
] as const;

export const RELATIONSHIP_TYPE_LABELS = {
  // Employment Relationships
  EMPLOYEE: 'contacts.relationships.types.employee',
  MANAGER: 'contacts.relationships.types.manager',
  DIRECTOR: 'contacts.relationships.types.director',
  EXECUTIVE: 'contacts.relationships.types.executive',
  INTERN: 'contacts.relationships.types.intern',
  CONTRACTOR: 'contacts.relationships.types.contractor',
  CONSULTANT: 'contacts.relationships.types.consultant',
  // Corporate Relationships
  SHAREHOLDER: 'contacts.relationships.types.shareholder',
  BOARD_MEMBER: 'contacts.relationships.types.boardMember',
  CHAIRMAN: 'contacts.relationships.types.chairman',
  CEO: 'contacts.relationships.types.ceo',
  REPRESENTATIVE: 'contacts.relationships.types.representative',
  PARTNER: 'contacts.relationships.types.partner',
  VENDOR: 'contacts.relationships.types.vendor',
  CLIENT: 'contacts.relationships.types.client',
  // Government/Service Relationships
  CIVIL_SERVANT: 'contacts.relationships.types.civilServant',
  ELECTED_OFFICIAL: 'contacts.relationships.types.electedOfficial',
  APPOINTED_OFFICIAL: 'contacts.relationships.types.appointedOfficial',
  DEPARTMENT_HEAD: 'contacts.relationships.types.departmentHead',
  MINISTRY_OFFICIAL: 'contacts.relationships.types.ministryOfficial',
  MAYOR: 'contacts.relationships.types.mayor',
  DEPUTY_MAYOR: 'contacts.relationships.types.deputyMayor',
  REGIONAL_GOVERNOR: 'contacts.relationships.types.regionalGovernor',
  // Other Professional Relationships
  ADVISOR: 'contacts.relationships.types.advisor',
  MENTOR: 'contacts.relationships.types.mentor',
  PROTEGE: 'contacts.relationships.types.protege',
  COLLEAGUE: 'contacts.relationships.types.colleague',
  SUPPLIER: 'contacts.relationships.types.supplier',
  CUSTOMER: 'contacts.relationships.types.customer',
  COMPETITOR: 'contacts.relationships.types.competitor',
  OTHER: 'contacts.relationships.types.other'
} as const;

// ============================================================================
// CRM & OPPORTUNITY LABELS
// ============================================================================

export const CRM_LABELS = {
  LEAD: 'crm.stages.lead',
  PROPOSAL: 'crm.stages.proposal',
  NEGOTIATION: 'crm.stages.negotiation',
  CLOSING: 'crm.stages.closing',
  WON: 'crm.stages.won',
  LOST: 'crm.stages.lost',
  INDIVIDUAL: 'contacts.types.individual',
  COMPANY: 'contacts.types.company',
  ORGANIZATION: 'contacts.types.organization'
} as const;

// ============================================================================
// PROPERTY VIEWER LABELS
// ============================================================================

export const PROPERTY_VIEWER_LABELS = {
  ALL_FLOORS: 'building.floors.allFloors',
  GROUND_FLOOR: 'building.floors.ground',
  BASEMENT: 'building.floors.basement',
  ELECTRICAL: 'building.connections.electrical',
  PLUMBING: 'building.connections.plumbing',
  HVAC: 'building.connections.hvac',
  INTERNET: 'building.connections.internet',
  PHONE: 'building.connections.phone'
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
// GETTER UTILITY FUNCTIONS
// ============================================================================

export const getDropdownPlaceholder = (key: keyof typeof DROPDOWN_PLACEHOLDERS): string => {
  return DROPDOWN_PLACEHOLDERS[key];
};

export const getProcessStepLabel = (key: keyof typeof PROCESS_STEP_LABELS): string => {
  return PROCESS_STEP_LABELS[key];
};

export const getDxfDestinationLabel = (key: string): string => {
  const DXF_DESTINATION_LABELS_INLINE = {
    GENERAL_PLAN: 'dxfViewer.destinations.generalPlan',
    PARKING_SPOTS: 'dxfViewer.destinations.parkingSpots',
    STORAGE_AREAS: 'dxfViewer.destinations.storageAreas',
    BUILDING_PLAN: 'dxfViewer.destinations.buildingPlan',
    UNIT_PLAN: 'dxfViewer.destinations.unitPlan'
  } as const;
  return DXF_DESTINATION_LABELS_INLINE[key as keyof typeof DXF_DESTINATION_LABELS_INLINE] || key;
};

export const getMeasurementUnitLabel = (key: keyof typeof MEASUREMENT_UNIT_LABELS): string => {
  return MEASUREMENT_UNIT_LABELS[key];
};

export const getRelationshipStatusLabel = (key: keyof typeof RELATIONSHIP_STATUS_LABELS): string => {
  return RELATIONSHIP_STATUS_LABELS[key];
};

export const getCrmLabel = (key: keyof typeof CRM_LABELS): string => {
  return CRM_LABELS[key];
};

export const getPropertyViewerLabel = (key: keyof typeof PROPERTY_VIEWER_LABELS): string => {
  return PROPERTY_VIEWER_LABELS[key];
};

// ============================================================================
// LEGACY DROPDOWN SUPPORT (backwards compatibility)
// ============================================================================

export const LEGACY_DROPDOWN_SUPPORT = {
  '-- Επιλέξτε Εταιρεία --': DROPDOWN_PLACEHOLDERS.SELECT_COMPANY,
  '-- Επιλέξτε Έργο --': DROPDOWN_PLACEHOLDERS.SELECT_PROJECT,
  '-- Επιλέξτε Κτίριο --': DROPDOWN_PLACEHOLDERS.SELECT_BUILDING,
  '-- Επιλέξτε Μονάδα --': DROPDOWN_PLACEHOLDERS.SELECT_UNIT,
  'Επιλογή πελάτη...': DROPDOWN_PLACEHOLDERS.SELECT_CLIENT,
  'Επιλογή ορόφου...': DROPDOWN_PLACEHOLDERS.SELECT_FLOOR,
  'Επιλογή τύπου': DROPDOWN_PLACEHOLDERS.SELECT_TYPE,
  'Επιλογή σταδίου...': DROPDOWN_PLACEHOLDERS.SELECT_STAGE,
  'Γενική Κάτοψη': 'dxfViewer.destinations.generalPlan',
  'Θέσεις Στάθμευσης': 'dxfViewer.destinations.parkingSpots',
  'Αποθήκες': 'dxfViewer.destinations.storageAreas'
} as const;

export const resolveLegacyDropdownString = (hardcodedString: string): string => {
  return LEGACY_DROPDOWN_SUPPORT[hardcodedString as keyof typeof LEGACY_DROPDOWN_SUPPORT] || hardcodedString;
};

// ============================================================================
// GENERAL-PURPOSE LABELS
// ============================================================================

export const GENDER_LABELS = {
  male: 'options.gender.male',
  female: 'options.gender.female',
  other: 'options.gender.other',
  prefer_not_to_say: 'options.gender.preferNotToSay'
} as const;

export const COUNTRY_LABELS = {
  GR: 'common.countries.greece',
  CY: 'common.countries.cyprus',
  US: 'common.countries.usa',
  DE: 'common.countries.germany',
  FR: 'common.countries.france',
  IT: 'common.countries.italy',
  ES: 'common.countries.spain',
  UK: 'common.countries.uk',
  AU: 'common.countries.australia',
  CA: 'common.countries.canada',
  OTHER: 'common.countries.other'
} as const;

export const CURRENCY_LABELS = {
  EUR: 'options.currencies.eur',
  USD: 'options.currencies.usd',
  GBP: 'options.currencies.gbp'
} as const;

export const SHAREHOLDER_TYPE_LABELS = {
  individual: 'options.shareholderTypes.individual',
  legal: 'options.shareholderTypes.legal'
} as const;

export const DOCUMENT_TYPE_LABELS = {
  certificate: 'contacts.company.documentTypes.certificate',
  announcement: 'contacts.company.documentTypes.announcement',
  registration: 'contacts.company.documentTypes.registration',
  amendment: 'contacts.company.documentTypes.amendment'
} as const;

export const BOARD_TYPE_LABELS = {
  general_assembly: 'contacts.company.boardTypes.generalAssembly',
  board_directors: 'contacts.company.boardTypes.boardDirectors',
  supervisory_board: 'contacts.company.boardTypes.supervisoryBoard'
} as const;

export const REPRESENTATIVE_POSITION_LABELS = {
  ceo: 'contacts.company.positions.ceo',
  president: 'contacts.company.positions.president',
  manager: 'contacts.company.positions.manager',
  legal_rep: 'contacts.company.positions.legalRep',
  secretary: 'contacts.company.positions.secretary'
} as const;

export const GEMI_STATUS_LABELS = {
  active: 'options.gemiStatuses.active',
  inactive: 'options.gemiStatuses.inactive',
  suspended: 'options.gemiStatuses.suspended',
  dissolution: 'options.gemiStatuses.dissolution',
  dissolved: 'options.gemiStatuses.dissolved',
  bankruptcy: 'options.gemiStatuses.bankruptcy',
  liquidation: 'options.gemiStatuses.liquidation'
} as const;

export const SERVICE_CATEGORY_LABELS = {
  ministry: 'options.serviceCategories.ministry',
  region: 'options.serviceCategories.region',
  municipality: 'options.serviceCategories.municipality',
  public_entity: 'options.serviceCategories.publicEntity',
  independent_authority: 'options.serviceCategories.independentAuthority',
  university: 'options.serviceCategories.university',
  hospital: 'options.serviceCategories.hospital',
  school: 'options.serviceCategories.school',
  other: 'options.serviceCategories.other'
} as const;

export const LEGAL_STATUS_LABELS = {
  npdd: 'options.legalStatuses.npdd',
  npid: 'options.legalStatuses.npid',
  public_service: 'options.legalStatuses.publicService',
  independent_authority: 'options.legalStatuses.independentAuthority',
  decentralized_admin: 'options.legalStatuses.decentralizedAdmin'
} as const;

export const BOOLEAN_LABELS = {
  yes: 'common.boolean.yes',
  no: 'common.boolean.no'
} as const;

export const CONTACT_BUSINESS_TYPE_LABELS = {
  customer: 'contacts.businessTypes.customer',
  supplier: 'contacts.businessTypes.supplier',
  agent: 'contacts.businessTypes.agent',
  contractor: 'contacts.businessTypes.contractor'
} as const;

export const AVAILABILITY_STATUS_LABELS = {
  unavailable: 'common.availability.unavailable',
  available: 'common.availability.available',
  occupied: 'common.availability.occupied'
} as const;

export const BUILDING_NAME_FILTER_LABELS = {
  NAME_A_TO_Z: 'filters.sorting.nameAZ',
  NAME_Z_TO_A: 'filters.sorting.nameZA',
  CONTAINS_TOWER: 'filters.building.containsTower',
  CONTAINS_COMPLEX: 'filters.building.containsComplex'
} as const;

export const EMPLOYMENT_STATUS_LABELS = {
  FULL_TIME: 'contacts.employment.status.fullTime',
  PART_TIME: 'contacts.employment.status.partTime',
  CONTRACT: 'contacts.employment.status.contract',
  TEMPORARY: 'contacts.employment.status.temporary',
  SEASONAL: 'contacts.employment.status.seasonal',
  VOLUNTEER: 'contacts.employment.status.volunteer',
  RETIRED: 'contacts.employment.status.retired',
  ON_LEAVE: 'contacts.employment.status.onLeave',
  TERMINATED: 'contacts.employment.status.terminated'
} as const;

export const TREND_LABELS = {
  increase: 'common.trends.increase',
  decrease: 'common.trends.decrease',
  stable: 'common.trends.stable',
  improvement: 'common.trends.improvement',
  new: 'common.trends.new',
  updated: 'common.trends.updated'
} as const;

// ============================================================================
// PARKING TABLE COLUMN LABELS
// ============================================================================

export const PARKING_TABLE_COLUMN_LABELS = {
  CODE: 'parkingManagement.columns.code',
  TYPE: 'parkingManagement.columns.type',
  PROPERTY_CODE: 'parkingManagement.columns.property',
  LEVEL: 'parkingManagement.columns.level',
  AREA: 'parkingManagement.columns.area',
  PRICE: 'parkingManagement.columns.price',
  VALUE: 'parkingManagement.columns.value',
  VALUE_WITH_SYNDICATE: 'parkingManagement.columns.valueWithSyndicate',
  STATUS: 'parkingManagement.columns.status',
  OWNER: 'parkingManagement.columns.owner',
  FLOOR_PLAN: 'parkingManagement.columns.floorPlan',
  CONSTRUCTED_BY: 'parkingManagement.columns.registeredBy',
  ACTIONS: 'parkingManagement.columns.actions'
} as const;
