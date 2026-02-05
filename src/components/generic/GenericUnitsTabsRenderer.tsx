'use client';

import React from 'react';
import { TabsContent } from "@/components/ui/tabs";
import { useIconSizes } from '@/hooks/useIconSizes';
import { TabsOnlyTriggers, type TabDefinition } from "@/components/ui/navigation/TabsComponents";
import type { UnitsTabConfig } from '@/config/units-tabs-config';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Map, FileText, Camera, Video, User } from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useTranslation } from 'react-i18next';

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions (ADR-compliant - NO any)
// ============================================================================

/** Unit data type for the tabs renderer - Must have id field for PhotosTabContentProps compatibility */
export type UnitData = { id: string; name?: string; [key: string]: unknown };

/** Floor data type */
export type FloorData = Record<string, unknown>;

/** Viewer props type */
export type ViewerProps = Record<string, unknown>;

/** Generic component props type */
export type GenericComponentProps = Record<string, unknown>;

// 🏢 ENTERPRISE: Centralized Unit Icon & Color
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;
const unitColor = NAVIGATION_ENTITIES.unit.color;

// ============================================================================
// ICON MAPPING
// ============================================================================

/**
 * Mapping από string icons σε Lucide React icons
 */
const ICON_MAPPING = {
  // Emoji mapping (legacy) - 🏢 ENTERPRISE: Using centralized UnitIcon
  '🏠': UnitIcon,
  '🗺️': Map,
  '📄': FileText,
  '📸': Camera,
  '🎬': Video,

  // String mapping (new) - 🏢 ENTERPRISE: Using centralized UnitIcon
  'home': UnitIcon,
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
  return ICON_MAPPING[icon as keyof typeof ICON_MAPPING] || UnitIcon;
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
const COMPONENT_MAPPING: Record<string, React.ComponentType<GenericComponentProps>> = {
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
};

// ============================================================================
// INTERFACES
// ============================================================================

export interface GenericUnitsTabsRendererProps {
  /** Units tabs configuration */
  tabs: UnitsTabConfig[];
  /** Selected unit data */
  selectedUnit?: UnitData;
  /** Default tab to show */
  defaultTab?: string;
  /** Additional data for specific tabs */
  additionalData?: {
    safeFloors?: FloorData[];
    currentFloor?: FloorData;
    safeViewerProps?: ViewerProps;
    safeViewerPropsWithFloors?: ViewerProps;
    setShowHistoryPanel?: (show: boolean) => void;
    units?: UnitData[];
  };
  /** Custom component renderers */
  customComponents?: Record<string, React.ComponentType<GenericComponentProps>>;
  /** Additional props to pass to all tab components */
  globalProps?: GenericComponentProps;
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
  // 🏢 ENTERPRISE: i18n translation for tab labels
  const { t } = useTranslation('building');

  // Φιλτράρισμα enabled tabs
  const enabledTabs = tabs.filter(tab => tab.enabled !== false);

  // Helper function to get component
  const getComponent = (componentName: string): React.ComponentType<GenericComponentProps> => {
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
  const getComponentProps = (tab: UnitsTabConfig): GenericComponentProps => {
    const baseProps: GenericComponentProps = {
      selectedUnit,
      ...globalProps,
    };

    // Προσθήκη custom props από τη configuration
    if (tab.componentProps) {
      Object.assign(baseProps, tab.componentProps);
    }

    // Special handling για PropertyDetailsContent
    if (tab.component === 'PropertyDetailsContent') {
      const onSelectFloor =
        typeof additionalData.safeViewerPropsWithFloors?.onSelectFloor === 'function'
          ? additionalData.safeViewerPropsWithFloors.onSelectFloor
          : () => {};
      const onUpdateProperty =
        typeof additionalData.safeViewerPropsWithFloors?.handleUpdateProperty === 'function'
          ? additionalData.safeViewerPropsWithFloors.handleUpdateProperty
          : () => {};

      return {
        ...baseProps,
        property: selectedUnit,
        onSelectFloor,
        onUpdateProperty,
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
              <UnitIcon className={`${iconSizes.xl3} mb-4 opacity-50 ${unitColor}`} />
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
  // 🏢 ENTERPRISE: Translate i18n keys to actual labels
  const tabDefinitions: TabDefinition[] = enabledTabs.map((tab) => {
    const Component = getComponent(tab.component || 'PropertyDetailsContent');
    const componentProps = getComponentProps(tab);
    const IconComponent = getIconComponent(tab.icon);

    return {
      id: tab.value,
      // 🏢 ENTERPRISE: Translate the i18n key (e.g., "tabs.labels.basicInfo" → "Πληροφορίες")
      label: t(tab.label),
      icon: IconComponent,
      content: getContentWrapper(tab, <Component {...componentProps} />),
      disabled: tab.enabled === false,
    };
  });

  return (
    <TabsOnlyTriggers
      tabs={tabDefinitions}
      defaultTab={defaultTab}
      theme="clean"
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
