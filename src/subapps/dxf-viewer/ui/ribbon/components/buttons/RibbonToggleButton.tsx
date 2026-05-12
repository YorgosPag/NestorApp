'use client';

/**
 * ADR-345 §4.4 Fase 5.5 — Toggle button.
 *
 * `[🔲 Label]` (OFF) ↔ `[█ Label]` (ON). State is sourced from the
 * `getToggleState(commandKey)` reader in RibbonCommandContext, so the
 * button stays declarative — the bridge decides what `bold = true`
 * means. Click dispatches `onToggle(commandKey, !current)`. Mixed
 * selection renders a dashed border (data-mixed) and clicking from
 * mixed flips to `true` (UX matches AutoCAD).
 *
 * Priority dispatch (matches RibbonLargeButton/SmallButton):
 *   comingSoon > action > toggle
 *
 * Toggles never fire `onToolChange` — they're orthogonal to tool mode.
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { RibbonCommand } from '../../types/ribbon-types';
import { useRibbonCommand } from '../../context/RibbonCommandContext';
import { RibbonButtonIcon } from './RibbonButtonIcon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface RibbonToggleButtonProps {
  command: RibbonCommand;
}

export const RibbonToggleButton: React.FC<RibbonToggleButtonProps> = ({
  command,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const { onToggle, onComingSoon, onAction, getToggleState } =
    useRibbonCommand();

  const label = t(command.labelKey);
  const shortcut = command.shortcut ? ` (${command.shortcut})` : '';
  const state = getToggleState(command.commandKey);
  const isMixed = state === null;
  const pressed = state === true;

  const handleClick = useCallback(() => {
    if (command.comingSoon) {
      onComingSoon(label);
      return;
    }
    if (command.action) {
      onAction(command.action, command.actionData);
      return;
    }
    onToggle(command.commandKey, !pressed);
  }, [
    onToggle,
    onComingSoon,
    onAction,
    command.commandKey,
    command.comingSoon,
    command.action,
    command.actionData,
    label,
    pressed,
  ]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="dxf-ribbon-btn dxf-ribbon-btn-small dxf-ribbon-btn-toggle"
          onClick={handleClick}
          aria-pressed={pressed}
          data-command-id={command.id}
          data-coming-soon={command.comingSoon ? 'true' : undefined}
          data-pressed={pressed ? 'true' : undefined}
          data-mixed={isMixed ? 'true' : undefined}
        >
          <RibbonButtonIcon
            icon={command.iconSmall ?? command.icon}
            size="small"
          />
          <span className="dxf-ribbon-btn-label-inline">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{`${label}${shortcut}`}</TooltipContent>
    </Tooltip>
  );
};
