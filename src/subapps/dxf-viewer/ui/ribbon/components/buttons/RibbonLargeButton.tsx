'use client';

/**
 * ADR-345 §4.1 — Large button: 32x32 icon + label, ~40x56px.
 * Fires onToolChange via RibbonCommandContext.
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { RibbonCommand } from '../../types/ribbon-types';
import type { ToolType } from '../../../toolbar/types';
import { useRibbonDispatch } from '../../context/RibbonCommandContext';
import { isCommandActive } from '../../utils/ribbon-active-state';
import { RibbonButtonIcon } from './RibbonButtonIcon';
import { Tooltip, TooltipContent, TooltipTrigger } from '../RibbonTooltip';

interface RibbonLargeButtonProps {
  command: RibbonCommand;
}

// ADR-547 Stage 4 (Option A) — subscribes to the STABLE dispatch context only +
// `React.memo` on the (stable) `command` prop, so this button + its Radix
// Tooltip bail out when the ribbon shell re-renders for a field-value change.
const RibbonLargeButtonInner: React.FC<RibbonLargeButtonProps> = ({
  command,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const { onToolChange, onComingSoon, onAction, activeTool, getCommandRecommendation } = useRibbonDispatch();

  const label = t(command.labelKey);
  const shortcut = command.shortcut ? ` (${command.shortcut})` : '';
  const isActive = isCommandActive(command, activeTool);
  // ADR-461 Phase C4 — Revit-style ADVISORY de-emphasis: a tool whose discipline
  // does not belong on the active storey kind is dimmed (still clickable). Counted
  // storeys → always recommended → no change.
  const recommended = getCommandRecommendation(command.commandKey);

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
          className={recommended ? 'dxf-ribbon-btn dxf-ribbon-btn-large' : 'dxf-ribbon-btn dxf-ribbon-btn-large opacity-40'}
          onClick={handleClick}
          aria-pressed={isActive || undefined}
          data-command-id={command.id}
          data-coming-soon={command.comingSoon ? 'true' : undefined}
          data-active={isActive ? 'true' : undefined}
          data-storey-recommended={recommended ? undefined : 'false'}
        >
          <span className="dxf-ribbon-btn-icon-wrap">
            <RibbonButtonIcon icon={command.icon} size="large" />
          </span>
          <span className="dxf-ribbon-btn-label">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {recommended ? `${label}${shortcut}` : `${label}${shortcut} — ${t('ribbon.storeyGating.notRecommended')}`}
      </TooltipContent>
    </Tooltip>
  );
};

export const RibbonLargeButton = React.memo(RibbonLargeButtonInner);
