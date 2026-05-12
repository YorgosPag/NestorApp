'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type {
  RibbonButton,
  RibbonPanelDef,
  RibbonRow,
} from '../types/ribbon-types';
import { PanelLabel } from './PanelLabel';
import { RibbonLargeButton } from './buttons/RibbonLargeButton';
import { RibbonSmallButton } from './buttons/RibbonSmallButton';
import { RibbonSplitButton } from './buttons/RibbonSplitButton';

interface RibbonPanelProps {
  panel: RibbonPanelDef;
}

function renderButton(button: RibbonButton): React.ReactNode {
  const key = button.command.id;
  if (button.type === 'split') {
    return <RibbonSplitButton key={key} button={button} />;
  }
  if (button.size === 'large') {
    return <RibbonLargeButton key={key} command={button.command} />;
  }
  return <RibbonSmallButton key={key} command={button.command} />;
}

function rowSize(row: RibbonRow): 'large' | 'small' | 'mixed' {
  if (row.buttons.length === 0) return 'large';
  const first = row.buttons[0].size;
  return row.buttons.every((b) => b.size === first) ? first : 'mixed';
}

export const RibbonPanel: React.FC<RibbonPanelProps> = ({ panel }) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const hasContent = panel.rows.some((row) => row.buttons.length > 0);

  return (
    <section className="dxf-ribbon-panel" data-panel-id={panel.id}>
      <div className="dxf-ribbon-panel-body" data-empty={!hasContent}>
        {hasContent
          ? panel.rows
              .filter((row) => !row.isInFlyout && row.buttons.length > 0)
              .map((row, idx) => (
                <div
                  key={idx}
                  className="dxf-ribbon-panel-row"
                  data-row-size={rowSize(row)}
                >
                  {row.buttons.map(renderButton)}
                </div>
              ))
          : t('ribbon.panels.placeholder')}
      </div>
      <PanelLabel labelKey={panel.labelKey} />
    </section>
  );
};
