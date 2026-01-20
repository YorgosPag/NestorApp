// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import React from 'react';
import { BarChart, Construction, Map, Settings } from 'lucide-react';
import { useTranslation } from '../../../../i18n';
// 🏢 ENTERPRISE: Use centralized TabsOnlyTriggers (same as Contacts, ΓΕΜΗ tabs)
import { TabsOnlyTriggers, type TabDefinition } from '@/components/ui/navigation/TabsComponents';
// 🏢 ENTERPRISE: Import from Single Source of Truth (ADR-010)
import type { FloatingPanelType } from '../../types/panel-types';

// 🏢 ENTERPRISE: Re-export for backwards compatibility
export type { FloatingPanelType };
/** @deprecated Use FloatingPanelType instead */
export type PanelType = FloatingPanelType;

interface PanelTabsProps {
  activePanel: FloatingPanelType;
  onTabClick: (panel: FloatingPanelType) => void;
  disabledPanels: Partial<Record<FloatingPanelType, boolean>>;
  isCollapsed: boolean;
}

/**
 * 🏢 ENTERPRISE: PanelTabs - Floating Panel Navigation
 *
 * Uses centralized TabsOnlyTriggers component (same as Contacts/ΓΕΜΗ tabs)
 * Uses FloatingPanelType from types/panel-types.ts (Single Source of Truth - ADR-010)
 *
 * @see @/components/ui/navigation/TabsComponents.tsx - Centralized tabs system
 * @see types/panel-types.ts - Centralized panel type definitions
 */
export function PanelTabs({ activePanel, onTabClick, disabledPanels, isCollapsed }: PanelTabsProps) {
  const { t } = useTranslation('dxf-viewer');

  // 🏢 ENTERPRISE: Create tabs in TabDefinition format (same as GenericFormTabRenderer)
  const tabs: TabDefinition[] = [
    {
      id: 'levels',
      label: isCollapsed ? '' : t('panels.levels.title'),
      icon: BarChart,
      content: null, // Content is rendered by parent
      disabled: disabledPanels['levels'],
    },
    {
      id: 'hierarchy',
      label: isCollapsed ? '' : t('panels.hierarchy.title'),
      icon: Construction,
      content: null,
      disabled: disabledPanels['hierarchy'],
    },
    {
      id: 'overlay',
      label: isCollapsed ? '' : t('panels.overlay.title'),
      icon: Map,
      content: null,
      disabled: disabledPanels['overlay'],
    },
    {
      id: 'colors',
      label: isCollapsed ? '' : t('dxfSettings.title'),
      icon: Settings,
      content: null,
      disabled: disabledPanels['colors'],
    },
  ];

  // 🏢 ENTERPRISE: Handle tab change - convert string to FloatingPanelType
  const handleTabChange = (tabId: string) => {
    onTabClick(tabId as FloatingPanelType);
  };

  return (
    <TabsOnlyTriggers
      tabs={tabs}
      value={activePanel}
      onTabChange={handleTabChange}
      theme="dark"
      alwaysShowLabels={!isCollapsed}
    />
  );
}
