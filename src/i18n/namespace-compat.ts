import type { TOptions } from 'i18next';

const LEGACY_NAMESPACE_ROOT_MAP = {
  common: {
    actions: 'common-actions',
    navigation: 'common-navigation',
    status: 'common-status',
    loadingStates: 'common-status',
    validation: 'common-validation',
    confirmations: 'common-validation',
    dialogs: 'common-validation',
    emptyState: 'common-empty-states',
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

function remapNamespaceKey<TNamespace extends LegacyNamespace>(legacyNamespace: TNamespace, key: string, options?: unknown): { key: string; options: unknown } {
  const explicit = getExplicitNamespace(key);
  const requestedNamespace = isTOptions(options) ? options.ns : undefined;
  const effectiveNamespace = explicit.namespace ?? requestedNamespace;

  if (effectiveNamespace !== legacyNamespace) {
    return { key, options };
  }

  const legacyRoot = getLegacyRoot(explicit.bareKey) as NamespaceRootMap<TNamespace>;
  const targetNamespace = LEGACY_NAMESPACE_ROOT_MAP[legacyNamespace][legacyRoot];
  if (!targetNamespace) {
    return { key, options };
  }

  const nextKey = `${targetNamespace}:${explicit.bareKey}`;
  if (!isTOptions(options)) {
    return { key: nextKey, options };
  }

  const nextOptions: TOptions = { ...options };
  if (nextOptions.ns === legacyNamespace) {
    delete nextOptions.ns;
  }

  return {
    key: nextKey,
    options: nextOptions,
  };
}

export function remapLegacyTranslationKey(key: string, options?: unknown): { key: string; options: unknown } {
  const commonRemap = remapNamespaceKey('common', key, options);
  if (commonRemap.key !== key || commonRemap.options !== options) {
    return commonRemap;
  }

  return remapNamespaceKey('properties', key, options);
}

export const COMMON_COMPATIBILITY_NAMESPACES = [
  'common-actions',
  'common-navigation',
  'common-status',
  'common-validation',
  'common-empty-states',
] as const;

export const PROPERTIES_COMPATIBILITY_NAMESPACES = [
  'properties-detail',
  'properties-enums',
  'properties-viewer',
] as const;
