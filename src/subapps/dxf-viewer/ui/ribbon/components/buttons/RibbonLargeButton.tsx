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
import { isCommandActive } from '../../utils/ribbon-active-state';
import { RibbonButtonIcon } from './RibbonButtonIcon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useRenderTrace } from '../../../../debug/useRenderTrace'; // 🔴 TEMP DEBUG — remove after hover-lag diagnosis

interface RibbonLargeButtonProps {
  command: RibbonCommand;
}

export const RibbonLargeButton: React.FC<RibbonLargeButtonProps> = ({
  command,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const ribbonCtx = useRibbonCommand();
  // 🔴 TEMP DEBUG — `ribbonCtx` ref change = RibbonCommandContext provider value changed.
  useRenderTrace(`RibbonLargeButton:${command.id}`, { command, ribbonCtx });
  const { onToolChange, onComingSoon, onAction, activeTool } = ribbonCtx;

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
