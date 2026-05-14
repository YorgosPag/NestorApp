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
}

export const RibbonBody: React.FC<RibbonBodyProps> = ({
  activeTab,
  minimizeState,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  if (!activeTab) return null;
  return (
    <div
      className="dxf-ribbon-body"
      data-minimize={minimizeState}
      data-tab-mode="panels"
      role="tabpanel"
      aria-label={t('ribbon.ariaLabels.tabBody')}
    >
      {activeTab.panels.map((panel) => (
        <RibbonPanel key={panel.id} panel={panel} />
      ))}
    </div>
  );
};
