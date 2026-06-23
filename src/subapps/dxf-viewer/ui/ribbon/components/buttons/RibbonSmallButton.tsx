'use client';

/**
 * ADR-345 §4.2 — Small button: 16x16 icon + inline label, ~20px row.
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { RibbonCommand } from '../../types/ribbon-types';
import type { ToolType } from '../../../toolbar/types';
import { useRibbonCommand } from '../../context/RibbonCommandContext';
import { isCommandActive } from '../../utils/ribbon-active-state';
import { RibbonButtonIcon } from './RibbonButtonIcon';
import { Tooltip, TooltipContent, TooltipTrigger } from '../RibbonTooltip';

interface RibbonSmallButtonProps {
  command: RibbonCommand;
}

export const RibbonSmallButton: React.FC<RibbonSmallButtonProps> = ({
  command,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const { onToolChange, onComingSoon, onAction, activeTool } = useRibbonCommand();

  const label = t(command.labelKey);
  const shortcut = command.shortcut ? ` (${command.shortcut})` : '';
  const isActive = isCommandActive(command, activeTool);

  const handleClick = useCallback(() => {
    if (command.comingSoon) {
      onComingSoon(label);
      return;
    }
    if (command.action) {
      onAction(command.action, command.actionData);
      return;
    }
    onToolChange(command.commandKey as ToolType);
  }, [
    onToolChange,
    onComingSoon,
    onAction,
    command.commandKey,
    command.comingSoon,
    command.action,
    command.actionData,
    label,
  ]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="dxf-ribbon-btn dxf-ribbon-btn-small"
          onClick={handleClick}
          aria-pressed={isActive || undefined}
          data-command-id={command.id}
          data-coming-soon={command.comingSoon ? 'true' : undefined}
          data-active={isActive ? 'true' : undefined}
        >
          <RibbonButtonIcon icon={command.iconSmall ?? command.icon} size="small" />
          <span className="dxf-ribbon-btn-label-inline">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{`${label}${shortcut}`}</TooltipContent>
    </Tooltip>
  );
};
