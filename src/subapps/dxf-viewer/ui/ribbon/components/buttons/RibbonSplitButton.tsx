'use client';

/**
 * ADR-345 §4.3 — Split button. Click top half = exec last-used variant.
 * Click chevron = open dropdown of variants. Selecting a variant promotes
 * it to last-used (persisted via dxf-ribbon:splitLastUsed).
 *
 * ADR-521 — ALSO serves `type: 'dropdown'` (pure dropdown, no top-action): the
 * trigger opens the variant list and there is no chevron / no last-used top
 * action. Both shapes share THIS component so the ribbon has ONE "trigger +
 * variant dropdown" implementation (no duplicate shell). The differences are
 * gated by `isDropdownOnly`.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { RibbonButton, RibbonCommand } from '../../types/ribbon-types';
import type { ToolType } from '../../../toolbar/types';
import { useRibbonCommand } from '../../context/RibbonCommandContext';
import { isAnyVariantActive, flattenLeafVariants } from '../../utils/ribbon-active-state';
import { RibbonButtonIcon } from './RibbonButtonIcon';
import { RibbonSplitDropdown } from './RibbonSplitDropdown';
import { Tooltip, TooltipContent, TooltipTrigger } from '../RibbonTooltip';

interface RibbonSplitButtonProps {
  button: RibbonButton;
}

// ADR-419 §ribbon-hierarchy — last-used + default resolve against LEAF
// variants only (recurses into submenu headers' subVariants), so the top
// button always fires a real tool, never a submenu header.
function resolveActiveVariant(
  leaves: readonly RibbonCommand[],
  lastUsedId: string | undefined,
): RibbonCommand | undefined {
  if (lastUsedId) {
    const hit = leaves.find((v) => v.id === lastUsedId);
    if (hit) return hit;
  }
  return leaves[0];
}

const RibbonSplitButtonInner: React.FC<RibbonSplitButtonProps> = ({
  button,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const { onToolChange, onComingSoon, onAction, splitLastUsed, activeTool, getCommandRecommendation } = useRibbonCommand();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // ADR-521 — pure dropdown («Τύποι»): trigger opens the list, no top-action / chevron.
  const isDropdownOnly = button.type === 'dropdown';
  const variants = button.variants ?? [];
  const leafVariants = useMemo(() => flattenLeafVariants(variants), [variants]);
  const active = useMemo(
    () => resolveActiveVariant(leafVariants, splitLastUsed[button.command.id]),
    [leafVariants, splitLastUsed, button.command.id],
  );
  const isActive = useMemo(
    () => (isDropdownOnly ? open : isAnyVariantActive(variants, activeTool)),
    [isDropdownOnly, open, variants, activeTool],
  );

  const toggleDropdown = useCallback(() => setOpen((p) => !p), []);
  const closeDropdown = useCallback(() => setOpen(false), []);

  const handleTopClick = useCallback(() => {
    // Dropdown mode: the trigger opens the list (no last-used top action).
    if (isDropdownOnly) { toggleDropdown(); return; }
    if (!active) return;
    if (active.comingSoon) {
      onComingSoon(t(active.labelKey));
      return;
    }
    if (active.action) {
      onAction(active.action, active.actionData);
      return;
    }
    onToolChange(active.commandKey as ToolType);
  }, [isDropdownOnly, toggleDropdown, onToolChange, onComingSoon, onAction, active, t]);

  // Split mode needs a resolved active leaf to fire; dropdown mode does not.
  if (!isDropdownOnly && !active) return null;

  const isLarge = button.size === 'large';
  // ADR-461 Phase C4 — advisory de-emphasis on storey kinds where this tool's
  // discipline does not belong (counted storeys → recommended → no change).
  const recommended = getCommandRecommendation(button.command.commandKey);
  const baseWrapperClass = isLarge
    ? 'dxf-ribbon-btn-split dxf-ribbon-btn-split-large'
    : 'dxf-ribbon-btn-split dxf-ribbon-btn-split-small';
  const wrapperClass = recommended ? baseWrapperClass : `${baseWrapperClass} opacity-40`;

  // Top-button icon: split → the last-used variant's icon; dropdown → the button's
  // own (stable) icon. Tooltip: split → active variant label; dropdown → the
  // button's tooltip/label.
  const topIcon = isDropdownOnly ? button.command.icon : active?.icon;
  const topTooltip = isDropdownOnly
    ? t(button.command.tooltipKey ?? button.command.labelKey)
    : t(active!.labelKey);
  const topLabel = t(button.command.labelKey);

  return (
    <div
      ref={wrapperRef}
      className={wrapperClass}
      data-command-id={button.command.id}
      data-coming-soon={!isDropdownOnly && active?.comingSoon ? 'true' : undefined}
      data-active={isActive ? 'true' : undefined}
      data-storey-recommended={recommended ? undefined : 'false'}
    >
      <Tooltip>
      <TooltipTrigger asChild>
      <button
        type="button"
        className="dxf-ribbon-btn-split-top"
        onClick={handleTopClick}
        aria-haspopup={isDropdownOnly ? 'menu' : undefined}
        aria-expanded={isDropdownOnly ? open : undefined}
      >
        <span className="dxf-ribbon-btn-icon-wrap">
          <RibbonButtonIcon icon={topIcon} size={button.size} />
        </span>
        <span className={isLarge ? 'dxf-ribbon-btn-label' : 'dxf-ribbon-btn-label-inline'}>
          {topLabel}
          {isDropdownOnly && <span aria-hidden="true"> ▾</span>}
        </span>
      </button>
      </TooltipTrigger>
      <TooltipContent>{topTooltip}</TooltipContent>
      </Tooltip>
      {!isDropdownOnly && (
        <Tooltip>
        <TooltipTrigger asChild>
        <button
          type="button"
          className="dxf-ribbon-btn-split-arrow"
          onClick={toggleDropdown}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span aria-hidden="true">▾</span>
        </button>
        </TooltipTrigger>
        <TooltipContent>{t('ribbon.commands.dropdown.openVariants')}</TooltipContent>
        </Tooltip>
      )}
      {open && (
        <RibbonSplitDropdown
          parentCommandId={button.command.id}
          variants={variants}
          anchorRef={wrapperRef}
          onClose={closeDropdown}
        />
      )}
    </div>
  );
};

// ADR-040 perf: memo skips re-render when button config and context are stable.
export const RibbonSplitButton = React.memo(RibbonSplitButtonInner);
