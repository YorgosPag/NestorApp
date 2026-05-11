'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { RibbonPanelDef } from '../types/ribbon-types';
import { PanelLabel } from './PanelLabel';

interface RibbonPanelProps {
  panel: RibbonPanelDef;
}

export const RibbonPanel: React.FC<RibbonPanelProps> = ({ panel }) => {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <section className="dxf-ribbon-panel" data-panel-id={panel.id}>
      <div className="dxf-ribbon-panel-body">{t('ribbon.panels.placeholder')}</div>
      <PanelLabel labelKey={panel.labelKey} />
    </section>
  );
};
