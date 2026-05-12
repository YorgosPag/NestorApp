'use client';

/**
 * ADR-345 §4.1 — Large button: 32x32 icon + label, ~40x56px.
 * Fires onToolChange via RibbonCommandContext.
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { RibbonCommand } from '../../types/ribbon-types';
import type { ToolType } from '../../../toolbar/types';
import { useRibbonCommand } from '../../context/RibbonCommandContext';
import { RibbonButtonIcon } from './RibbonButtonIcon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface RibbonLargeButtonProps {
  command: RibbonCommand;
}

export const RibbonLargeButton: React.FC<RibbonLargeButtonProps> = ({
  command,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const { onToolChange, onComingSoon } = useRibbonCommand();

  const label = t(command.labelKey);
  const shortcut = command.shortcut ? ` (${command.shortcut})` : '';

  const handleClick = useCallback(() => {
    if (command.comingSoon) {
      onComingSoon(label);
      return;
    }
    onToolChange(command.commandKey as ToolType);
  }, [onToolChange, onComingSoon, command.commandKey, command.comingSoon, label]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="dxf-ribbon-btn dxf-ribbon-btn-large"
          onClick={handleClick}
          data-command-id={command.id}
          data-coming-soon={command.comingSoon ? 'true' : undefined}
        >
          <span className="dxf-ribbon-btn-icon-wrap">
            <RibbonButtonIcon icon={command.icon} size="large" />
          </span>
          <span className="dxf-ribbon-btn-label">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{`${label}${shortcut}`}</TooltipContent>
    </Tooltip>
  );
};
