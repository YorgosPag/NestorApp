'use client';

/**
 * ADR-345 §4.3 — Variant dropdown for split buttons.
 * Rendered via portal to escape ribbon body overflow clipping.
 * Closes on outside click / Esc; selecting an item promotes it
 * to last-used and fires onToolChange.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { RibbonCommand } from '../../types/ribbon-types';
import type { ToolType } from '../../../toolbar/types';
import { useRibbonDispatch } from '../../context/RibbonCommandContext';
import { RibbonButtonIcon } from './RibbonButtonIcon';
// ADR-364 — Escape Command Bus SSoT
import { useEscapeHandler, ESC_PRIORITY } from '../../../../systems/escape-bus';

interface RibbonSplitDropdownProps {
  parentCommandId: string;
  variants: readonly RibbonCommand[];
  anchorRef: React.RefObject<HTMLElement>;
  onClose: () => void;
}

interface DropdownPosition {
  top: number;
  left: number;
}

function computePosition(anchor: HTMLElement | null): DropdownPosition | null {
  if (!anchor) return null;
  const rect = anchor.getBoundingClientRect();
  return { top: rect.bottom + 2, left: rect.left };
}

export const RibbonSplitDropdown: React.FC<RibbonSplitDropdownProps> = ({
  parentCommandId,
  variants,
  anchorRef,
  onClose,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const { onToolChange, onComingSoon, onAction, setSplitLastUsed } = useRibbonDispatch();
  const rootRef = useRef<HTMLMenuElement>(null);
  const [ready, setReady] = useState(false);

  const applyPosition = useCallback(() => {
    const el = rootRef.current;
    const pos = computePosition(anchorRef.current);
    if (!el || !pos) return;
    el.style.setProperty('--dxf-dropdown-top', `${pos.top}px`);
    el.style.setProperty('--dxf-dropdown-left', `${pos.left}px`);
  }, [anchorRef]);

  useEffect(() => {
    setReady(true);
    applyPosition();
    const handleDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    // ADR-364: Escape moved to EscapeCommandBus (POPOVER_DROPDOWN priority).
    const handleScroll = () => onClose();
    document.addEventListener('mousedown', handleDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [anchorRef, onClose, applyPosition]);

  // ADR-364 — POPOVER_DROPDOWN priority slot. The component is rendered
  // conditionally by its parent, so registration only exists while the
  // dropdown is mounted (cleanup on unmount via the hook).
  useEscapeHandler({
    id: 'ribbon/split-dropdown',
    priority: ESC_PRIORITY.POPOVER_DROPDOWN,
    canHandle: () => true,
    handle: () => { onClose(); return true; },
  });

  const handleSelect = useCallback(
    (variant: RibbonCommand) => {
      if (variant.comingSoon) {
        // comingSoon variants never become last-used default — top button must stay functional
        onComingSoon(t(variant.labelKey));
      } else if (variant.action) {
        setSplitLastUsed(parentCommandId, variant.id);
        onAction(variant.action, variant.actionData);
      } else {
        setSplitLastUsed(parentCommandId, variant.id);
        onToolChange(variant.commandKey as ToolType);
      }
      onClose();
    },
    [parentCommandId, onToolChange, onComingSoon, onAction, setSplitLastUsed, onClose, t],
  );

  if (typeof document === 'undefined') return null;

  return createPortal(
    <menu
      ref={rootRef}
      className="dxf-ribbon-split-dropdown"
      role="menu"
      aria-label={t('ribbon.commands.dropdown.openVariants')}
      data-portal="true"
      data-ready={ready}
    >
      {variants.map((variant) => (
        <DropdownItem key={variant.id} variant={variant} t={t} onSelect={handleSelect} />
      ))}
    </menu>,
    document.body,
  );
};

// ADR-419 §ribbon-hierarchy — recursive Revit-style item. A submenu header
// (has `subVariants`) renders a hover/focus-expandable cascading list to the
// right (pure CSS reveal). A leaf dispatches via `onSelect`.
interface DropdownItemProps {
  variant: RibbonCommand;
  t: (key: string) => string;
  onSelect: (variant: RibbonCommand) => void;
}

const DropdownItem: React.FC<DropdownItemProps> = ({ variant, t, onSelect }) => {
  const subVariants = variant.subVariants;
  if (subVariants && subVariants.length > 0) {
    return (
      <li className="dxf-ribbon-submenu-parent">
        <button
          type="button"
          className="dxf-ribbon-split-dropdown-item dxf-ribbon-submenu-trigger"
          role="menuitem"
          aria-haspopup="menu"
        >
          <RibbonButtonIcon icon={variant.icon} size="small" />
          <span className="dxf-ribbon-btn-label-inline">{t(variant.labelKey)}</span>
          <span className="dxf-ribbon-submenu-caret" aria-hidden="true">▶</span>
        </button>
        <menu className="dxf-ribbon-split-dropdown dxf-ribbon-submenu" role="menu">
          {subVariants.map((sub) => (
            <DropdownItem key={sub.id} variant={sub} t={t} onSelect={onSelect} />
          ))}
        </menu>
      </li>
    );
  }
  return (
    <li>
      <button
        type="button"
        className="dxf-ribbon-split-dropdown-item"
        role="menuitem"
        onClick={() => onSelect(variant)}
        data-coming-soon={variant.comingSoon ? 'true' : undefined}
      >
        <RibbonButtonIcon icon={variant.icon} size="small" />
        <span className="dxf-ribbon-btn-label-inline">{t(variant.labelKey)}</span>
      </button>
    </li>
  );
};
