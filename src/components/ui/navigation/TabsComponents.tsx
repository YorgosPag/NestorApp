'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LucideIcon } from 'lucide-react';

// Re-export TabsContent for convenience
export { TabsContent };
import { cn } from '@/lib/utils';
import { THEME_VARIANTS, getThemeVariant, type ThemeVariant } from '@/components/ui/theme/ThemeComponents';
import { useIconSizes } from '@/hooks/useIconSizes';

// Centralized tabs styling using the theme system
export const TABS_STYLES = {
  container: "w-full",
  list: "flex flex-wrap gap-2 w-full h-auto min-h-fit",
  content: "mt-3",
  contentWrapper: "flex flex-wrap gap-2"
} as const;

// Tab definition interface
export interface TabDefinition {
  id: string;
  label: string;
  icon: LucideIcon;
  content: React.ReactNode;
  disabled?: boolean;
}

// Main TabsContainer props
interface TabsContainerProps {
  tabs: TabDefinition[];
  defaultTab?: string;
  selectedItems?: string[];
  selectionMessage?: string;
  theme?: ThemeVariant;
  className?: string;
  onTabChange?: (tabId: string) => void;
}

/**
 * Centralized Tabs Container Component
 *
 * Enterprise-grade tabs system that can be reused across the application.
 * Supports multiple layouts (toolbar, card, minimal) and handles selection state.
 *
 * @example
 * // ContactsToolbar usage
 * const tabs = [
 *   { id: 'actions', label: 'Ενέργειες', icon: Settings, content: <ActionsContent /> },
 *   { id: 'communication', label: 'Επικοινωνία', icon: MessageSquare, content: <CommunicationContent /> }
 * ];
 *
 * <TabsContainer
 *   tabs={tabs}
 *   layout="toolbar"
 *   selectedItems={selectedContacts}
 *   selectionMessage={`${selectedContacts.length} επιλεγμένες επαφές`}
 * />
 */
export function TabsContainer({
  tabs,
  defaultTab,
  selectedItems = [],
  selectionMessage,
  theme = 'default',
  className,
  onTabChange
}: TabsContainerProps) {
  const iconSizes = useIconSizes();
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onTabChange?.(tabId);
  };

  // Get theme configuration with fallback
  const themeConfig = getThemeVariant(theme) || getThemeVariant('default');

  // Use flexible layout that allows proper wrapping with vertical spacing and auto height
  const flexWrapStyles = "flex flex-wrap gap-2 h-auto min-h-fit";

  return (
    <div className={cn(themeConfig?.container, className)}>
      {/* Selection message */}
      {selectedItems.length > 0 && selectionMessage && (
        <div className="text-sm text-muted-foreground mb-2 px-2">
          {selectionMessage}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange} className={TABS_STYLES.container}>
        <TabsList className={TABS_STYLES.list}>
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              disabled={tab.disabled}
              className={themeConfig?.tabTrigger}
            >
              {React.createElement(tab.icon, { className: iconSizes.sm })}
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent
            key={tab.id}
            value={tab.id}
            className={themeConfig?.content}
          >
            <div className={TABS_STYLES.contentWrapper}>
              {tab.content}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// Specialized toolbar variant for quick usage
interface ToolbarTabsProps extends TabsContainerProps {}

export function ToolbarTabs(props: ToolbarTabsProps) {
  return <TabsContainer {...props} />;
}

// Themed variants for easy usage
export function WarningTabs(props: TabsContainerProps) {
  return <TabsContainer {...props} theme="warning" />;
}

export function SuccessTabs(props: TabsContainerProps) {
  return <TabsContainer {...props} theme="success" />;
}

export function DangerTabs(props: TabsContainerProps) {
  return <TabsContainer {...props} theme="danger" />;
}

export function DarkTabs(props: TabsContainerProps) {
  return <TabsContainer {...props} theme="dark" />;
}

export function LightTabs(props: TabsContainerProps) {
  return <TabsContainer {...props} theme="light" />;
}

// Specialized component that ONLY centralizes tab triggers without affecting content
interface TabsOnlyTriggersProps {
  tabs: TabDefinition[];
  defaultTab?: string;
  selectedItems?: string[];
  selectionMessage?: string;
  theme?: ThemeVariant;
  className?: string;
  onTabChange?: (tabId: string) => void;
  children?: React.ReactNode;
}

/**
 * Tabs component that centralizes ONLY the tab triggers
 * without applying any wrapper styling to content.
 * Perfect for cases where existing content layout must be preserved.
 */
export function TabsOnlyTriggers({
  tabs,
  defaultTab,
  selectedItems = [],
  selectionMessage,
  theme = 'default',
  className,
  onTabChange,
  children
}: TabsOnlyTriggersProps) {
  const iconSizes = useIconSizes();
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onTabChange?.(tabId);
  };

  // Get theme configuration with fallback
  const themeConfig = getThemeVariant(theme) || getThemeVariant('default');

  // Use flexible layout that allows proper wrapping with vertical spacing and auto height
  const flexWrapStyles = "flex flex-wrap gap-2 h-auto min-h-fit";

  return (
    <div className={cn(themeConfig?.container, className)}>
      {/* Selection message */}
      {selectedItems.length > 0 && selectionMessage && (
        <div className="text-sm text-muted-foreground mb-2 px-2">
          {selectionMessage}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange} className={TABS_STYLES.container}>
        <TabsList className={TABS_STYLES.list}>
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              disabled={tab.disabled}
              className={themeConfig?.tabTrigger}
            >
              {React.createElement(tab.icon, { className: iconSizes.sm })}
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Render children directly without wrapper styling */}
        {children}
      </Tabs>
    </div>
  );
}