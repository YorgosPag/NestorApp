'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type {
  RibbonMinimizeState,
  RibbonTab,
} from '../types/ribbon-types';
import { RibbonPanel } from './RibbonPanel';

interface RibbonBodyProps {
  activeTab: RibbonTab | undefined;
  minimizeState: RibbonMinimizeState;
  layersTabContent?: React.ReactNode;
}

export const RibbonBody: React.FC<RibbonBodyProps> = ({
  activeTab,
  minimizeState,
  layersTabContent,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  if (!activeTab) return null;
  const isLayersExpanded =
    activeTab.id === 'layers' && layersTabContent !== undefined;
  return (
    <div
      className="dxf-ribbon-body"
      data-minimize={minimizeState}
      data-tab-mode={isLayersExpanded ? 'expanded' : 'panels'}
      role="tabpanel"
      aria-label={t('ribbon.ariaLabels.tabBody')}
    >
      {isLayersExpanded
        ? layersTabContent
        : activeTab.panels.map((panel) => (
            <RibbonPanel key={panel.id} panel={panel} />
          ))}
    </div>
  );
};
