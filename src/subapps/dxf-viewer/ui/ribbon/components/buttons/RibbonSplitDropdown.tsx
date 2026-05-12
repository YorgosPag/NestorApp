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
import { useRibbonCommand } from '../../context/RibbonCommandContext';
import { RibbonButtonIcon } from './RibbonButtonIcon';

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
  const { onToolChange, setSplitLastUsed } = useRibbonCommand();
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
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleScroll = () => onClose();
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [anchorRef, onClose, applyPosition]);

  const handleSelect = useCallback(
    (variant: RibbonCommand) => {
      setSplitLastUsed(parentCommandId, variant.id);
      onToolChange(variant.commandKey as ToolType);
      onClose();
    },
    [parentCommandId, onToolChange, setSplitLastUsed, onClose],
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
        <li key={variant.id}>
          <button
            type="button"
            className="dxf-ribbon-split-dropdown-item"
            role="menuitem"
            onClick={() => handleSelect(variant)}
          >
            <RibbonButtonIcon icon={variant.icon} size="small" />
            <span className="dxf-ribbon-btn-label-inline">
              {t(variant.labelKey)}
            </span>
          </button>
        </li>
      ))}
    </menu>,
    document.body,
  );
};
