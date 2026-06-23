'use client';

import React from 'react';
import { PanelTopOpen, PanelTopClose } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Tooltip, TooltipContent, TooltipTrigger } from './RibbonTooltip';
import { useDxfGlobalHeaderToggle } from '../hooks/useDxfGlobalHeaderToggle';

/**
 * ADR-345 — Toggle the global app header on /dxf/viewer.
 * Sits at the LEFT edge of the ribbon tab bar (before the «Αρχικό» tab),
 * mirroring the RibbonMinimizeButton on the right. Header starts hidden.
 */
export const RibbonHeaderToggleButton: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const { hidden, toggle } = useDxfGlobalHeaderToggle();
  const Icon = hidden ? PanelTopOpen : PanelTopClose;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="dxf-ribbon-header-toggle-button"
          onClick={toggle}
          aria-label={t('ribbon.ariaLabels.toggleHeader')}
          aria-pressed={!hidden}
        >
          <Icon size={15} aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {t(hidden ? 'ribbon.headerToggle.show' : 'ribbon.headerToggle.hide')}
      </TooltipContent>
    </Tooltip>
  );
};
