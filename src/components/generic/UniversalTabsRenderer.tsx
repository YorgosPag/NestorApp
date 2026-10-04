'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { Property } from '@/types/property-viewer';
import type { Building } from '@/components/building-management/BuildingsPageContent';
import type { Storage } from '@/types/storage/contracts';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';
import type { BuildingFloorplanData } from '@/services/floorplans/BuildingFloorplanService';
import type { FloorData, ViewerPassthroughProps, ViewerPassthroughPropsWithFloors } from '@/features/properties-sidebar/types';
import { TabsOnlyTriggers, TabsContent, type TabDefinition } from "@/components/ui/navigation/TabsComponents";
import { getIconComponent } from './utils/IconMapping';
import { entityIdOf, type UniversalTabConfig } from './universal-tabs-config';
import { floorplanViewerTabProps } from './floorplan-viewer-tab-props';
import PlaceholderTab from '../building-management/tabs/PlaceholderTab';

// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('UniversalTabsRenderer');

// ============================================================================
// 🏢 ENTERPRISE: Lazy Tab Content Wrapper
// ============================================================================

/**
 * 🏢 ENTERPRISE: LazyTabContent
 *
 * Renders tab content ONLY when the tab is active.
 * Prevents premature API calls and component mounting for inactive tabs.
 *
 * This is the enterprise pattern used by SAP, Salesforce, and other large apps.
 */
interface LazyTabContentProps {
  tabId: string;
  activeTab: string;
  children: React.ReactNode;
}

function LazyTabContent({ tabId, activeTab, children }: LazyTabContentProps) {
  // 🏢 ENTERPRISE: Only render content when this tab is/was active
  // Initialize hasBeenActive to true if this tab is the default (active on mount)
  const [hasBeenActive, setHasBeenActive] = React.useState(tabId === activeTab);

  React.useEffect(() => {
    if (tabId === activeTab && !hasBeenActive) {
      setHasBeenActive(true);
    }
  }, [tabId, activeTab, hasBeenActive]);

  // Don't render until tab has been activated at least once
  if (!hasBeenActive) {
    return null;
  }

  return <>{children}</>;
}

// Το σχήμα ρύθμισης ζει στο `universal-tabs-config` (N.7.1)· επανεξάγεται για τα υπάρχοντα imports.
export {
  convertToUniversalConfig,
  isUniversalTabConfig,
} from './universal-tabs-config';
export type { TabLinkResolver, UniversalTabConfig } from './universal-tabs-config';

// ============================================================================
// UNIVERSAL RENDERER PROPS
// ============================================================================

/** Generic tab component props interface */
export interface TabComponentProps {
  data?: unknown;
  project?: unknown;
  building?: unknown;
  storage?: unknown;
  parking?: unknown;
  unit?: unknown;
  selectedProperty?: unknown;
  icon?: React.ComponentType | null;
  /** Injected by UniversalTabsRenderer — navigate to a sibling tab by ID */
  onNavigateToTab?: (tabId: string) => void;
  [key: string]: unknown;
}

export interface PropertyTabAdditionalData {
  safeFloors: FloorData[];
  currentFloor: FloorData | null;
  safeViewerProps: ViewerPassthroughProps;
  safeViewerPropsWithFloors: ViewerPassthroughPropsWithFloors;
  setShowHistoryPanel: (show: boolean) => void;
  units: Property[];
  onUpdateProperty: (propertyId: string, updates: Partial<Property>) => Promise<void>;
  isEditMode: boolean;
  onToggleEditMode: () => void;
  onExitEditMode: () => void;
  isCreatingNewUnit: boolean;
  onPropertyCreated?: (propertyId: string) => void;
}

export interface PropertyTabGlobalProps {
  propertyId?: string;
}

export interface PropertyTabComponentProps extends TabComponentProps, PropertyTabGlobalProps {
  data?: Property | null;
  unit?: Property | null;
  selectedProperty?: Property | null;
  safeFloors?: FloorData[];
  currentFloor?: FloorData | null;
  safeViewerProps?: ViewerPassthroughProps;
  safeViewerPropsWithFloors?: ViewerPassthroughPropsWithFloors;
  setShowHistoryPanel?: (show: boolean) => void;
  units?: Property[];
  isEditMode?: boolean;
  onToggleEditMode?: () => void;
  onExitEditMode?: () => void;
  isCreatingNewUnit?: boolean;
  onPropertyCreated?: (propertyId: string) => void;
  onSelectFloor?: (floorId: string | null) => void;
  onUpdateProperty?: (propertyId: string, updates: Partial<Property>) => Promise<void> | void;
}

export interface BuildingTabAdditionalData {
  buildingFloorplan: BuildingFloorplanData | null;
  storageFloorplan: BuildingFloorplanData | null;
  floorplansLoading: boolean;
  floorplansError: string | null;
  refetchFloorplans: () => Promise<void>;
}

