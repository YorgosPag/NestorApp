'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type {
  RibbonButton,
  RibbonPanelDef,
  RibbonRow,
} from '../types/ribbon-types';
import { RibbonLargeButton } from './buttons/RibbonLargeButton';
import { RibbonSmallButton } from './buttons/RibbonSmallButton';
import { RibbonSplitButton } from './buttons/RibbonSplitButton';
import { RibbonToggleButton } from './buttons/RibbonToggleButton';
import { RibbonCombobox } from './buttons/RibbonCombobox';
import { ZoomControlsWidget } from './ZoomControlsWidget';
import { RibbonColorSwatchWidget } from './RibbonColorSwatchWidget';
import { RibbonJustificationGridWidget } from './RibbonJustificationGridWidget';
import { RibbonFontFamilyWidget } from './RibbonFontFamilyWidget';
import { RibbonLineSpacingWidget } from './RibbonLineSpacingWidget';
import { RibbonAnnotationScaleWidget } from './RibbonAnnotationScaleWidget';
import { RibbonInsertTokenWidget } from './RibbonInsertTokenWidget';

interface RibbonPanelProps {
  panel: RibbonPanelDef;
}

function renderButton(button: RibbonButton): React.ReactNode {
  const key = button.command.id;
  if (button.type === 'color-swatch') {
    return <RibbonColorSwatchWidget key={button.command.id} />;
  }
  if (button.type === 'widget') {
    if (button.widgetId === 'zoom-controls') {
      return <ZoomControlsWidget key="zoom-controls-widget" />;
    }
    if (button.widgetId === 'justification-grid') {
      return <RibbonJustificationGridWidget key="justification-grid-widget" />;
    }
    if (button.widgetId === 'font-family') {
      return <RibbonFontFamilyWidget key="font-family-widget" />;
    }
    if (button.widgetId === 'line-spacing') {
      return <RibbonLineSpacingWidget key="line-spacing-widget" />;
    }
    if (button.widgetId === 'annotation-scale') {
      return <RibbonAnnotationScaleWidget key="annotation-scale-widget" />;
    }
    if (button.widgetId === 'insert-tokens') {
      return <RibbonInsertTokenWidget key="insert-tokens-widget" />;
    }
    return null;
  }
  if (button.type === 'split') {
    return <RibbonSplitButton key={key} button={button} />;
  }
  // ADR-345 §4.4-4.5 Fase 5.5 — toggle/combobox sit alongside simple types.
  if (button.type === 'toggle') {
    return <RibbonToggleButton key={key} command={button.command} />;
  }
  if (button.type === 'combobox') {
    return <RibbonCombobox key={key} command={button.command} />;
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
    </section>
  );
};
