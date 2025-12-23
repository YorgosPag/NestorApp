'use client';

import React from 'react';
import { TabsContent } from "@/components/ui/tabs";
import { TabsOnlyTriggers, type TabDefinition } from "@/components/ui/navigation/TabsComponents";
import type { CRMDashboardTabConfig } from '@/config/crm-dashboard-tabs-config';
import { TrendingUp, Target, Users, MessageSquare, Clock, Calendar } from 'lucide-react';

// ============================================================================
// ICON MAPPING
// ============================================================================

/**
 * Mapping από emoji icons σε Lucide React icons
 */
const ICON_MAPPING = {
  '📈': TrendingUp,
  '🎯': Target,
  '👥': Users,
  '💬': MessageSquare,
  '⏰': Clock,
  '📅': Calendar,
} as const;

/**
 * Helper function για την μετατροπή emoji icon σε Lucide icon
 */
function getIconComponent(emojiIcon: string) {
  return ICON_MAPPING[emojiIcon as keyof typeof ICON_MAPPING] || TrendingUp;
}

// ============================================================================
// COMPONENT MAPPING
// ============================================================================

import { OverviewTab } from '../crm/dashboard/OverviewTab';
import { PipelineTab } from '../crm/dashboard/PipelineTab';
import { ContactsTab } from '../crm/dashboard/ContactsTab';
import { CommunicationsTab } from '../crm/dashboard/CommunicationsTab';
import { TasksTab } from '../crm/dashboard/TasksTab';
import { CalendarTab } from '../crm/dashboard/CalendarTab';

/**
 * Component mapping για την αντιστοίχιση component names σε actual components
 */
const COMPONENT_MAPPING = {
  'OverviewTab': OverviewTab,
  'PipelineTab': PipelineTab,
  'ContactsTab': ContactsTab,
  'CommunicationsTab': CommunicationsTab,
  'TasksTab': TasksTab,
  'CalendarTab': CalendarTab,
} as const;

// ============================================================================
// INTERFACES
// ============================================================================

export interface GenericCRMDashboardTabsRendererProps {
  /** CRM Dashboard tabs configuration */
  tabs: CRMDashboardTabConfig[];
  /** Default tab to show */
  defaultTab?: string;
  /** Selected period for date filtering */
  selectedPeriod?: string;
  /** Additional data for specific tabs */
  additionalData?: {
    selectedPeriod?: string;
    [key: string]: any;
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
 * Generic CRM Dashboard Tabs Renderer
 *
 * Renders CRM dashboard tabs based on configuration using TabsOnlyTriggers
 *
 * @example
 * ```tsx
 * import { getSortedCRMDashboardTabs } from '@/config/crm-dashboard-tabs-config';
 * import { GenericCRMDashboardTabsRenderer } from '@/components/generic';
 *
 * function CRMDashboard({ selectedPeriod }) {
 *   const tabs = getSortedCRMDashboardTabs();
 *
 *   return (
 *     <GenericCRMDashboardTabsRenderer
 *       tabs={tabs}
 *       defaultTab="overview"
 *       selectedPeriod={selectedPeriod}
 *     />
 *   );
 * }
 * ```
 */
export function GenericCRMDashboardTabsRenderer({
  tabs,
  defaultTab = 'overview',
  selectedPeriod,
  additionalData = {},
  customComponents = {},
  globalProps = {},
}: GenericCRMDashboardTabsRendererProps) {
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
  const getComponentProps = (tab: CRMDashboardTabConfig) => {
    const baseProps = {
      selectedPeriod,
      ...additionalData,
      ...globalProps,
    };

    // Προσθήκη custom props από τη configuration
    if (tab.componentProps) {
      Object.assign(baseProps, tab.componentProps);
    }

    return baseProps;
  };

  // Helper function to get content wrapper
  const getContentWrapper = (tab: CRMDashboardTabConfig, content: React.ReactNode) => {
    // Όλα τα CRM Dashboard tabs χρησιμοποιούν το ίδιο wrapper
    return (
      <div className="h-full">
        {content}
      </div>
    );
  };

  // Μετατροπή CRMDashboardTabConfig[] σε TabDefinition[]
  const tabDefinitions: TabDefinition[] = enabledTabs.map((tab) => {
    const Component = getComponent(tab.component || 'OverviewTab');
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

export default GenericCRMDashboardTabsRenderer;