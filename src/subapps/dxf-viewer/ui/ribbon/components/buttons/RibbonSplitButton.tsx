'use client';

/**
 * ADR-345 §4.3 — Split button. Click top half = exec last-used variant.
 * Click chevron = open dropdown of variants. Selecting a variant promotes
 * it to last-used (persisted via dxf-ribbon:splitLastUsed).
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
): RibbonCommand {
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

  const variants = button.variants ?? [];
  const leafVariants = useMemo(() => flattenLeafVariants(variants), [variants]);
  const active = useMemo(
    () => resolveActiveVariant(leafVariants, splitLastUsed[button.command.id]),
    [leafVariants, splitLastUsed, button.command.id],
  );
  const isActive = useMemo(
    () => isAnyVariantActive(variants, activeTool),
    [variants, activeTool],
  );

  const handleTopClick = useCallback(() => {
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
  }, [onToolChange, onComingSoon, onAction, active, t]);

  const toggleDropdown = useCallback(() => setOpen((p) => !p), []);
  const closeDropdown = useCallback(() => setOpen(false), []);

  if (!active) return null;

  const isLarge = button.size === 'large';
  // ADR-461 Phase C4 — advisory de-emphasis on storey kinds where this tool's
  // discipline does not belong (counted storeys → recommended → no change).
  const recommended = getCommandRecommendation(button.command.commandKey);
  const baseWrapperClass = isLarge
    ? 'dxf-ribbon-btn-split dxf-ribbon-btn-split-large'
    : 'dxf-ribbon-btn-split dxf-ribbon-btn-split-small';
  const wrapperClass = recommended ? baseWrapperClass : `${baseWrapperClass} opacity-40`;

  const label = t(active.labelKey);

  return (
    <div
      ref={wrapperRef}
      className={wrapperClass}
      data-command-id={button.command.id}
      data-coming-soon={active.comingSoon ? 'true' : undefined}
      data-active={isActive ? 'true' : undefined}
      data-storey-recommended={recommended ? undefined : 'false'}
    >
      <Tooltip>
      <TooltipTrigger asChild>
      <button
        type="button"
        className="dxf-ribbon-btn-split-top"
        onClick={handleTopClick}
      >
        <span className="dxf-ribbon-btn-icon-wrap">
          <RibbonButtonIcon icon={active.icon} size={button.size} />
        </span>
        {isLarge && (
          <span className="dxf-ribbon-btn-label">{t(button.command.labelKey)}</span>
        )}
        {!isLarge && (
          <span className="dxf-ribbon-btn-label-inline">{t(button.command.labelKey)}</span>
        )}
      </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
      </Tooltip>
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
