'use client';

/**
 * ADR-345 §4.2 — Small button: 16x16 icon + inline label, ~20px row.
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { RibbonCommand } from '../../types/ribbon-types';
import type { ToolType } from '../../../toolbar/types';
import { useRibbonCommand } from '../../context/RibbonCommandContext';
import { RibbonButtonIcon } from './RibbonButtonIcon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface RibbonSmallButtonProps {
  command: RibbonCommand;
}

export const RibbonSmallButton: React.FC<RibbonSmallButtonProps> = ({
  command,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const { onToolChange } = useRibbonCommand();

  const handleClick = useCallback(() => {
    onToolChange(command.commandKey as ToolType);
  }, [onToolChange, command.commandKey]);

  const label = t(command.labelKey);
  const shortcut = command.shortcut ? ` (${command.shortcut})` : '';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="dxf-ribbon-btn dxf-ribbon-btn-small"
          onClick={handleClick}
          data-command-id={command.id}
        >
          <RibbonButtonIcon icon={command.iconSmall ?? command.icon} size="small" />
          <span className="dxf-ribbon-btn-label-inline">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{`${label}${shortcut}`}</TooltipContent>
    </Tooltip>
  );
};
