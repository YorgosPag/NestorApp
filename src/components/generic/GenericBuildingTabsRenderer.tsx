'use client';

import React from 'react';
import { TabsContent } from "@/components/ui/tabs";
import { TabsOnlyTriggers, type TabDefinition } from "@/components/ui/navigation/TabsComponents";
import type { BuildingTabConfig } from '@/config/building-tabs-config';
import type { Building } from '@/components/building-management/BuildingsPageContent';
import { getIconComponent } from './utils/IconMapping';

// ============================================================================
// COMPONENT MAPPING
// ============================================================================

import { GeneralTabContent } from '../building-management/tabs/GeneralTabContent';
import TimelineTabContent from '../building-management/tabs/TimelineTabContent';
import AnalyticsTabContent from '../building-management/tabs/AnalyticsTabContent';
import PhotosTabContent from '../building-management/tabs/PhotosTabContent';
import VideosTabContent from '../building-management/tabs/VideosTabContent';
import PlaceholderTab from '../building-management/tabs/PlaceholderTab';
import { FloorplanViewerTab } from '../projects/tabs/FloorplanViewerTab';
import { StorageTab } from '../building-management/StorageTab';
import { BuildingCustomersTab } from '../building-management/tabs/BuildingCustomersTab';
import { FileText, Settings } from 'lucide-react';

/**
 * Component mapping για την αντιστοίχιση component names σε actual components
 */
const COMPONENT_MAPPING = {
  'GeneralTabContent': GeneralTabContent,
  'TimelineTabContent': TimelineTabContent,
  'AnalyticsTabContent': AnalyticsTabContent,
  'PhotosTabContent': PhotosTabContent,
  'VideosTabContent': VideosTabContent,
  'PlaceholderTab': PlaceholderTab,
  'FloorplanViewerTab': FloorplanViewerTab,
  'StorageTab': StorageTab,
  'BuildingCustomersTab': BuildingCustomersTab,
} as const;

// ============================================================================
// INTERFACES
// ============================================================================

export interface GenericBuildingTabsRendererProps {
  /** Building tabs configuration */
  tabs: BuildingTabConfig[];
  /** Building data to display */
  building: Building;
  /** Default tab to show */
  defaultTab?: string;
  /** Additional data for specific tabs */
  additionalData?: {
    buildingFloorplan?: any;
    floorplansLoading?: boolean;
    floorplansError?: string;
    refetchFloorplans?: () => void;
  };
  /** Custom component renderers */
  customComponents?: Record<string, React.ComponentType<any>>;
  /** Additional props to pass to all tab components */
  globalProps?: Record<string, any>;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Generic Building Tabs Renderer
 *
 * Renders building detail tabs based on configuration
 *
 * @example
 * ```tsx
 * import { getSortedBuildingTabs } from '@/config/building-tabs-config';
 * import { GenericBuildingTabsRenderer } from '@/components/generic';
 *
 * function BuildingTabs({ building }) {
 *   const tabs = getSortedBuildingTabs();
 *
 *   return (
 *     <GenericBuildingTabsRenderer
 *       tabs={tabs}
 *       building={building}
 *       defaultTab="general"
 *     />
 *   );
 * }
 * ```
 */
export function GenericBuildingTabsRenderer({
  tabs,
  building,
  defaultTab = 'general',
  additionalData = {},
  customComponents = {},
  globalProps = {},
}: GenericBuildingTabsRendererProps) {
  // Φιλτράρισμα enabled tabs
  const enabledTabs = tabs.filter(tab => tab.enabled !== false);

  // Helper function to get component
  const getComponent = (componentName: string) => {
    // Πρώτα ελέγχουμε τα custom components
    if (customComponents[componentName]) {
      return customComponents[componentName];
    }

    // Μετά τα built-in components
    if (COMPONENT_MAPPING[componentName as keyof typeof COMPONENT_MAPPING]) {
      return COMPONENT_MAPPING[componentName as keyof typeof COMPONENT_MAPPING];
    }

    // Fallback για unknown components
    console.warn(`Unknown component: ${componentName}`);
    return ({ children }: { children?: React.ReactNode }) => (
      <div className="p-4 text-center text-muted-foreground">
        <p>Component "{componentName}" not found</p>
        {children}
      </div>
    );
  };

  // Helper function to get component props
  const getComponentProps = (tab: BuildingTabConfig) => {
    const baseProps = {
      building,
      ...globalProps,
    };

    // Προσθήκη custom props από τη configuration
    if (tab.componentProps) {
      Object.assign(baseProps, tab.componentProps);
    }

    // Special handling για BuildingCustomersTab
    if (tab.component === 'BuildingCustomersTab') {
      return {
        ...baseProps,
        buildingId: building.id,
      };
    }

    // Special handling για FloorplanViewerTab
    if (tab.component === 'FloorplanViewerTab') {
      return {
        ...baseProps,
        title: 'Κάτοψη Κτιρίου',
        floorplanData: additionalData.buildingFloorplan?.scene,
        onAddFloorplan: () => {
          console.log('Add building floorplan for building:', building.id);
        },
        onEditFloorplan: () => {
          console.log('Edit building floorplan for building:', building.id);
        },
      };
    }

    // Special handling για PlaceholderTab
    if (tab.component === 'PlaceholderTab' && tab.componentProps) {
      const iconName = tab.componentProps.icon;
      let IconComponent = FileText; // Default fallback

      // Map icon names to actual icons
      if (iconName === 'FileText') IconComponent = FileText;
      if (iconName === 'Settings') IconComponent = Settings;

      return {
        ...baseProps,
        title: tab.componentProps.title,
        icon: IconComponent,
      };
    }

    return baseProps;
  };

  // Μετατροπή BuildingTabConfig[] σε TabDefinition[]
  const tabDefinitions: TabDefinition[] = enabledTabs.map((tab) => {
    const Component = getComponent(tab.component || 'GeneralTabContent');
    const componentProps = getComponentProps(tab);
    const IconComponent = getIconComponent(tab.icon);

    return {
      id: tab.value,
      label: tab.label,
      icon: IconComponent,
      content: React.createElement(Component, componentProps),
      disabled: tab.enabled === false,
    };
  });

  return (
    <TabsOnlyTriggers
      tabs={tabDefinitions}
      defaultTab={defaultTab}
      theme="default"
    >
      {tabDefinitions.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="mt-8 overflow-x-auto">
          {tab.content}
        </TabsContent>
      ))}
    </TabsOnlyTriggers>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default GenericBuildingTabsRenderer;