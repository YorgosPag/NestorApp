import type { TOptions } from 'i18next';

const LEGACY_NAMESPACE_ROOT_MAP = {
  building: {
    storage: 'building-storage',
    storages: 'building-storage',
    storageMap: 'building-storage',
    storageSummary: 'building-storage',
    storageActions: 'building-storage',
    storageListHeader: 'building-storage',
    storageTabHeader: 'building-storage',
    storageTable: 'building-storage',
    storageNotifications: 'building-storage',
    storageView: 'building-storage',
    storageStats: 'building-storage',
    storageForm: 'building-storage',
    parkings: 'building-storage',
    parkingStats: 'building-storage',
    unitStats: 'building-storage',
    spaceActions: 'building-storage',
    spaceConfirm: 'building-storage',
    spaceLink: 'building-storage',
    map: 'building-storage',
    floorplan: 'building-storage',
    tabs: 'building-tabs',
    analytics: 'building-timeline',
    filters: 'building-filters',
    address: 'building-address',
    associations: 'building-address',
    photos: 'building-address',
  },
  'dxf-viewer': {
    common: 'dxf-viewer-shell',
    toolbar: 'dxf-viewer-shell',
    toolbarStatus: 'dxf-viewer-shell',
    actionButtons: 'dxf-viewer-shell',
    loadingStates: 'dxf-viewer-shell',
    autoSave: 'dxf-viewer-shell',
    confirmations: 'dxf-viewer-shell',
    zoomControls: 'dxf-viewer-shell',
    overlayToolbar: 'dxf-viewer-shell',
    toolLabels: 'dxf-viewer-shell',
    toolGroups: 'dxf-viewer-shell',
    tools: 'dxf-viewer-shell',
    snapModes: 'dxf-viewer-shell',
    panels: 'dxf-viewer-panels',
    layerActions: 'dxf-viewer-panels',
    search: 'dxf-viewer-panels',
    mergePanel: 'dxf-viewer-panels',
    levelPanel: 'dxf-viewer-panels',
    sceneInfo: 'dxf-viewer-panels',
    overlayProperties: 'dxf-viewer-panels',
    overlayCard: 'dxf-viewer-panels',
    overlayList: 'dxf-viewer-panels',
    levelCard: 'dxf-viewer-panels',
    pdfPanel: 'dxf-viewer-panels',
    cadDock: 'dxf-viewer-panels',
    layerManager: 'dxf-viewer-panels',
    settings: 'dxf-viewer-settings',
    lineSettings: 'dxf-viewer-settings',
    gridSettings: 'dxf-viewer-settings',
    selectionSettings: 'dxf-viewer-settings',
    cursorSettings: 'dxf-viewer-settings',
    crosshairSettings: 'dxf-viewer-settings',
    rulerSettings: 'dxf-viewer-settings',
    layersSettings: 'dxf-viewer-settings',
    entitiesSettings: 'dxf-viewer-settings',
    dxfSettings: 'dxf-viewer-settings',
    currentSettings: 'dxf-viewer-settings',
    specificSettings: 'dxf-viewer-settings',
    dynamicInput: 'dxf-viewer-settings',
    wizard: 'dxf-viewer-wizard',
    wizardProgress: 'dxf-viewer-wizard',
    import: 'dxf-viewer-wizard',
    importModal: 'dxf-viewer-wizard',
    importWizard: 'dxf-viewer-wizard',
    dxfViewer: 'dxf-viewer-wizard',
    calibration: 'dxf-viewer-wizard',
    calibrationStep: 'dxf-viewer-wizard',
    textTemplates: 'dxf-viewer-wizard',
    promptDialog: 'dxf-viewer-wizard',
    entityJoin: 'dxf-viewer-wizard',
    guidePanel: 'dxf-viewer-guides',
    guideGroups: 'dxf-viewer-guides',
    guideMenuGroups: 'dxf-viewer-guides',
    guideContextMenu: 'dxf-viewer-guides',
    guides: 'dxf-viewer-guides',
    guideBatchMenu: 'dxf-viewer-guides',
    guideAnalysis: 'dxf-viewer-guides',
    aiAssistant: 'dxf-viewer-guides',
  },
  'geo-canvas': {
    drawingInterfaces: 'geo-canvas-drawing',
    hardcodedTexts: 'geo-canvas-drawing',
    citizenDrawingInterface: 'geo-canvas-drawing',
  },
  crm: {
    calendarPage: 'crm-inbox',
    inbox: 'crm-inbox',
  },
  accounting: {
    setup: 'accounting-setup',
    reconciliation: 'accounting-setup',
  },
  files: {
    floorplan: 'files-media',
    floorplanImport: 'files-media',
    media: 'files-media',
    capture: 'files-media',
  },
  navigation: {
    entities: 'navigation-entities',
    filters: 'navigation-entities',
  },
  reports: {
    crm: 'reports-extended',
    spaces: 'reports-extended',
  },
  projects: {
    plot: 'projects-data',
    timelineTab: 'projects-data',
    timeline: 'projects-data',
    structure: 'projects-data',
    buildings: 'projects-data',
    metrics: 'projects-data',
    customers: 'projects-data',
    errors: 'projects-data',
    financial: 'projects-data',
    parking: 'projects-data',
    permits: 'projects-data',
    plotZoning: 'projects-data',
    units: 'projects-data',
    basicInfo: 'projects-data',
    permitsTab: 'projects-data',
    videosTab: 'projects-data',
    contributorsTab: 'projects-data',
    attachmentsTab: 'projects-data',
    documentsTab: 'projects-data',
    plotDataTab: 'projects-data',
    otherDataTab: 'projects-data',
    statsGrid: 'projects-data',
    generalTab: 'projects-data',
    buildingDataTabs: 'projects-data',
    parkingManagement: 'projects-data',
    actualBuildingData: 'projects-data',
    buildingData: 'projects-data',
    address: 'projects-data',
    locations: 'projects-data',
    measurements: 'projects-data',
    ika: 'projects-ika',
  },
  payments: {
    loanTracking: 'payments-loans',
    chequeRegistry: 'payments-loans',
    costCalculator: 'payments-cost-calc',
  },
  contacts: {
    emptyState: 'contacts-core',
    export: 'contacts-core',
    import: 'contacts-core',
    header: 'contacts-core',
    page: 'contacts-core',
    list: 'contacts-core',
    types: 'contacts-core',
    card: 'contacts-core',
    stats: 'contacts-core',
    projects: 'contacts-core',
    properties: 'contacts-core',
    details: 'contacts-core',
    toolbar: 'contacts-core',
    dialog: 'contacts-core',
    fields: 'contacts-core',
    common: 'contacts-core',
    sections: 'contacts-core',
    sectionDescriptions: 'contacts-core',
    creation: 'contacts-core',
    basicInfo: 'contacts-core',
    placeholderTab: 'contacts-core',
    navigation: 'contacts-core',
    filterBar: 'contacts-core',
    duplicate: 'contacts-core',
    form: 'contacts-form',
    options: 'contacts-form',
    identity: 'contacts-form',
    professional: 'contacts-form',
    address: 'contacts-form',
    company: 'contacts-form',
    employment: 'contacts-form',
    businessTypes: 'contacts-form',
    validation: 'contacts-form',
    submission: 'contacts-form',
    addressesSection: 'contacts-form',
    relationships: 'contacts-relationships',
    communication: 'contacts-relationships',
    service: 'contacts-relationships',
    individual: 'contacts-relationships',
    esco: 'contacts-relationships',
    employer: 'contacts-relationships',
    persona: 'contacts-relationships',
    bankingTab: 'contacts-banking',
    trash: 'contacts-lifecycle',
    identityImpact: 'contacts-lifecycle',
  },
  common: {
    actions: 'common-actions',
    navigation: 'common-navigation',
    status: 'common-status',
    loadingStates: 'common-status',
    validation: 'common-validation',
    confirmations: 'common-validation',
    dialogs: 'common-validation',
    emptyState: 'common-empty-states',
    sales: 'common-sales',
    salesStorage: 'common-sales',
    salesParking: 'common-sales',
    account: 'common-account',
    twoFactor: 'common-account',
    userMenu: 'common-account',
    photo: 'common-photos',
    photos: 'common-photos',
    photoPreview: 'common-photos',
    photoCard: 'common-photos',
    photoManager: 'common-photos',
    upload: 'common-photos',
    toolbar: 'common-shared',
    filters: 'common-shared',
    contacts: 'common-shared',
    customerActions: 'common-shared',
    sharing: 'common-shared',
    recipients: 'common-shared',
    email: 'common-shared',
    search: 'common-shared',
    ownership: 'common-shared',
    workspace: 'common-shared',
    productTour: 'common-shared',
    voiceAssistant: 'common-shared',
    voiceDictation: 'common-shared',
  },
  properties: {
    status: 'properties-enums',
    rental: 'properties-enums',
    specialStatus: 'properties-enums',
    types: 'properties-enums',
    enhancedStatus: 'properties-enums',
    commercialStatus: 'properties-enums',
    intent: 'properties-enums',
    availability: 'properties-enums',
    priority: 'properties-enums',
    units: 'properties-enums',
    orientation: 'properties-enums',
    condition: 'properties-enums',
    energy: 'properties-enums',
    systems: 'properties-enums',
    finishes: 'properties-enums',
    features: 'properties-enums',
    operationalStatus: 'properties-enums',
    card: 'properties-detail',
    fields: 'properties-detail',
    fieldLocking: 'properties-detail',
    entityCode: 'properties-detail',
    entityLinks: 'properties-detail',
    meta: 'properties-detail',
    details: 'properties-detail',
    versionHistory: 'properties-detail',
    contacts: 'properties-detail',
    multiLevel: 'properties-detail',
    documents: 'properties-detail',
    attachments: 'properties-detail',
    dates: 'properties-detail',
    share: 'properties-detail',
    navigation: 'properties-detail',
    buildingSelector: 'properties-detail',
    viewer: 'properties-viewer',
    statusLegend: 'properties-viewer',
    editPanel: 'properties-viewer',
    detailsPanel: 'properties-viewer',
    suggestions: 'properties-viewer',
    hover: 'properties-viewer',
    hoverInfo: 'properties-viewer',
    connectionPanel: 'properties-viewer',
    floorPlan: 'properties-viewer',
    floorPlanToolbar: 'properties-viewer',
    floorSelector: 'properties-viewer',
    propertyCount: 'properties-viewer',
    creation: 'properties-viewer',
    multiLevelIndicator: 'properties-viewer',
    layerDetails: 'properties-viewer',
    viewerFilters: 'properties-viewer',
  },
} as const;

