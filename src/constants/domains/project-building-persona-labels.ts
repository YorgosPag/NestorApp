/**
 * PROJECT, BUILDING & PERSONA LABELS
 *
 * Project tab labels, building toolbar labels, and persona system labels (ADR-121).
 *
 * @domain Project Management, Building UI, Contact Persona System
 * @consumers project-tabs-config.ts, BuildingToolbar.tsx, persona-config.ts
 */

// ============================================================================
// PROJECT TAB LABELS
// ============================================================================

export const PROJECT_TAB_LABELS = {
  GENERAL: 'tabs.labels.projectGeneral',
  FLOORPLAN: 'tabs.labels.projectFloorplan',
  PARKING_FLOORPLAN: 'tabs.labels.parkingFloorplan',
  STRUCTURE: 'tabs.labels.projectStructure',
  TIMELINE: 'tabs.labels.timeline',
  CUSTOMERS: 'tabs.labels.customers',
  BUILDING_DATA: 'tabs.labels.buildingData',
  PARKING: 'tabs.labels.parking',
  CONTRIBUTORS: 'tabs.labels.contributors',
  DOCUMENTS: 'tabs.labels.projectDocuments',
  IKA: 'tabs.labels.ika',
  PHOTOS: 'tabs.labels.photos',
  VIDEOS: 'tabs.labels.videos',
  HISTORY: 'tabs.labels.history',
  BROKERS: 'tabs.labels.brokers',
  OWNERSHIP_TABLE: 'tabs.labels.ownershipTable',
  LANDOWNERS: 'tabs.labels.landowners',
} as const;

export const PROJECT_TAB_DESCRIPTIONS = {
  GENERAL: 'tabs.descriptions.projectGeneral',
  FLOORPLAN: 'tabs.descriptions.projectFloorplan',
  PARKING_FLOORPLAN: 'tabs.descriptions.parkingFloorplan',
  STRUCTURE: 'tabs.descriptions.projectStructure',
  TIMELINE: 'tabs.descriptions.timeline',
  CUSTOMERS: 'tabs.descriptions.customers',
  BUILDING_DATA: 'tabs.descriptions.buildingData',
  PARKING: 'tabs.descriptions.parking',
  CONTRIBUTORS: 'tabs.descriptions.contributors',
  DOCUMENTS: 'tabs.descriptions.projectDocuments',
  IKA: 'tabs.descriptions.ika',
  PHOTOS: 'tabs.descriptions.photos',
  VIDEOS: 'tabs.descriptions.videos',
  HISTORY: 'tabs.descriptions.history',
  BROKERS: 'tabs.descriptions.brokers',
  OWNERSHIP_TABLE: 'tabs.descriptions.ownershipTable',
  LANDOWNERS: 'tabs.descriptions.landowners',
} as const;

export const PROJECT_COMPONENT_LABELS = {
  FLOORPLAN_TITLE: 'floorplan.titles.project',
  PARKING_FLOORPLAN_TITLE: 'floorplan.titles.parking'
} as const;

// ============================================================================
// BUILDING TOOLBAR LABELS
// ============================================================================

export const BUILDING_TOOLBAR_LABELS = {
  NEW_BUILDING: 'building.toolbar.newBuilding',
  EDIT_BUILDING: 'building.toolbar.editBuilding',
  DELETE_BUILDING: 'building.toolbar.deleteBuilding',
  EXPORT: 'common-actions:actions.export',
  IMPORT: 'common-actions:actions.import',
  REFRESH: 'common-actions:actions.refresh',
  ARCHIVE: 'building.toolbar.archive',
  FAVORITES: 'toolbar.labels.favorites',
  HELP: 'common-actions:actions.help',
  STATUS_FILTER: 'filters.fields.status',
  TYPE_FILTER: 'filters.fields.type',
  SORT_FILTER: 'filters.fields.sort'
} as const;

export const BUILDING_TOOLBAR_TOOLTIPS = {
  NEW_BUILDING: 'building.toolbar.tooltips.newBuilding',
  EDIT_BUILDING: 'building.toolbar.tooltips.editBuilding',
  DELETE_BUILDING_SINGLE: 'building.toolbar.tooltips.deleteBuilding',
  DELETE_BUILDING_MULTIPLE: 'building.toolbar.tooltips.deleteBuildingMultiple',
  EXPORT_DATA: 'building.toolbar.tooltips.exportData',
  IMPORT_DATA: 'building.toolbar.tooltips.importData',
  REFRESH_DATA: 'building.toolbar.tooltips.refreshData',
  ARCHIVE_SELECTED: 'building.toolbar.tooltips.archiveSelected',
  ADD_TO_FAVORITES: 'building.toolbar.tooltips.addToFavorites',
  SHOW_HELP: 'building.toolbar.tooltips.showHelp'
} as const;

export const BUILDING_TOOLBAR_UI_LABELS = {
  SEARCH_PLACEHOLDER: 'building.toolbar.ui.searchPlaceholder',
  BUILDING_STATUS_LABEL: 'building.toolbar.ui.statusLabel',
  BUILDING_TYPE_LABEL: 'building.toolbar.ui.typeLabel',
  BUILDING_SORTING_LABEL: 'building.toolbar.ui.sortingLabel',
  SORT_ASCENDING: 'filters.sorting.ascending',
  SORT_DESCENDING: 'filters.sorting.descending',
  SORT_BY_DATE: 'filters.sorting.byDate',
  SORT_BY_SIZE: 'filters.sorting.bySize',
  SELECTED_BUILDINGS: 'building.toolbar.ui.selectedBuildings'
} as const;

