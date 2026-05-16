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
  const { onToolChange, onComingSoon, onAction, activeTool } = useRibbonCommand();

  const label = t(command.labelKey);
  const shortcut = command.shortcut ? ` (${command.shortcut})` : '';
  // ADR-345 Fase 5.6 — pure tool buttons highlight when their commandKey
  // matches activeTool. Skip for comingSoon / action buttons (stateless).
  const isActive =
    !command.comingSoon &&
    !command.action &&
    activeTool !== null &&
    activeTool === command.commandKey;

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
          className="dxf-ribbon-btn dxf-ribbon-btn-large"
          onClick={handleClick}
          aria-pressed={isActive || undefined}
          data-command-id={command.id}
          data-coming-soon={command.comingSoon ? 'true' : undefined}
          data-active={isActive ? 'true' : undefined}
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