export interface BuildingTabGlobalProps {
  buildingId: string | number;
  isEditing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  onSaveRef?: React.MutableRefObject<(() => Promise<boolean>) | null>;
  isCreateMode?: boolean;
  onBuildingCreated?: (buildingId: string) => void;
  /** Reports active (non-deleted) units count back to BuildingTabs for the warning dot */
  onActiveUnitsCountChange?: (count: number) => void;
  /** BUG #5 deep-link — floor id to highlight on the Floors tab. */
  focusFloorId?: string | null;
}

export interface BuildingTabComponentProps extends TabComponentProps, Partial<BuildingTabAdditionalData>, Partial<BuildingTabGlobalProps> {
  data?: Building;
  building?: Building;
  title?: string;
}

/** Τα κοινά props των καρτελών ενός **χώρου** (αποθήκη · θέση στάθμευσης) — μία δήλωση. */
interface SpaceTabGlobalProps {
  isEditing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  onSaveRef?: React.MutableRefObject<(() => Promise<boolean>) | null>;
  createMode?: boolean;
  onCreated?: (id: string) => void;
}

export type StorageTabGlobalProps = SpaceTabGlobalProps;

export interface StorageTabComponentProps extends TabComponentProps, Partial<StorageTabGlobalProps> {
  data?: Storage;
  storage?: Storage;
  title?: string;
}

export type ParkingTabGlobalProps = SpaceTabGlobalProps;

export interface ParkingTabComponentProps extends TabComponentProps, Partial<ParkingTabGlobalProps> {
  data?: ParkingSpot;
  parking?: ParkingSpot;
  title?: string;
}

export interface UniversalTabsRendererProps<
  TData = unknown,
  TTabProps extends TabComponentProps = TabComponentProps,
  TAdditionalData extends object = Record<string, unknown>,
  TGlobalProps extends object = Record<string, unknown>,
> {
  /** Tab configurations */
  tabs: UniversalTabConfig[];
  /** Primary data object (project, building, storage, κτλ.) */
  data: TData;
  /** Component mapping για την αντιστοίχιση component names σε React components */
  componentMapping: Record<string, React.ComponentType<TTabProps>>;
  /** Default tab to show */
  defaultTab?: string;
  /** Theme για τα tabs (default, accent, warning, κτλ.) */
  theme?: 'default' | 'accent' | 'warning' | 'success' | 'destructive';
  /** Additional data για specific tabs */
  additionalData?: TAdditionalData;
  /** Custom component renderers που override το componentMapping */
  customComponents?: Record<string, React.ComponentType<TTabProps>>;
  /** Global props που περνάνε σε όλα τα tab components */
  globalProps?: TGlobalProps;
  /** 🌐 i18n: Translation namespace for tab labels (default: 'common') */
  translationNamespace?: string;
  /** Tab IDs mapped to true show an amber warning dot on their trigger. */
  tabWarnings?: Record<string, boolean>;
  /** Called whenever the active tab changes. */
  onTabChange?: (tabId: string) => void;
}

// ============================================================================
// UNIVERSAL TABS RENDERER COMPONENT
// ============================================================================

/**
 * Universal Generic Tabs Renderer
 *
 * Enterprise-class renderer που αντικαθιστά όλους τους διπλότυπους Generic Renderers.
 * Supports Project, Building, Storage, Units, και όποιους άλλους tab types.
 *
 * @example
 * ```tsx
 * // Project tabs
 * <UniversalTabsRenderer
 *   tabs={projectTabs}
 *   data={project}
 *   componentMapping={PROJECT_COMPONENT_MAPPING}
 *   theme="default"
 * />
 *
 * // Building tabs
 * <UniversalTabsRenderer
 *   tabs={buildingTabs}
 *   data={building}
 *   componentMapping={BUILDING_COMPONENT_MAPPING}
 *   theme="warning"
 * />
 * ```
 */
export function UniversalTabsRenderer<
  TData = unknown,
  TTabProps extends TabComponentProps = TabComponentProps,
  TAdditionalData extends object = Record<string, unknown>,
  TGlobalProps extends object = Record<string, unknown>,
