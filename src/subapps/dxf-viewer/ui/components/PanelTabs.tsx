'use client';

import React from 'react';
import { BarChart, Construction, Map, Settings } from 'lucide-react';
import { useTranslation } from '../../../../i18n';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';

type PanelType = 'overlay' | 'levels' | 'hierarchy' | 'colors';

interface PanelTabsProps {
  activePanel: PanelType;
  onTabClick: (panel: PanelType) => void;
  disabledPanels: Partial<Record<PanelType, boolean>>;
  isCollapsed: boolean;
}

export function PanelTabs({ activePanel, onTabClick, disabledPanels, isCollapsed }: PanelTabsProps) {
  const { t } = useTranslation('dxf-viewer');
  
  const topRowTabs: Array<{ id: PanelType; label: string; icon: React.ComponentType<any> }> = [
    { id: 'levels', label: t('panels.levels.title'), icon: BarChart },
    { id: 'hierarchy', label: t('panels.hierarchy.title'), icon: Construction },
  ];

  const bottomRowTabs: Array<{ id: PanelType; label: string; icon: React.ComponentType<any> }> = [
    { id: 'overlay', label: t('panels.overlay.title'), icon: Map },
    { id: 'colors', label: 'Ρυθμίσεις DXF', icon: Settings },
  ];

  const getTabClass = (tabId: PanelType) => {
    const baseClass = "flex items-center justify-center space-x-1 px-3 py-2 text-sm font-medium transition-colors cursor-pointer flex-1 rounded-md";
    const disabled = disabledPanels[tabId];
    
    if (disabled) {
      return `${baseClass} text-gray-500 cursor-not-allowed bg-gray-800`;
    }
    
    if (activePanel === tabId) {
      return `${baseClass} text-white bg-blue-600 border border-blue-400`;
    }
    
    return `${baseClass} text-gray-300 border border-gray-500 ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`;
  };

  const renderTabRow = (tabs: Array<{ id: PanelType; label: string; icon: React.ComponentType<any> }>) => (
    <div className="flex space-x-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabClick(tab.id)}
          disabled={disabledPanels[tab.id]}
          className={getTabClass(tab.id)}
        >
          <tab.icon className="w-5 h-5" />
          {!isCollapsed && <span className="text-xs">{tab.label}</span>}
        </button>
      ))}
    </div>
  );

  return (
    <div className="p-2 space-y-2 bg-gray-800 border-b border-gray-500">
      {renderTabRow(topRowTabs)}
      {renderTabRow(bottomRowTabs)}
    </div>
  );
}