// ============================================================================
// PERSONA LABELS (ADR-121)
// ============================================================================

/**
 * Persona Type Labels — Contact Role Classification
 * SAP Business Partner pattern
 */
export const PERSONA_TYPE_LABELS = {
  CONSTRUCTION_WORKER: 'persona.types.constructionWorker',
  ENGINEER: 'persona.types.engineer',
  ACCOUNTANT: 'persona.types.accountant',
  LAWYER: 'persona.types.lawyer',
  PROPERTY_OWNER: 'persona.types.propertyOwner',
  CLIENT: 'persona.types.client',
  SUPPLIER: 'persona.types.supplier',
  NOTARY: 'persona.types.notary',
  REAL_ESTATE_AGENT: 'persona.types.realEstateAgent',
} as const;

export const PERSONA_TYPE_ICONS = {
  CONSTRUCTION_WORKER: 'hard-hat',
  ENGINEER: 'ruler',
  ACCOUNTANT: 'calculator',
  LAWYER: 'scale',
  PROPERTY_OWNER: 'home',
  CLIENT: 'user-check',
  SUPPLIER: 'package',
  NOTARY: 'file-signature',
  REAL_ESTATE_AGENT: 'key',
} as const;

export const PERSONA_FIELD_LABELS = {
  // Construction Worker (ΕΦΚΑ/ΙΚΑ)
  IKA_NUMBER: 'persona.fields.ikaNumber',
  INSURANCE_CLASS: 'persona.fields.insuranceClass',
  TRIENNIA: 'persona.fields.triennia',
  DAILY_WAGE: 'persona.fields.dailyWage',
  SPECIALTY_CODE: 'persona.fields.specialtyCode',
  EFKA_REGISTRATION_DATE: 'persona.fields.efkaRegistrationDate',
  // Engineer (ΤΕΕ)
  TEE_REGISTRY_NUMBER: 'persona.fields.teeRegistryNumber',
  ENGINEER_SPECIALTY: 'persona.fields.engineerSpecialty',
  LICENSE_CLASS: 'persona.fields.licenseClass',
  PTDE_NUMBER: 'persona.fields.ptdeNumber',
  // Accountant (ΟΕΕ)
  OEE_NUMBER: 'persona.fields.oeeNumber',
  ACCOUNTING_CLASS: 'persona.fields.accountingClass',
  // Lawyer
  BAR_ASSOCIATION_NUMBER: 'persona.fields.barAssociationNumber',
  BAR_ASSOCIATION: 'persona.fields.barAssociation',
  // Property Owner
  PROPERTY_COUNT: 'persona.fields.propertyCount',
  OWNERSHIP_NOTES: 'persona.fields.ownershipNotes',
  // Client
  CLIENT_SINCE: 'persona.fields.clientSince',
  // Supplier
  SUPPLIER_CATEGORY: 'persona.fields.supplierCategory',
  PAYMENT_TERMS_DAYS: 'persona.fields.paymentTermsDays',
  // Notary
  NOTARY_REGISTRY_NUMBER: 'persona.fields.notaryRegistryNumber',
  NOTARY_DISTRICT: 'persona.fields.notaryDistrict',
  // Real Estate Agent
  RE_LICENSE_NUMBER: 'persona.fields.reLicenseNumber',
  RE_AGENCY: 'persona.fields.reAgency',
} as const;

export const PERSONA_SECTION_LABELS = {
  CONSTRUCTION_WORKER_TITLE: 'persona.sections.constructionWorker.title',
  CONSTRUCTION_WORKER_DESCRIPTION: 'persona.sections.constructionWorker.description',
  ENGINEER_TITLE: 'persona.sections.engineer.title',
  ENGINEER_DESCRIPTION: 'persona.sections.engineer.description',
  ACCOUNTANT_TITLE: 'persona.sections.accountant.title',
  ACCOUNTANT_DESCRIPTION: 'persona.sections.accountant.description',
  LAWYER_TITLE: 'persona.sections.lawyer.title',
  LAWYER_DESCRIPTION: 'persona.sections.lawyer.description',
  PROPERTY_OWNER_TITLE: 'persona.sections.propertyOwner.title',
  PROPERTY_OWNER_DESCRIPTION: 'persona.sections.propertyOwner.description',
  CLIENT_TITLE: 'persona.sections.client.title',
  CLIENT_DESCRIPTION: 'persona.sections.client.description',
  SUPPLIER_TITLE: 'persona.sections.supplier.title',
  SUPPLIER_DESCRIPTION: 'persona.sections.supplier.description',
  NOTARY_TITLE: 'persona.sections.notary.title',
  NOTARY_DESCRIPTION: 'persona.sections.notary.description',
  REAL_ESTATE_AGENT_TITLE: 'persona.sections.realEstateAgent.title',
  REAL_ESTATE_AGENT_DESCRIPTION: 'persona.sections.realEstateAgent.description',
} as const;
