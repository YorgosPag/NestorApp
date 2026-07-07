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
import type { ButtonSize, RibbonCommand } from '../../types/ribbon-types';
import { useRibbonDispatch } from '../../context/RibbonCommandContext';
import { useRibbonToggleState } from '../../context/useRibbonFieldSelectors';
import { RibbonButtonIcon } from './RibbonButtonIcon';
import { Tooltip, TooltipContent, TooltipTrigger } from '../RibbonTooltip';

interface RibbonToggleButtonProps {
  command: RibbonCommand;
  /**
   * ADR-507 Φ3 — Button footprint. `'large'` renders the tall Home-tab-style
   * button (32px icon on top + label below, `dxf-ribbon-btn-large`) so radio-like
   * mode toggles read like the big drawing-tool buttons; `'small'` (default) keeps
   * the inline `[icon Label]` toggle. Defaults to small for back-compat.
   */
  size?: ButtonSize;
}

// ADR-547 Stage 4 Option B — writers from the STABLE dispatch context, reactive
// state from a per-key `RibbonFieldStore` subscription, memoized on the static
// `command` → editing another field never re-renders this toggle.
const RibbonToggleButtonInner: React.FC<RibbonToggleButtonProps> = ({
  command,
  size = 'small',
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const { onToggle, onComingSoon, onAction } = useRibbonDispatch();
  const state = useRibbonToggleState(command.commandKey);

  const label = t(command.labelKey);
  const tooltip = command.tooltipKey ? t(command.tooltipKey) : label;
  const shortcut = command.shortcut ? ` (${command.shortcut})` : '';
  const isMixed = state === null;
  const pressed = state === true;
  const isLarge = size === 'large';

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
          className={
            isLarge
              ? 'dxf-ribbon-btn dxf-ribbon-btn-large dxf-ribbon-btn-toggle'
              : 'dxf-ribbon-btn dxf-ribbon-btn-small dxf-ribbon-btn-toggle'
          }
          onClick={handleClick}
          aria-pressed={pressed}
          data-command-id={command.id}
          data-coming-soon={command.comingSoon ? 'true' : undefined}
          data-pressed={pressed ? 'true' : undefined}
          data-mixed={isMixed ? 'true' : undefined}
        >
          {isLarge ? (
            <>
              <span className="dxf-ribbon-btn-icon-wrap">
                <RibbonButtonIcon icon={command.icon} size="large" />
              </span>
              <span className="dxf-ribbon-btn-label">{label}</span>
            </>
          ) : (
            <>
              <RibbonButtonIcon icon={command.iconSmall ?? command.icon} size="small" />
              <span className="dxf-ribbon-btn-label-inline">{label}</span>
            </>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>{`${tooltip}${shortcut}`}</TooltipContent>
    </Tooltip>
  );
};

export const RibbonToggleButton = React.memo(RibbonToggleButtonInner);