/**
 * Nested key remapping for split namespaces where a root key is shared.
 * E.g., `tabs` stays in building, but `tabs.timeline` and `tabs.analytics` moved to building-timeline.
 * Format: { legacyNamespace: { rootKey: { secondLevelKey: targetNamespace } } }
 */
const LEGACY_NESTED_MAP: Record<string, Record<string, Record<string, string>>> = {
  building: {
    tabs: {
      timeline: 'building-timeline',
      analytics: 'building-timeline',
    },
  },
};

type LegacyNamespace = keyof typeof LEGACY_NAMESPACE_ROOT_MAP;

type NamespaceRootMap<TNamespace extends LegacyNamespace> = keyof (typeof LEGACY_NAMESPACE_ROOT_MAP)[TNamespace];

function isTOptions(value: unknown): value is TOptions {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getExplicitNamespace(key: string): { namespace: string | null; bareKey: string } {
  const separatorIndex = key.indexOf(':');
  if (separatorIndex === -1) {
    return { namespace: null, bareKey: key };
  }

  return {
    namespace: key.slice(0, separatorIndex),
    bareKey: key.slice(separatorIndex + 1),
  };
}

function getLegacyRoot(key: string): string {
  return key.split('.')[0] || key;
}

function getNestedTarget(legacyNamespace: string, bareKey: string): string | undefined {
  const nestedMap = LEGACY_NESTED_MAP[legacyNamespace];
  if (!nestedMap) return undefined;

  const segments = bareKey.split('.');
  if (segments.length < 2) return undefined;

  const rootKey = segments[0];
  const secondKey = segments[1];
  return nestedMap[rootKey]?.[secondKey];
}

function buildRemappedResult(targetNamespace: string, bareKey: string, legacyNamespace: string, options: unknown): { key: string; options: unknown } {
  const nextKey = `${targetNamespace}:${bareKey}`;
  if (!isTOptions(options)) {
    return { key: nextKey, options };
  }

  const nextOptions: TOptions = { ...options };
  if (nextOptions.ns === legacyNamespace) {
    delete nextOptions.ns;
  }

  return { key: nextKey, options: nextOptions };
}

function remapNamespaceKey<TNamespace extends LegacyNamespace>(legacyNamespace: TNamespace, key: string, options?: unknown): { key: string; options: unknown } {
  const explicit = getExplicitNamespace(key);
  const requestedNamespace = isTOptions(options) ? options.ns : undefined;
  const effectiveNamespace = explicit.namespace ?? requestedNamespace;

  if (effectiveNamespace !== legacyNamespace) {
    return { key, options };
  }

  // Check nested mappings first (e.g., tabs.timeline → building-timeline)
  const nestedTarget = getNestedTarget(legacyNamespace, explicit.bareKey);
  if (nestedTarget) {
    return buildRemappedResult(nestedTarget, explicit.bareKey, legacyNamespace, options);
  }

  // Fall back to root-level mapping
  const legacyRoot = getLegacyRoot(explicit.bareKey) as NamespaceRootMap<TNamespace>;
  const targetNamespace = LEGACY_NAMESPACE_ROOT_MAP[legacyNamespace][legacyRoot];
  if (!targetNamespace) {
    return { key, options };
  }

  return buildRemappedResult(targetNamespace, explicit.bareKey, legacyNamespace, options);
}

export function remapLegacyTranslationKey(key: string, options?: unknown): { key: string; options: unknown } {
  for (const ns of LEGACY_NAMESPACES) {
    const result = remapNamespaceKey(ns, key, options);
    if (result.key !== key || result.options !== options) {
      return result;
    }
  }
  return { key, options };
}

const LEGACY_NAMESPACES: LegacyNamespace[] = [
  'building', 'dxf-viewer', 'contacts', 'projects', 'payments',
  'geo-canvas', 'crm', 'accounting', 'files', 'navigation', 'reports',
  'common', 'properties',
];

export const BUILDING_COMPATIBILITY_NAMESPACES = [
  'building-storage',
  'building-address',
  'building-filters',
  'building-timeline',
  'building-tabs',
] as const;

export const DXF_VIEWER_COMPATIBILITY_NAMESPACES = [
  'dxf-viewer-shell',
  'dxf-viewer-panels',
  'dxf-viewer-settings',
  'dxf-viewer-wizard',
  'dxf-viewer-guides',
] as const;

export const CONTACTS_COMPATIBILITY_NAMESPACES = [
  'contacts-core',
  'contacts-form',
  'contacts-relationships',
  'contacts-banking',
  'contacts-lifecycle',
] as const;

export const PROJECTS_COMPATIBILITY_NAMESPACES = [
  'projects-data',
  'projects-ika',
] as const;

export const PAYMENTS_COMPATIBILITY_NAMESPACES = [
  'payments-loans',
  'payments-cost-calc',
] as const;

export const GEO_CANVAS_COMPATIBILITY_NAMESPACES = ['geo-canvas-drawing'] as const;
export const CRM_COMPATIBILITY_NAMESPACES = ['crm-inbox'] as const;
export const ACCOUNTING_COMPATIBILITY_NAMESPACES = ['accounting-setup'] as const;
export const FILES_COMPATIBILITY_NAMESPACES = ['files-media'] as const;
export const NAVIGATION_COMPATIBILITY_NAMESPACES = ['navigation-entities'] as const;
export const REPORTS_COMPATIBILITY_NAMESPACES = ['reports-extended'] as const;

export const COMMON_COMPATIBILITY_NAMESPACES = [
  'common-actions',
  'common-navigation',
  'common-status',
  'common-validation',
  'common-empty-states',
  'common-sales',
  'common-account',
  'common-photos',
  'common-shared',
] as const;

export const PROPERTIES_COMPATIBILITY_NAMESPACES = [
  'properties-detail',
  'properties-enums',
  'properties-viewer',
] as const;

// =============================================================================
// 🏢 COMPAT NAMESPACE MAP — used by useTranslation to auto-load split namespaces
// =============================================================================

const COMPAT_NAMESPACE_MAP: Record<string, readonly string[]> = {
  common: COMMON_COMPATIBILITY_NAMESPACES,
  properties: PROPERTIES_COMPATIBILITY_NAMESPACES,
  building: BUILDING_COMPATIBILITY_NAMESPACES,
  contacts: CONTACTS_COMPATIBILITY_NAMESPACES,
  projects: PROJECTS_COMPATIBILITY_NAMESPACES,
  payments: PAYMENTS_COMPATIBILITY_NAMESPACES,
  'dxf-viewer': DXF_VIEWER_COMPATIBILITY_NAMESPACES,
  'geo-canvas': GEO_CANVAS_COMPATIBILITY_NAMESPACES,
  crm: CRM_COMPATIBILITY_NAMESPACES,
  accounting: ACCOUNTING_COMPATIBILITY_NAMESPACES,
  files: FILES_COMPATIBILITY_NAMESPACES,
  navigation: NAVIGATION_COMPATIBILITY_NAMESPACES,
  reports: REPORTS_COMPATIBILITY_NAMESPACES,
};

/**
 * Returns the split compat namespaces that must be loaded alongside a parent namespace.
 * E.g. 'properties' → ['properties-detail', 'properties-enums', 'properties-viewer']
 */
export function getCompatNamespaces(namespace: string): readonly string[] {
  return COMPAT_NAMESPACE_MAP[namespace] ?? [];
}
