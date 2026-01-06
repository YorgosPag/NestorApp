'use client';

import React from 'react';
import { TabsOnlyTriggers, TabsContent, type TabDefinition } from "@/components/ui/navigation/TabsComponents";
import { getIconComponent } from './utils/IconMapping';
import PlaceholderTab from '../building-management/tabs/PlaceholderTab';

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

export interface UniversalTabsRendererProps<TData = unknown> {
  /** Tab configurations */
  tabs: UniversalTabConfig[];
  /** Primary data object (project, building, storage, κτλ.) */
  data: TData;
  /** Component mapping για την αντιστοίχιση component names σε React components */
  componentMapping: Record<string, React.ComponentType<any>>;
  /** Default tab to show */
  defaultTab?: string;
  /** Theme για τα tabs (default, accent, warning, κτλ.) */
  theme?: 'default' | 'accent' | 'warning' | 'success' | 'destructive';
  /** Additional data για specific tabs */
  additionalData?: Record<string, unknown>;
  /** Custom component renderers που override το componentMapping */
  customComponents?: Record<string, React.ComponentType<any>>;
  /** Global props που περνάνε σε όλα τα tab components */
  globalProps?: Record<string, unknown>;
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
}: UniversalTabsRendererProps<TData>) {
  // Φιλτράρισμα enabled tabs
  const enabledTabs = tabs.filter(tab => tab.enabled);

  // Sort by order
  const sortedTabs = enabledTabs.sort((a, b) => {
    const orderA = a.order ?? 999;
    const orderB = b.order ?? 999;
    return orderA - orderB;
  });

  // Conversion σε TabDefinition format
  const tabDefinitions: TabDefinition[] = sortedTabs.map(tabConfig => {
    // Get component από custom components ή componentMapping
    const ComponentToRender = customComponents[tabConfig.component] ||
                              componentMapping[tabConfig.component];

    if (!ComponentToRender) {
      console.warn(`Component "${tabConfig.component}" not found in mapping for tab "${tabConfig.id}"`);
      console.log('Available components:', Object.keys(componentMapping));

      // Fallback to PlaceholderTab
      return {
        id: tabConfig.value,
        label: tabConfig.label,
        icon: getIconComponent(tabConfig.icon),
        content: (
          <PlaceholderTab
            title={`${tabConfig.label} - Coming Soon`}
            icon={getIconComponent(tabConfig.icon) || (() => null)}
            building={data}
            {...globalProps}
            {...tabConfig.componentProps}
          />
        )
      };
    }

    // ✅ ENTERPRISE: Special handling για FloorplanViewerTab
    // Πρέπει να μετατρέψουμε projectFloorplan/parkingFloorplan → floorplanData
    // και να χρησιμοποιήσουμε callbacks από additionalData αν υπάρχουν
    const getFloorplanProps = () => {
      if (tabConfig.component === 'FloorplanViewerTab') {
        const floorplanAdditionalData = additionalData as {
          projectFloorplan?: { scene?: unknown };
          parkingFloorplan?: { scene?: unknown };
          // ✅ ENTERPRISE: Callbacks from parent component
          onAddProjectFloorplan?: () => void;
          onAddParkingFloorplan?: () => void;
          onEditProjectFloorplan?: () => void;
          onEditParkingFloorplan?: () => void;
        };

        if (tabConfig.value === 'floorplan') {
          return {
            floorplanData: floorplanAdditionalData.projectFloorplan?.scene,
            onAddFloorplan: floorplanAdditionalData.onAddProjectFloorplan ?? (() => {
              console.log('Add project floorplan for project:', (data as { id?: string })?.id);
            }),
            onEditFloorplan: floorplanAdditionalData.onEditProjectFloorplan ?? (() => {
              console.log('Edit project floorplan for project:', (data as { id?: string })?.id);
            }),
          };
        } else if (tabConfig.value === 'parking-floorplan') {
          return {
            floorplanData: floorplanAdditionalData.parkingFloorplan?.scene,
            onAddFloorplan: floorplanAdditionalData.onAddParkingFloorplan ?? (() => {
              console.log('Add parking floorplan for project:', (data as { id?: string })?.id);
            }),
            onEditFloorplan: floorplanAdditionalData.onEditParkingFloorplan ?? (() => {
              console.log('Edit parking floorplan for project:', (data as { id?: string })?.id);
            }),
          };
        }
      }
      return {};
    };

    // Render actual component
    return {
      id: tabConfig.value,
      label: tabConfig.label,
      icon: getIconComponent(tabConfig.icon),
      content: (
        <ComponentToRender
          // Primary data prop (περνάει ως data, project, building, storage, κτλ.)
          data={data}
          project={data} // For backward compatibility με project components
          building={data} // For backward compatibility με building components
          storage={data} // For backward compatibility με storage components
          unit={data} // For backward compatibility με unit components
          selectedUnit={data} // For backward compatibility με unit components
          // For PlaceholderTab compatibility
          icon={getIconComponent(tabConfig.icon)}
          {...additionalData}
          {...getFloorplanProps()} // ✅ ENTERPRISE: FloorplanViewerTab special props
          {...globalProps}
          {...tabConfig.componentProps}
        />
      )
    };
  });

  return (
    <TabsOnlyTriggers
      tabs={tabDefinitions}
      defaultTab={defaultTab || sortedTabs[0]?.value}
      theme={theme}
    >
      {/* Render TabsContent panels manually */}
      {tabDefinitions.map((tabDef) => (
        <TabsContent key={tabDef.id} value={tabDef.id}>
          {tabDef.content}
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
  return (
    typeof tab === 'object' &&
    tab !== null &&
    typeof (tab as any).id === 'string' &&
    typeof (tab as any).value === 'string' &&
    typeof (tab as any).label === 'string' &&
    typeof (tab as any).component === 'string' &&
    typeof (tab as any).enabled === 'boolean'
  );
}

/**
 * Converter από legacy tab configs σε Universal format
 * Αυτό επιτρέπει backward compatibility με existing configs
 */
export function convertToUniversalConfig(legacyTab: any): UniversalTabConfig {
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