>({
  tabs,
  data,
  componentMapping,
  defaultTab,
  theme = 'default',
  additionalData = {} as TAdditionalData,
  customComponents = {},
  globalProps = {} as TGlobalProps,
  translationNamespace = 'building',
  tabWarnings = {},
  onTabChange: onTabChangeProp,
}: UniversalTabsRendererProps<TData, TTabProps, TAdditionalData, TGlobalProps>) {
  // 🏢 ENTERPRISE: i18n hook for translations
  // currentLanguage is needed in useMemo dependencies for reactivity on language change
  const { t, currentLanguage } = useTranslation(translationNamespace);

  // ✅ PERF: Memoize filtered+sorted tabs — only recalculates when tabs array changes
  const sortedTabs = useMemo(() => {
    return tabs
      .filter(tab => tab.enabled)
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }, [tabs]);

  // Ενεργή γίνεται μόνο καρτέλα **με περιεχόμενο**: ένας deep link προς καρτέλα-σύνδεσμο
  // (ή προς καρτέλα που δεν υπάρχει) πέφτει στην πρώτη, αντί να αφήσει κενή οθόνη.
  const selectableDefaultTab = useMemo(() => {
    const selectable = sortedTabs.filter(tab => !tab.href);
    const wanted = selectable.find(tab => tab.value === defaultTab);
    return (wanted ?? selectable[0])?.value;
  }, [sortedTabs, defaultTab]);

  // 🏢 ENTERPRISE: Track active tab for lazy rendering
  const [activeTab, setActiveTab] = useState(selectableDefaultTab);

  // 🏢 ENTERPRISE: Sync activeTab when defaultTab prop changes (deep-link navigation)
  // Only triggers when defaultTab actually changes value, NOT on user tab clicks
  const prevDefaultTabRef = useRef(selectableDefaultTab);
  useEffect(() => {
    if (defaultTab && selectableDefaultTab && selectableDefaultTab !== prevDefaultTabRef.current) {
      prevDefaultTabRef.current = selectableDefaultTab;
      setActiveTab(selectableDefaultTab);
    }
  }, [defaultTab, selectableDefaultTab]);

  // 🏢 ENTERPRISE: Memoize tab definitions
  const tabDefinitions: TabDefinition[] = useMemo(() => sortedTabs.map(tabConfig => {
    // 🏢 ENTERPRISE: Translate label if it's an i18n key (contains '.')
    // Otherwise use label as-is for backward compatibility
    const displayLabel = tabConfig.label.includes('.')
      ? t(tabConfig.label)
      : tabConfig.label;

    if (tabConfig.href) {
      const href = tabConfig.href(entityIdOf(data));
      return {
        id: tabConfig.value,
        label: displayLabel,
        icon: getIconComponent(tabConfig.icon ?? ''),
        content: null,
        ...(href === null ? { href: '', disabled: true } : { href }),
      };
    }

    // Get component από custom components ή componentMapping
    const componentName = tabConfig.component ?? '';
    const ComponentToRender = (customComponents[componentName] ||
                              componentMapping[componentName]) as React.ComponentType<TTabProps> | undefined;

    if (!ComponentToRender) {
      logger.warn('Component not found in mapping for tab', { component: tabConfig.component, tabId: tabConfig.id, availableComponents: Object.keys(componentMapping) });

      // Fallback to PlaceholderTab
      return {
        id: tabConfig.value,
        label: displayLabel,
        icon: getIconComponent(tabConfig.icon ?? ''),
        content: (
          <PlaceholderTab
            title={`${displayLabel} - Coming Soon`}
            icon={getIconComponent(tabConfig.icon ?? '') || (() => null)}
            building={data as Record<string, unknown> | undefined} // 🏢 ENTERPRISE: Type assertion
            {...globalProps}
            {...tabConfig.componentProps}
          />
        )
      };
    }

    // Legacy `FloorplanViewerTab`: ολόκληρο το FloorplanData + οι ενέργειες του γονέα.
    const floorplanProps = floorplanViewerTabProps(tabConfig, additionalData, entityIdOf(data));

    // Render actual component
    const renderedComponentProps = {
      data,
      project: data,
      building: data,
      storage: data,
      parking: data,
      unit: data,
      selectedProperty: data,
      icon: getIconComponent(tabConfig.icon ?? ''),
      onNavigateToTab: setActiveTab,
      ...additionalData,
      ...floorplanProps,
      ...globalProps,
      ...tabConfig.componentProps,
    } as unknown as TTabProps;

    return {
      id: tabConfig.value,
      label: displayLabel,
      icon: getIconComponent(tabConfig.icon ?? ''),
      warningDot: tabWarnings[tabConfig.value] ?? false,
      content: (
        <ComponentToRender {...renderedComponentProps} />
      )
    };
  }), [sortedTabs, customComponents, componentMapping, data, additionalData, globalProps, setActiveTab, t, currentLanguage, tabWarnings]);

  // 🏢 ENTERPRISE: Handle tab change for controlled mode
  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
    onTabChangeProp?.(tabId);
    logger.info('Tab changed', { tabId });
  }, [onTabChangeProp]);

  return (
    <TabsOnlyTriggers
      tabs={tabDefinitions}
      value={activeTab}
      onTabChange={handleTabChange}
      theme={theme === 'destructive' || theme === 'accent' ? 'default' : theme} // 🏢 ENTERPRISE: Map unsupported theme values
    >
      {/* 🏢 ENTERPRISE: forceMount keeps tabs in DOM so local state persists across tab switches.
          LazyTabContent prevents premature rendering until first activation.
          data-[state=inactive]:hidden (from TabsContent) hides inactive tabs via CSS. */}
      {tabDefinitions.filter((tabDef) => tabDef.href === undefined).map((tabDef) => (
        <TabsContent key={tabDef.id} value={tabDef.id} forceMount>
          <LazyTabContent tabId={tabDef.id} activeTab={activeTab}>
            {tabDef.content}
          </LazyTabContent>
        </TabsContent>
      ))}
    </TabsOnlyTriggers>
  );
}

// ============================================================================
// EXPORT FOR LEGACY COMPATIBILITY
// ============================================================================

export default UniversalTabsRenderer;