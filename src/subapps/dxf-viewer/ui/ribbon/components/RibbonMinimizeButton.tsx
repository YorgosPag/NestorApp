'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { RibbonMinimizeState } from '../types/ribbon-types';

interface RibbonMinimizeButtonProps {
  minimizeState: RibbonMinimizeState;
  onCycle: () => void;
}

const ARROW_BY_STATE: Record<RibbonMinimizeState, string> = {
  'full': '▲',
  'panel-buttons': '▴',
  'panel-titles': '▵',
  'tab-names': '▽',
};

export const RibbonMinimizeButton: React.FC<RibbonMinimizeButtonProps> = ({
  minimizeState,
  onCycle,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="dxf-ribbon-minimize-button"
          onClick={onCycle}
          aria-label={t('ribbon.ariaLabels.minimize')}
        >
          {ARROW_BY_STATE[minimizeState]}
        </button>
      </TooltipTrigger>
      <TooltipContent>{t(`ribbon.minimizeStates.${toCamel(minimizeState)}`)}</TooltipContent>
    </Tooltip>
  );
};

function toCamel(state: RibbonMinimizeState): string {
  switch (state) {
    case 'full':
      return 'full';
    case 'panel-buttons':
      return 'panelButtons';
    case 'panel-titles':
      return 'panelTitles';
    case 'tab-names':
      return 'tabNames';
  }
}
