'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type {
  RibbonButton,
  RibbonPanelDef,
  RibbonRow,
} from '../types/ribbon-types';
import { RibbonLargeButton } from './buttons/RibbonLargeButton';
import { RibbonSmallButton } from './buttons/RibbonSmallButton';
import { RibbonSplitButton } from './buttons/RibbonSplitButton';
import { RibbonToggleButton } from './buttons/RibbonToggleButton';
import { RibbonCombobox } from './buttons/RibbonCombobox';
import { RibbonColorSwatchWidget } from './RibbonColorSwatchWidget';
// Ο χάρτης `widgetId → widget` ζει χωριστά: ήταν το 60% αυτού του αρχείου και μεγάλωνε με κάθε
// νέο widget, ενώ αυτό εδώ έχει μία ευθύνη — να ζωγραφίζει ένα panel (N.7.1).
import { renderRibbonWidget } from './ribbon-widget-registry';
import { useRibbonPanelVisibility } from '../context/useRibbonFieldSelectors';

interface RibbonPanelProps {
  panel: RibbonPanelDef;
  /** ADR-345 Fase 7 — whether this panel's flyout is pinned open. */
  isPinned?: boolean;
  /** ADR-345 Fase 7 — callback to toggle pin state. */
  onPinToggle?: (panelId: string) => void;
}

function renderButton(button: RibbonButton): React.ReactNode {
  const key = button.command.id;
  if (button.type === 'color-swatch') {
    return <RibbonColorSwatchWidget key={button.command.id} />;
  }
  if (button.type === 'widget') {
    return renderRibbonWidget(button.widgetId);
  }
  // ADR-345 split + ADR-521 pure dropdown («Τύποι») share ONE component — the
  // dropdown is just a split button whose trigger opens the list (no top-action).
  if (button.type === 'split' || button.type === 'dropdown') {
    return <RibbonSplitButton key={key} button={button} />;
  }
  if (button.type === 'toggle') {
    return <RibbonToggleButton key={key} command={button.command} size={button.size} />;
  }
  if (button.type === 'combobox') {
    return <RibbonCombobox key={key} command={button.command} />;
  }
  if (button.size === 'large') {
    return <RibbonLargeButton key={key} command={button.command} />;
  }
  return <RibbonSmallButton key={key} command={button.command} />;
}

function rowSize(row: RibbonRow): 'large' | 'small' | 'mixed' {
  if (row.buttons.length === 0) return 'large';
  const first = row.buttons[0].size;
  return row.buttons.every((b) => b.size === first) ? first : 'mixed';
}

export const RibbonPanel: React.FC<RibbonPanelProps> = ({
  panel,
  isPinned = false,
  onPinToggle,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  // ADR-547 Stage 4 — per-key visibility leaf subscription (moved out of RibbonBody
  // so a BIM edit re-renders only the affected panel, not the whole body). Panels
  // without a `visibilityKey` resolve to the default `true` slice (never changes).
  const isVisible = useRibbonPanelVisibility(panel.visibilityKey ?? '');
  const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);
  const containerRef = useRef<HTMLElement>(null);

  const normalRows = panel.rows.filter((r) => !r.isInFlyout && r.buttons.length > 0);
  const flyoutRows = panel.rows.filter((r) => r.isInFlyout && r.buttons.length > 0);
  const hasFlyout = flyoutRows.length > 0;
  const flyoutVisible = isPinned || isFlyoutOpen;

  const toggleFlyout = useCallback(() => {
    if (!isPinned) setIsFlyoutOpen((prev) => !prev);
  }, [isPinned]);

  const handlePinToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onPinToggle?.(panel.id);
      setIsFlyoutOpen(false);
    },
    [onPinToggle, panel.id],
  );

  // Close flyout on outside click when not pinned
  useEffect(() => {
    if (!isFlyoutOpen || isPinned) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFlyoutOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isFlyoutOpen, isPinned]);

  const hasContent = normalRows.length > 0;

  // ADR-547 Stage 4 — self-hide when the owning bridge marks this panel hidden.
  // Placed after all hooks so hook order stays stable.
  if (!isVisible) return null;

  return (
    <section
      ref={containerRef}
      className="dxf-ribbon-panel"
      data-panel-id={panel.id}
      data-flyout-open={flyoutVisible}
    >
      <div className="dxf-ribbon-panel-body" data-empty={!hasContent}>
        {hasContent
          ? normalRows.map((row, idx) => (
              <div
                key={idx}
                className="dxf-ribbon-panel-row"
                data-row-size={rowSize(row)}
              >
                {row.buttons.map(renderButton)}
              </div>
            ))
          : t('ribbon.panels.placeholder')}
      </div>

      {hasFlyout && (
        <button
          type="button"
          className="dxf-ribbon-flyout-trigger"
          aria-label={t('ribbon.flyout.expand')}
          aria-expanded={flyoutVisible}
          onClick={toggleFlyout}
        >
          <span className="dxf-ribbon-flyout-chevron" aria-hidden="true">
            {flyoutVisible ? '▲' : '▼'}
          </span>
        </button>
      )}

      {hasFlyout && flyoutVisible && (
        <div className="dxf-ribbon-flyout-rows" role="group">
          {flyoutRows.map((row, idx) => (
            <div
              key={idx}
              className="dxf-ribbon-panel-row"
              data-row-size={rowSize(row)}
            >
              {row.buttons.map(renderButton)}
            </div>
          ))}
          <button
            type="button"
            className="dxf-ribbon-flyout-pin"
            aria-label={t(isPinned ? 'ribbon.flyout.unpin' : 'ribbon.flyout.pin')}
            aria-pressed={isPinned}
            onClick={handlePinToggle}
          >
            📌
          </button>
        </div>
      )}
    </section>
  );
};
