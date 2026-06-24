'use client';

/**
 * ADR-521 — Pure dropdown ribbon button («Τύποι» column-type picker).
 *
 * Unlike `RibbonSplitButton` (top half = exec last-used + chevron = open list),
 * this is a SINGLE trigger: clicking ANYWHERE on the button opens the variant
 * dropdown — no direct top-action. Used για το «Τύποι» (column kind) picker στην
 * καρτέλα Δομικά, όπου ο χρήστης ΠΑΝΤΑ επιλέγει τύπο πριν τη σχεδίαση.
 *
 * SSoT: reuses `RibbonSplitDropdown` for the menu (portal + escape-bus +
 * outside-click + positioning) — μηδέν διπλό dropdown primitive. The variants
 * carry `action` keys, so selection routes through `onAction` (the column kind
 * quick-draw handler in `useRibbonCommands`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-521-column-type-ribbon-dropdown.md
 */

import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { RibbonButton } from '../../types/ribbon-types';
import { useRibbonCommand } from '../../context/RibbonCommandContext';
import { RibbonButtonIcon } from './RibbonButtonIcon';
import { RibbonSplitDropdown } from './RibbonSplitDropdown';
import { Tooltip, TooltipContent, TooltipTrigger } from '../RibbonTooltip';

interface RibbonDropdownButtonProps {
  button: RibbonButton;
}

const RibbonDropdownButtonInner: React.FC<RibbonDropdownButtonProps> = ({ button }) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const { getCommandRecommendation } = useRibbonCommand();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const variants = button.variants ?? [];
  const toggle = useCallback(() => setOpen((p) => !p), []);
  const close = useCallback(() => setOpen(false), []);

  const isLarge = button.size === 'large';
  const label = t(button.command.labelKey);
  // ADR-461 Phase C4 — advisory de-emphasis (counted storeys → recommended → no change).
  const recommended = getCommandRecommendation(button.command.commandKey);
  const baseWrapperClass = isLarge
    ? 'dxf-ribbon-btn-split dxf-ribbon-btn-split-large'
    : 'dxf-ribbon-btn-split dxf-ribbon-btn-split-small';
  const wrapperClass = recommended ? baseWrapperClass : `${baseWrapperClass} opacity-40`;

  return (
    <div
      ref={wrapperRef}
      className={wrapperClass}
      data-command-id={button.command.id}
      data-active={open ? 'true' : undefined}
      data-storey-recommended={recommended ? undefined : 'false'}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="dxf-ribbon-btn-split-top"
            onClick={toggle}
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <span className="dxf-ribbon-btn-icon-wrap">
              <RibbonButtonIcon icon={button.command.icon} size={button.size} />
            </span>
            {isLarge ? (
              <span className="dxf-ribbon-btn-label">
                {label}
                <span aria-hidden="true"> ▾</span>
              </span>
            ) : (
              <span className="dxf-ribbon-btn-label-inline">
                {label}
                <span aria-hidden="true"> ▾</span>
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>{t(button.command.tooltipKey ?? button.command.labelKey)}</TooltipContent>
      </Tooltip>
      {open && (
        <RibbonSplitDropdown
          parentCommandId={button.command.id}
          variants={variants}
          anchorRef={wrapperRef}
          onClose={close}
        />
      )}
    </div>
  );
};

// ADR-040 perf: memo skips re-render when button config and context are stable.
export const RibbonDropdownButton = React.memo(RibbonDropdownButtonInner);
