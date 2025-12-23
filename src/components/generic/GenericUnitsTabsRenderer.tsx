'use client';

import React from 'react';
import { TabsContent } from "@/components/ui/tabs";
import { useIconSizes } from '@/hooks/useIconSizes';
import { TabsOnlyTriggers, type TabDefinition } from "@/components/ui/navigation/TabsComponents";
import type { UnitsTabConfig } from '@/config/units-tabs-config';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Home, Map, FileText, Camera, Video, User } from 'lucide-react';

// ============================================================================
// ICON MAPPING
// ============================================================================

/**
 * Mapping από string icons σε Lucide React icons
 */
const ICON_MAPPING = {
  // Emoji mapping (legacy)
  '🏠': Home,
  '🗺️': Map,
  '📄': FileText,
  '📸': Camera,
  '🎬': Video,

  // String mapping (new)
  'home': Home,
  'user': User,
  'map': Map,
  'file-text': FileText,
  'camera': Camera,
  'video': Video,
} as const;

/**
 * Helper function για την μετατροπή string/emoji icon σε Lucide icon
 */
function getIconComponent(icon: string) {
  return ICON_MAPPING[icon as keyof typeof ICON_MAPPING] || Home;
}

// ============================================================================
// COMPONENT MAPPING
// ============================================================================

import { PropertyDetailsContent } from '@/components/property-viewer/details/PropertyDetailsContent';
import PhotosTabContent from '@/components/building-management/tabs/PhotosTabContent';
import VideosTabContent from '@/components/building-management/tabs/VideosTabContent';
import { FloorPlanTab } from '@/features/units-sidebar/components/FloorPlanTab';
import { UnitCustomerTab } from '@/components/units/tabs/UnitCustomerTab';

/**
 * Component mapping για την αντιστοίχιση component names σε actual components
 */
const COMPONENT_MAPPING = {
  'PropertyDetailsContent': PropertyDetailsContent,
  'UnitCustomerTab': UnitCustomerTab,
  'FloorPlanTab': FloorPlanTab,
  'PhotosTabContent': PhotosTabContent,
  'VideosTabContent': VideosTabContent,
  'DocumentsPlaceholder': ({ title, subtitle }: { title: string, subtitle: string }) => (
    <div className="text-center text-muted-foreground p-4">
      <p>{title} - Coming Soon</p>
      <p className="text-xs mt-2">{subtitle}</p>
    </div>
  ),
} as const;

// ============================================================================
// INTERFACES
// ============================================================================

export interface GenericUnitsTabsRendererProps {
  /** Units tabs configuration */
  tabs: UnitsTabConfig[];
  /** Selected unit data */
  selectedUnit?: any;
  /** Default tab to show */
  defaultTab?: string;
  /** Additional data for specific tabs */
  additionalData?: {
    safeFloors?: any[];
    currentFloor?: any;
    safeViewerProps?: any;
    safeViewerPropsWithFloors?: any;
    setShowHistoryPanel?: (show: boolean) => void;
    units?: any[];
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
 * Generic Units Tabs Renderer
 *
 * Renders unit detail tabs based on configuration
 *
 * @example
 * ```tsx
 * import { getSortedUnitsTabs } from '@/config/units-tabs-config';
 * import { GenericUnitsTabsRenderer } from '@/components/generic';
 *
 * function UnitTabs({ selectedUnit }) {
 *   const tabs = getSortedUnitsTabs();
 *
 *   return (
 *     <GenericUnitsTabsRenderer
 *       tabs={tabs}
 *       selectedUnit={selectedUnit}
 *       defaultTab="info"
 *     />
 *   );
 * }
 * ```
 */
export function GenericUnitsTabsRenderer({
  tabs,
  selectedUnit,
  defaultTab = 'info',
  additionalData = {},
  customComponents = {},
  globalProps = {},
}: GenericUnitsTabsRendererProps) {
  const iconSizes = useIconSizes();
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
  const getComponentProps = (tab: UnitsTabConfig) => {
    const baseProps = {
      selectedUnit,
      ...globalProps,
    };

    // Προσθήκη custom props από τη configuration
    if (tab.componentProps) {
      Object.assign(baseProps, tab.componentProps);
    }

    // Special handling για PropertyDetailsContent
    if (tab.component === 'PropertyDetailsContent') {
      return {
        ...baseProps,
        property: selectedUnit,
        onSelectFloor: additionalData.safeViewerPropsWithFloors?.onSelectFloor || (() => {}),
        onUpdateProperty: additionalData.safeViewerPropsWithFloors?.handleUpdateProperty || (() => {}),
      };
    }

    // Special handling για FloorPlanTab
    if (tab.component === 'FloorPlanTab') {
      return {
        ...baseProps,
        selectedUnit,
        currentFloor: additionalData.currentFloor,
        safeFloors: additionalData.safeFloors,
        safeViewerProps: additionalData.safeViewerProps,
        safeViewerPropsWithFloors: additionalData.safeViewerPropsWithFloors,
        setShowHistoryPanel: additionalData.setShowHistoryPanel,
        units: additionalData.units,
      };
    }

    return baseProps;
  };

  // Helper function to get content wrapper
  const getContentWrapper = (tab: UnitsTabConfig, content: React.ReactNode) => {
    // Special wrapping για info tab
    if (tab.value === 'info') {
      return (
        <ScrollArea className="h-full p-4">
          {selectedUnit ? (
            content
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <Home className={`${iconSizes.xl3} mb-4 opacity-50`} />
              <h3 className="text-lg font-semibold mb-2">Επιλέξτε μια μονάδα</h3>
              <p className="text-sm">Επιλέξτε μια μονάδα από τη λίστα αριστερά για να δείτε τις πληροφορίες της.</p>
            </div>
          )}
        </ScrollArea>
      );
    }

    // Special wrapping για floor-plan tab
    if (tab.value === 'floor-plan') {
      return (
        <div className="flex-1 flex flex-col min-h-0 m-0 p-0">
          {content}
        </div>
      );
    }

    // Default wrapping για άλλες καρτέλες
    return (
      <div className="p-4">
        {content}
      </div>
    );
  };

  // Μετατροπή UnitsTabConfig[] σε TabDefinition[]
  const tabDefinitions: TabDefinition[] = enabledTabs.map((tab) => {
    const Component = getComponent(tab.component || 'PropertyDetailsContent');
    const componentProps = getComponentProps(tab);
    const IconComponent = getIconComponent(tab.icon);

    return {
      id: tab.value,
      label: tab.label,
      icon: IconComponent,
      content: getContentWrapper(tab, <Component {...componentProps} />),
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
        <TabsContent key={tab.id} value={tab.id} className="flex-1 overflow-y-auto">
          {tab.content}
        </TabsContent>
      ))}
    </TabsOnlyTriggers>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default GenericUnitsTabsRenderer;