'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { RibbonMinimizeState, RibbonTab } from '../types/ribbon-types';
import type { TabDragHandlers } from '../hooks/useRibbonTabDrag';
import { RibbonTabItem } from './RibbonTabItem';
import { RibbonMinimizeButton } from './RibbonMinimizeButton';

interface RibbonTabBarProps {
  tabs: RibbonTab[];
  activeTabId: string;
  minimizeState: RibbonMinimizeState;
  onTabActivate: (id: string) => void;
  onTabDoubleClick: () => void;
  onTabContextMenu: (e: React.MouseEvent) => void;
  onCycleMinimize: () => void;
  drag: TabDragHandlers;
}

export const RibbonTabBar: React.FC<RibbonTabBarProps> = ({
  tabs,
  activeTabId,
  minimizeState,
  onTabActivate,
  onTabDoubleClick,
  onTabContextMenu,
  onCycleMinimize,
  drag,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <div
      className="dxf-ribbon-tab-bar"
      role="tablist"
      aria-label={t('ribbon.ariaLabels.tabBar')}
    >
      <div className="dxf-ribbon-tab-list">
        {tabs.map((tab) => (
          <RibbonTabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onActivate={() => onTabActivate(tab.id)}
            onDoubleClick={onTabDoubleClick}
            onContextMenu={onTabContextMenu}
            drag={drag}
          />
        ))}
      </div>
      <RibbonMinimizeButton
        minimizeState={minimizeState}
        onCycle={onCycleMinimize}
      />
    </div>
  );
};
