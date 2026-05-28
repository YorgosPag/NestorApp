'use client';

import React from 'react';
import { Undo2, Redo2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useRibbonCommand } from '../context/RibbonCommandContext';

/**
 * ADR-345 Fase 5.7 — Undo / Redo buttons in the ribbon tab bar, between the
 * header-toggle button and the «Αρχικό» tab. They reuse the existing action
 * pipeline (`onAction('undo' | 'redo')` → CommandHistory, ADR-032), the same
 * one the Home › History panel and Ctrl+Z/Ctrl+Y use. Disabled (greyed) when
 * nothing is available to undo/redo, mirroring Word/AutoCAD.
 */
export const RibbonUndoRedoButtons: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const { onAction, canUndo, canRedo } = useRibbonCommand();
  return (
    <div className="dxf-ribbon-tabbar-actions" role="group">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="dxf-ribbon-tabbar-action-button"
            onClick={() => onAction('undo')}
            disabled={!canUndo}
            aria-label={t('ribbon.commands.undo')}
          >
            <Undo2 size={15} aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{t('ribbon.commands.undo')}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="dxf-ribbon-tabbar-action-button"
            onClick={() => onAction('redo')}
            disabled={!canRedo}
            aria-label={t('ribbon.commands.redo')}
          >
            <Redo2 size={15} aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{t('ribbon.commands.redo')}</TooltipContent>
      </Tooltip>
    </div>
  );
};
