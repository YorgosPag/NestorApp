'use client';

import React from 'react';
import { TabsContent } from "@/components/ui/tabs";
import { TabsOnlyTriggers, type TabDefinition } from "@/components/ui/navigation/TabsComponents";
import type { ProjectTabConfig } from '@/config/project-tabs-config';
import type { Project } from '@/types/project';
import { getIconComponent } from './utils/IconMapping';

// ============================================================================
// COMPONENT MAPPING
// ============================================================================

import { GeneralProjectTab } from '../projects/general-project-tab';
import { BuildingDataTab } from '../projects/BuildingDataTab';
import { ParkingTab } from '../projects/parking/ParkingTab';
import { ContributorsTab } from '../projects/contributors-tab';
import { DocumentsProjectTab } from '../projects/documents-project-tab';
import { IkaTab } from '../projects/ika-tab';
import { PhotosTab } from '../projects/PhotosTab';
import { VideosTab } from '../projects/VideosTab';
import { ProjectTimelineTab } from '../projects/ProjectTimelineTab';
import { ProjectCustomersTab } from '../projects/customers-tab';
import { ProjectStructureTab } from '../projects/tabs/ProjectStructureTab';
import { FloorplanViewerTab } from '../projects/tabs/FloorplanViewerTab';

/**
 * Component mapping για την αντιστοίχιση component names σε actual components
 */
const COMPONENT_MAPPING = {
  'GeneralProjectTab': GeneralProjectTab,
  'BuildingDataTab': BuildingDataTab,
  'ParkingTab': ParkingTab,
  'ContributorsTab': ContributorsTab,
  'DocumentsProjectTab': DocumentsProjectTab,
  'IkaTab': IkaTab,
  'PhotosTab': PhotosTab,
  'VideosTab': VideosTab,
  'ProjectTimelineTab': ProjectTimelineTab,
  'ProjectCustomersTab': ProjectCustomersTab,
  'ProjectStructureTab': ProjectStructureTab,
  'FloorplanViewerTab': FloorplanViewerTab,
} as const;

// ============================================================================
// INTERFACES
// ============================================================================

export interface GenericProjectTabsRendererProps {
  /** Project tabs configuration */
  tabs: ProjectTabConfig[];
  /** Project data to display */
  project: Project & { companyName: string };
  /** Default tab to show */
  defaultTab?: string;
  /** Additional data for specific tabs */
  additionalData?: {
    projectFloorplan?: any;
    parkingFloorplan?: any;
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
 * Generic Project Tabs Renderer
 *
 * Renders project detail tabs based on configuration
 *
 * @example
 * ```tsx
 * import { getSortedProjectTabs } from '@/config/project-tabs-config';
 * import { GenericProjectTabsRenderer } from '@/components/generic';
 *
 * function ProjectDetails({ project }) {
 *   const tabs = getSortedProjectTabs();
 *
 *   return (
 *     <GenericProjectTabsRenderer
 *       tabs={tabs}
 *       project={project}
 *       defaultTab="general"
 *     />
 *   );
 * }
 * ```
 */
export function GenericProjectTabsRenderer({
  tabs,
  project,
  defaultTab = 'general',
  additionalData = {},
  customComponents = {},
  globalProps = {},
}: GenericProjectTabsRendererProps) {
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
  const getComponentProps = (tab: ProjectTabConfig) => {
    const baseProps = {
      project,
      ...globalProps,
    };

    // Προσθήκη custom props από τη configuration
    if (tab.componentProps) {
      Object.assign(baseProps, tab.componentProps);
    }

    // Special handling για FloorplanViewerTab
    // 🏢 ENTERPRISE: Pass full FloorplanData object (supports both DXF and PDF)
    if (tab.component === 'FloorplanViewerTab') {
      if (tab.value === 'floorplan') {
        return {
          ...baseProps,
          floorplanData: additionalData.projectFloorplan,
          onAddFloorplan: () => {
            console.log('Add project floorplan for project:', project.id);
          },
          onEditFloorplan: () => {
            console.log('Edit project floorplan for project:', project.id);
          },
        };
      } else if (tab.value === 'parking-floorplan') {
        return {
          ...baseProps,
          floorplanData: additionalData.parkingFloorplan,
          onAddFloorplan: () => {
            console.log('Add parking floorplan for project:', project.id);
          },
          onEditFloorplan: () => {
            console.log('Edit parking floorplan for project:', project.id);
          },
        };
      }
    }

    return baseProps;
  };

  // Μετατροπή ProjectTabConfig[] σε TabDefinition[]
  const tabDefinitions: TabDefinition[] = enabledTabs.map((tab) => {
    const Component = getComponent(tab.component || 'GeneralProjectTab');
    const componentProps = getComponentProps(tab);
    const IconComponent = getIconComponent(tab.icon);

    return {
      id: tab.value,
      label: tab.label,
      icon: IconComponent,
      content: <Component {...componentProps} />,
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

export default GenericProjectTabsRenderer;