'use client';

import React from 'react';
import { BarChart, Construction, Map, Settings, type LucideIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '../../../../i18n';
import { PANEL_TOKENS, PanelTokenUtils } from '../../config/panel-tokens';
// 🏢 ENTERPRISE: Import from Single Source of Truth
import type { FloatingPanelType } from '../../types/panel-types';

// 🏢 ENTERPRISE: Re-export for backwards compatibility
export type { FloatingPanelType };
/** @deprecated Use FloatingPanelType instead */
export type PanelType = FloatingPanelType;

// 🏢 ENTERPRISE: Proper TypeScript interface with LucideIcon (NO any!)
interface TabDefinition {
  id: PanelType;
  label: string;
  icon: LucideIcon;
}

interface PanelTabsProps {
  activePanel: PanelType;
  onTabClick: (panel: PanelType) => void;
  disabledPanels: Partial<Record<PanelType, boolean>>;
  isCollapsed: boolean;
}

/**
 * 🏢 ENTERPRISE: PanelTabs - Migrated to Centralized Radix Tabs System
 *
 * Uses @radix-ui/react-tabs via @/components/ui/tabs for:
 * - Accessibility (ARIA roles, keyboard navigation)
 * - Controlled state management
 * - Theme-aware styling
 *
 * @see src/components/ui/tabs.tsx - Centralized Radix Tabs components
 */
export function PanelTabs({ activePanel, onTabClick, disabledPanels, isCollapsed }: PanelTabsProps) {
  const { t } = useTranslation('dxf-viewer');

  // 🏢 ENTERPRISE: Tab definitions with proper LucideIcon type
  const topRowTabs: TabDefinition[] = [
    { id: 'levels', label: t('panels.levels.title'), icon: BarChart },
    { id: 'hierarchy', label: t('panels.hierarchy.title'), icon: Construction },
  ];

  const bottomRowTabs: TabDefinition[] = [
    { id: 'overlay', label: t('panels.overlay.title'), icon: Map },
    { id: 'colors', label: 'Ρυθμίσεις DXF', icon: Settings },
  ];

  // 🏢 ENTERPRISE: Handler για Radix onValueChange
  const handleValueChange = (value: string) => {
    onTabClick(value as PanelType);
  };

  // 🏢 ENTERPRISE: Get tab classes from centralized PanelTokenUtils
  const getTabClass = (tabId: PanelType) => {
    const disabled = disabledPanels[tabId];
    const isActive = activePanel === tabId;
    return PanelTokenUtils.getTabButtonClasses(isActive, disabled);
  };

  // 🏢 ENTERPRISE: Render tab row using Radix TabsList
  const renderTabRow = (tabs: TabDefinition[]) => (
    <TabsList className={PANEL_TOKENS.TABS.TAB_ROW.BASE}>
      {tabs.map((tab) => {
        const IconComponent = tab.icon;
        return (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            disabled={disabledPanels[tab.id]}
            className={getTabClass(tab.id)}
          >
            <IconComponent className={PANEL_TOKENS.TABS.TAB_ICON.SIZE} />
            {!isCollapsed && <span className={PANEL_TOKENS.TABS.TAB_LABEL.SIZE}>{tab.label}</span>}
          </TabsTrigger>
        );
      })}
    </TabsList>
  );

  return (
    <Tabs
      value={activePanel}
      onValueChange={handleValueChange}
      className={`${PANEL_TOKENS.TABS.CONTAINER.BASE} ${PANEL_TOKENS.TABS.CONTAINER.BORDER}`}
    >
      {renderTabRow(topRowTabs)}
      {renderTabRow(bottomRowTabs)}
    </Tabs>
  );
}
