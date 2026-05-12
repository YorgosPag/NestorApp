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
import { RibbonButtonIcon } from './RibbonButtonIcon';
import { RibbonSplitDropdown } from './RibbonSplitDropdown';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface RibbonSplitButtonProps {
  button: RibbonButton;
}

function resolveActiveVariant(
  variants: readonly RibbonCommand[],
  lastUsedId: string | undefined,
): RibbonCommand {
  if (lastUsedId) {
    const hit = variants.find((v) => v.id === lastUsedId);
    if (hit) return hit;
  }
  return variants[0];
}

export const RibbonSplitButton: React.FC<RibbonSplitButtonProps> = ({
  button,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const { onToolChange, onComingSoon, splitLastUsed } = useRibbonCommand();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const variants = button.variants ?? [];
  const active = useMemo(
    () => resolveActiveVariant(variants, splitLastUsed[button.command.id]),
    [variants, splitLastUsed, button.command.id],
  );

  const handleTopClick = useCallback(() => {
    if (!active) return;
    if (active.comingSoon) {
      onComingSoon(t(active.labelKey));
      return;
    }
    onToolChange(active.commandKey as ToolType);
  }, [onToolChange, onComingSoon, active, t]);

  const toggleDropdown = useCallback(() => setOpen((p) => !p), []);
  const closeDropdown = useCallback(() => setOpen(false), []);

  if (!active) return null;

  const isLarge = button.size === 'large';
  const wrapperClass = isLarge
    ? 'dxf-ribbon-btn-split dxf-ribbon-btn-split-large'
    : 'dxf-ribbon-btn-split dxf-ribbon-btn-split-small';

  const label = t(active.labelKey);

  return (
    <div
      ref={wrapperRef}
      className={wrapperClass}
      data-command-id={button.command.id}
      data-coming-soon={active.comingSoon ? 'true' : undefined}
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
