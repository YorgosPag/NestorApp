'use client';

import React from 'react';
import { TabsOnlyTriggers, TabsContent, type TabDefinition } from "@/components/ui/navigation/TabsComponents";
import type { StorageTabConfig } from '@/config/storage-tabs-config';
import type { Storage } from '@/types/storage/contracts';
import { getIconComponent } from './utils/IconMapping';

// ============================================================================
// COMPONENT MAPPING
// ============================================================================

import { StorageGeneralTab } from '../space-management/StoragesPage/StorageDetails/tabs/StorageGeneralTab';
import { StorageStatsTab } from '../space-management/StoragesPage/StorageDetails/tabs/StorageStatsTab';
import { StorageDocumentsTab } from '../space-management/StoragesPage/StorageDetails/tabs/StorageDocumentsTab';
import { StoragePhotosTab } from '../space-management/StoragesPage/StorageDetails/tabs/StoragePhotosTab';
import { StorageHistoryTab } from '../space-management/StoragesPage/StorageDetails/tabs/StorageHistoryTab';
import PlaceholderTab from '../building-management/tabs/PlaceholderTab';
import { FloorplanViewerTab } from '../projects/tabs/FloorplanViewerTab';

/**
 * Component mapping για την αντιστοίχιση component names σε actual components
 */
const COMPONENT_MAPPING = {
  'StorageGeneralTab': StorageGeneralTab,
  'StorageStatsTab': StorageStatsTab,
  'StorageDocumentsTab': StorageDocumentsTab,
  'StoragePhotosTab': StoragePhotosTab,
  'StorageHistoryTab': StorageHistoryTab,
  'PlaceholderTab': PlaceholderTab,
  'FloorplanViewerTab': FloorplanViewerTab,
} as const;

// ============================================================================
// INTERFACES
// ============================================================================

export interface GenericStorageTabsRendererProps {
  /** Storage tabs configuration */
  tabs: StorageTabConfig[];
  /** Storage data to display */
  storage: Storage;
  /** Default tab to show */
  defaultTab?: string;
  /** Additional data for specific tabs */
  additionalData?: {
    floorplan?: any;
    loading?: boolean;
    error?: string;
    refetch?: () => void;
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
 * Generic Storage Tabs Renderer
 *
 * Renders storage detail tabs based on configuration
 *
 * @example
 * ```tsx
 * import { getSortedStorageTabs } from '@/config/storage-tabs-config';
 * import { GenericStorageTabsRenderer } from '@/components/generic';
 *
 * function StorageTabs({ storage }) {
 *   const tabs = getSortedStorageTabs();
 *
 *   return (
 *     <GenericStorageTabsRenderer
 *       tabs={tabs}
 *       storage={storage}
 *       defaultTab="general"
 *     />
 *   );
 * }
 * ```
 */
export function GenericStorageTabsRenderer({
  tabs,
  storage,
  defaultTab = 'general',
  additionalData = {},
  customComponents = {},
  globalProps = {},
}: GenericStorageTabsRendererProps) {
  // Φιλτράρισμα enabled tabs
  const enabledTabs = tabs.filter(tab => tab.enabled);

  // Conversion σε TabDefinition format
  const tabDefinitions: TabDefinition[] = enabledTabs.map(tabConfig => {
    // Get component from mapping or custom components
    const ComponentToRender = customComponents[tabConfig.component] ||
                              COMPONENT_MAPPING[tabConfig.component as keyof typeof COMPONENT_MAPPING];

    if (!ComponentToRender) {
      console.warn(`Component "${tabConfig.component}" not found in mapping for tab "${tabConfig.id}"`);
      console.log('Available components:', Object.keys(COMPONENT_MAPPING));
      // Fallback to PlaceholderTab
      const FallbackComponent = COMPONENT_MAPPING['PlaceholderTab'];
      return {
        id: tabConfig.value,
        label: tabConfig.label,
        icon: getIconComponent(tabConfig.icon),
        content: (
          <FallbackComponent
            title={`${tabConfig.label} - Coming Soon`}
            description={`Η καρτέλα "${tabConfig.label}" είναι υπό ανάπτυξη.`}
            storage={storage}
            {...globalProps}
            {...tabConfig.componentProps}
          />
        )
      };
    }

    // Render actual component
    return {
      id: tabConfig.value,
      label: tabConfig.label,
      icon: getIconComponent(tabConfig.icon),
      content: (
        <ComponentToRender
          storage={storage}
          {...additionalData}
          {...globalProps}
          {...tabConfig.componentProps}
        />
      )
    };
  });

  return (
    <TabsOnlyTriggers
      tabs={tabDefinitions}
      defaultTab={defaultTab}
      theme="default"
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