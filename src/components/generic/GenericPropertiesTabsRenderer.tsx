'use client';
/* eslint-disable custom/no-hardcoded-strings */

import React from 'react';
import { TabsContent } from "@/components/ui/tabs";
import { useIconSizes } from '@/hooks/useIconSizes';
import { TabsOnlyTriggers, type TabDefinition } from "@/components/ui/navigation/TabsComponents";
import type { PropertiesTabConfig } from '@/config/properties-tabs-config';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Map, FileText, Camera, Video, User } from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useTranslation } from 'react-i18next';
import { createModuleLogger } from '@/lib/telemetry';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

const logger = createModuleLogger('GenericPropertiesTabsRenderer');

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions (ADR-compliant - NO any)
// ============================================================================

/** Unit data type for the tabs renderer - Must have id field for PhotosTabContentProps compatibility */
export type PropertyData = { id: string; name?: string; [key: string]: unknown };

/** Floor data type */
export type FloorData = Record<string, unknown>;

/** Viewer props type */
export type ViewerProps = Record<string, unknown>;

/** Generic component props type */
export type GenericComponentProps = Record<string, unknown>;

// 🏢 ENTERPRISE: Centralized Property Icon & Color
const PropertyIcon = NAVIGATION_ENTITIES.property.icon;
const propertyColor = NAVIGATION_ENTITIES.property.color;

// ============================================================================
// ICON MAPPING
// ============================================================================

/**
 * Mapping από string icons σε Lucide React icons
 */
const ICON_MAPPING = {
  // Emoji mapping (legacy) - 🏢 ENTERPRISE: Using centralized PropertyIcon
  '🏠': PropertyIcon,
  '🗺️': Map,
  '📄': FileText,
  '📸': Camera,
  '🎬': Video,

  // String mapping (new) - 🏢 ENTERPRISE: Using centralized PropertyIcon
  'home': PropertyIcon,
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
  return ICON_MAPPING[icon as keyof typeof ICON_MAPPING] || PropertyIcon;
}

// ============================================================================
// COMPONENT MAPPING
// ============================================================================

import { PropertyDetailsContent } from '@/components/property-viewer/details/PropertyDetailsContent';
import PhotosTabContent from '@/components/building-management/tabs/PhotosTabContent';
import VideosTabContent from '@/components/building-management/tabs/VideosTabContent';
import { FloorPlanTab } from '@/features/properties-sidebar/components/FloorPlanTab';
import { PropertyCustomerTab as UnitCustomerTab } from '@/components/properties/tabs/PropertyCustomerTab';
import '@/lib/design-system';

function DocumentsPlaceholder({ title, subtitle }: { title: string; subtitle: string }) {
  const colors = useSemanticColors();
  return (
    <div className={cn("text-center p-4", colors.text.muted)}>
      <p>{title} - Coming Soon</p>
      <p className="text-xs mt-2">{subtitle}</p>
    </div>
  );
}

/**
 * Component mapping για την αντιστοίχιση component names σε actual components
 */
const COMPONENT_MAPPING: Record<string, React.ComponentType<GenericComponentProps>> = {
  'PropertyDetailsContent': PropertyDetailsContent as unknown as React.ComponentType<GenericComponentProps>,
  'UnitCustomerTab': UnitCustomerTab as unknown as React.ComponentType<GenericComponentProps>,
  'FloorPlanTab': FloorPlanTab as unknown as React.ComponentType<GenericComponentProps>,
  'PhotosTabContent': PhotosTabContent as unknown as React.ComponentType<GenericComponentProps>,
  'VideosTabContent': VideosTabContent as unknown as React.ComponentType<GenericComponentProps>,
  'DocumentsPlaceholder': DocumentsPlaceholder as unknown as React.ComponentType<GenericComponentProps>,
};

// ============================================================================
// INTERFACES
// ============================================================================

export interface GenericPropertiesTabsRendererProps {
  /** Units tabs configuration */
  tabs: PropertiesTabConfig[];
  /** Selected unit data */
  selectedProperty?: PropertyData;
  /** Default tab to show */
  defaultTab?: string;
  /** Additional data for specific tabs */
  additionalData?: {
    safeFloors?: FloorData[];
    currentFloor?: FloorData;
    safeViewerProps?: ViewerProps;
    safeViewerPropsWithFloors?: ViewerProps;
    setShowHistoryPanel?: (show: boolean) => void;
    units?: PropertyData[];
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
 * import { getSortedPropertiesTabs } from '@/config/properties-tabs-config';
 * import { GenericPropertiesTabsRenderer } from '@/components/generic';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
 *
 * function UnitTabs({ selectedProperty }) {
 *   const tabs = getSortedUnitsTabs();
 *
 *   return (
 *     <GenericPropertiesTabsRenderer
 *       tabs={tabs}
 *       selectedProperty={selectedProperty}
 *       defaultTab="info"
 *     />
 *   );
 * }
 * ```
 */
export function GenericPropertiesTabsRenderer({
  tabs,
  selectedProperty,
  defaultTab = 'info',
  additionalData = {},
  customComponents = {},
  globalProps = {},
}: GenericPropertiesTabsRendererProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
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
    logger.warn('Unknown component', { componentName });
    const FallbackComponent = ({ children }: { children?: React.ReactNode }) => (
      <div className={cn("p-4 text-center", colors.text.muted)}>
        <p>Component &quot;{componentName}&quot; not found</p>
        {children}
      </div>
    );
    FallbackComponent.displayName = 'FallbackComponent';
    return FallbackComponent;
  };

  // Helper function to get component props
  const getComponentProps = (tab: PropertiesTabConfig): GenericComponentProps => {
    const baseProps: GenericComponentProps = {
      selectedProperty,
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
        property: selectedProperty,
        onSelectFloor,
        onUpdateProperty,
      };
    }

    // Special handling για FloorPlanTab
    if (tab.component === 'FloorPlanTab') {
      return {
        ...baseProps,
        selectedProperty,
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
  const getContentWrapper = (tab: PropertiesTabConfig, content: React.ReactNode) => {
    // Special wrapping για info tab
    if (tab.value === 'info') {
      return (
        <ScrollArea className="h-full p-4">
          {selectedProperty ? (
            content
          ) : (
            <div className={cn("flex flex-col items-center justify-center h-full text-center", colors.text.muted)}>
              <PropertyIcon className={`${iconSizes.xl3} mb-4 opacity-50 ${propertyColor}`} />
              <h3 className="text-lg font-semibold mb-2">{t('selectUnit')}</h3>
              <p className="text-sm">{t('selectUnitDescription')}</p>
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

  // Μετατροπή PropertiesTabConfig[] σε TabDefinition[]
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

export default GenericPropertiesTabsRenderer;
