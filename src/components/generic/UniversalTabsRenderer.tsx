'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { TabsOnlyTriggers, TabsContent, type TabDefinition } from "@/components/ui/navigation/TabsComponents";
import { getIconComponent } from './utils/IconMapping';
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

// ============================================================================
// UNIVERSAL TAB CONFIG INTERFACE
// ============================================================================

/**
 * Universal tab configuration interface
 * Compatible με όλους τους existing tab configs (Project, Building, Storage, Units, κτλ.)
 */
export interface UniversalTabConfig {
  /** Unique tab identifier */
  id: string;
  /** Tab value for routing/state */
  value: string;
  /** Display label */
  label: string;
  /** Icon name (από lucide-react) */
  icon?: string;
  /** Component name για το mapping */
  component: string;
  /** Αν το tab είναι ενεργό */
  enabled: boolean;
  /** Sort order */
  order?: number;
  /** Props να περάσουν στο component */
  componentProps?: Record<string, unknown>;
}

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
  selectedUnit?: unknown;
  icon?: React.ComponentType | null;
  /** Injected by UniversalTabsRenderer — navigate to a sibling tab by ID */
  onNavigateToTab?: (tabId: string) => void;
  [key: string]: unknown;
}

export interface UniversalTabsRendererProps<TData = unknown> {
  /** Tab configurations */
  tabs: UniversalTabConfig[];
  /** Primary data object (project, building, storage, κτλ.) */
  data: TData;
  /** Component mapping για την αντιστοίχιση component names σε React components */
  componentMapping: Record<string, React.ComponentType<TabComponentProps>>;
  /** Default tab to show */
  defaultTab?: string;
  /** Theme για τα tabs (default, accent, warning, κτλ.) */
  theme?: 'default' | 'accent' | 'warning' | 'success' | 'destructive';
  /** Additional data για specific tabs */
  additionalData?: Record<string, unknown>;
  /** Custom component renderers που override το componentMapping */
  customComponents?: Record<string, React.ComponentType<TabComponentProps>>;
  /** Global props που περνάνε σε όλα τα tab components */
  globalProps?: Record<string, unknown>;
  /** 🌐 i18n: Translation namespace for tab labels (default: 'common') */
  translationNamespace?: string;
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
export function UniversalTabsRenderer<TData = unknown>({
  tabs,
  data,
  componentMapping,
  defaultTab,
  theme = 'default',
  additionalData = {},
  customComponents = {},
  globalProps = {},
  translationNamespace = 'building',
}: UniversalTabsRendererProps<TData>) {
  // 🏢 ENTERPRISE: i18n hook for translations
  // currentLanguage is needed in useMemo dependencies for reactivity on language change
  const { t, currentLanguage } = useTranslation(translationNamespace);

  // Φιλτράρισμα enabled tabs
  const enabledTabs = tabs.filter(tab => tab.enabled);

  // 🏢 ENTERPRISE: Track active tab for lazy rendering
  const computedDefaultTab = defaultTab || enabledTabs[0]?.value;
  const [activeTab, setActiveTab] = useState(computedDefaultTab);


  // 🏢 ENTERPRISE: Sync activeTab when defaultTab prop changes (deep-link navigation)
  // Only triggers when defaultTab actually changes value, NOT on user tab clicks
  const prevDefaultTabRef = useRef(computedDefaultTab);
  useEffect(() => {
    if (defaultTab && defaultTab !== prevDefaultTabRef.current) {
      prevDefaultTabRef.current = defaultTab;
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  // Sort by order
  const sortedTabs = enabledTabs.sort((a, b) => {
    const orderA = a.order ?? 999;
    const orderB = b.order ?? 999;
    return orderA - orderB;
  });

  // 🏢 ENTERPRISE: Memoize tab definitions
  const tabDefinitions: TabDefinition[] = useMemo(() => sortedTabs.map(tabConfig => {
    // 🏢 ENTERPRISE: Translate label if it's an i18n key (contains '.')
    // Otherwise use label as-is for backward compatibility
    const displayLabel = tabConfig.label.includes('.')
      ? t(tabConfig.label)
      : tabConfig.label;

    // Get component από custom components ή componentMapping
    const ComponentToRender = customComponents[tabConfig.component] ||
                              componentMapping[tabConfig.component];

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

    // ✅ ENTERPRISE: Special handling για FloorplanViewerTab
    // Περνάμε ΟΛΟΚΛΗΡΟ το FloorplanData object (υποστηρίζει DXF και PDF)
    const getFloorplanProps = () => {
      if (tabConfig.component === 'FloorplanViewerTab') {
        const floorplanAdditionalData = additionalData as {
          // 🏢 ENTERPRISE: Full FloorplanData type (supports DXF scene and PDF imageUrl)
          projectFloorplan?: {
            fileType?: 'dxf' | 'pdf';
            scene?: unknown;
            pdfImageUrl?: string | null;
            pdfDimensions?: { width: number; height: number } | null;
            fileName?: string;
            timestamp?: number;
          } | null;
          parkingFloorplan?: {
            fileType?: 'dxf' | 'pdf';
            scene?: unknown;
            pdfImageUrl?: string | null;
            pdfDimensions?: { width: number; height: number } | null;
            fileName?: string;
            timestamp?: number;
          } | null;
          // ✅ ENTERPRISE: Callbacks from parent component
          onAddProjectFloorplan?: () => void;
          onAddParkingFloorplan?: () => void;
          onEditProjectFloorplan?: () => void;
          onEditParkingFloorplan?: () => void;
        };

        if (tabConfig.value === 'floorplan') {
          return {
            // 🏢 ENTERPRISE: Pass FULL FloorplanData object (not just .scene)
            floorplanData: floorplanAdditionalData.projectFloorplan,
            onAddFloorplan: floorplanAdditionalData.onAddProjectFloorplan ?? (() => {
              logger.info('Add project floorplan for project', { projectId: (data as { id?: string })?.id });
            }),
            onEditFloorplan: floorplanAdditionalData.onEditProjectFloorplan ?? (() => {
              logger.info('Edit project floorplan for project', { projectId: (data as { id?: string })?.id });
            }),
          };
        } else if (tabConfig.value === 'parking-floorplan') {
          return {
            // 🏢 ENTERPRISE: Pass FULL FloorplanData object (not just .scene)
            floorplanData: floorplanAdditionalData.parkingFloorplan,
            onAddFloorplan: floorplanAdditionalData.onAddParkingFloorplan ?? (() => {
              logger.info('Add parking floorplan for project', { projectId: (data as { id?: string })?.id });
            }),
            onEditFloorplan: floorplanAdditionalData.onEditParkingFloorplan ?? (() => {
              logger.info('Edit parking floorplan for project', { projectId: (data as { id?: string })?.id });
            }),
          };
        }
      }
      return {};
    };

    // Render actual component
    return {
      id: tabConfig.value,
      label: displayLabel,
      icon: getIconComponent(tabConfig.icon ?? ''),
      content: (
        <ComponentToRender
          // Primary data prop (περνάει ως data, project, building, storage, κτλ.)
          data={data}
          project={data} // For backward compatibility με project components
          building={data} // For backward compatibility με building components
          storage={data} // For backward compatibility με storage components
          parking={data} // For backward compatibility με parking components
          unit={data} // For backward compatibility με unit components
          selectedUnit={data} // For backward compatibility με unit components
          // For PlaceholderTab compatibility
          icon={getIconComponent(tabConfig.icon ?? '')}
          // 🏢 ENTERPRISE: Inject tab navigation — lets any child switch sibling tabs
          onNavigateToTab={setActiveTab}
          {...additionalData}
          {...getFloorplanProps()} // ✅ ENTERPRISE: FloorplanViewerTab special props
          {...globalProps}
          {...tabConfig.componentProps}
        />
      )
    };
  }), [sortedTabs, customComponents, componentMapping, data, additionalData, globalProps, setActiveTab, t, currentLanguage]);

  // 🏢 ENTERPRISE: Handle tab change for controlled mode
  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
    logger.info('Tab changed', { tabId });
  }, []);

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
      {tabDefinitions.map((tabDef) => (
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
// UTILITY TYPE GUARDS
// ============================================================================

/**
 * Type guard για να ελέγξουμε αν το tabs config είναι compatible με Universal format
 */
export function isUniversalTabConfig(tab: unknown): tab is UniversalTabConfig {
  if (typeof tab !== 'object' || tab === null) {
    return false;
  }
  const tabObj = tab as Record<string, unknown>;
  return (
    typeof tabObj.id === 'string' &&
    typeof tabObj.value === 'string' &&
    typeof tabObj.label === 'string' &&
    typeof tabObj.component === 'string' &&
    typeof tabObj.enabled === 'boolean'
  );
}

/** Legacy tab config interface for backward compatibility */
interface LegacyTabConfig {
  id?: string;
  value: string;
  label: string;
  icon?: string;
  component: string;
  enabled?: boolean;
  order?: number;
  componentProps?: Record<string, unknown>;
}

/**
 * Converter από legacy tab configs σε Universal format
 * Αυτό επιτρέπει backward compatibility με existing configs
 */
export function convertToUniversalConfig(legacyTab: LegacyTabConfig): UniversalTabConfig {
  return {
    id: legacyTab.id || legacyTab.value,
    value: legacyTab.value,
    label: legacyTab.label,
    icon: legacyTab.icon,
    component: legacyTab.component,
    enabled: legacyTab.enabled ?? true,
    order: legacyTab.order,
    componentProps: legacyTab.componentProps || {},
  };
}

// ============================================================================
// EXPORT FOR LEGACY COMPATIBILITY
// ============================================================================

export default UniversalTabsRenderer;