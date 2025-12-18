'use client';

import React from 'react';
import { BarChart, Construction, Map, Settings } from 'lucide-react';
import { useTranslation } from '../../../../i18n';
import { PANEL_TOKENS, PanelTokenUtils } from '../../config/panel-tokens';

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
    const disabled = disabledPanels[tabId];
    const isActive = activePanel === tabId;
    return PanelTokenUtils.getTabButtonClasses(isActive, disabled);
  };

  const renderTabRow = (tabs: Array<{ id: PanelType; label: string; icon: React.ComponentType<any> }>) => (
    <div className={PANEL_TOKENS.TABS.TAB_ROW.BASE}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabClick(tab.id)}
          disabled={disabledPanels[tab.id]}
          className={getTabClass(tab.id)}
        >
          <tab.icon className={PANEL_TOKENS.TABS.TAB_ICON.SIZE} />
          {!isCollapsed && <span className={PANEL_TOKENS.TABS.TAB_LABEL.SIZE}>{tab.label}</span>}
        </button>
      ))}
    </div>
  );

  return (
    <div className={`${PANEL_TOKENS.TABS.CONTAINER.BASE} ${PANEL_TOKENS.TABS.CONTAINER.BORDER}`}>
      {renderTabRow(topRowTabs)}
      {renderTabRow(bottomRowTabs)}
    </div>
  );
}
