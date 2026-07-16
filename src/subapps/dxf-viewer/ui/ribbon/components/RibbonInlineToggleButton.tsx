'use client';

/**
 * ADR-599 — Shared inline ribbon-toggle button body (presentational atom).
 *
 * The single `<button>` skeleton behind every store-backed inline ribbon toggle
 * (`[icon Label]` chip in the View tab combobox rows). It owns ONLY the constant
 * shell — flex layout, secondary background, `dxf-ribbon` typography/spacing,
 * hover + colour-transition — and defers the three varying decisions to props:
 *   • `pressed`     → `aria-pressed` (a11y state)
 *   • `colorClass`  → the resolved semantic text colour (info / secondary / muted)
 *   • `icon`        → the already-resolved icon node (caller picks glyph + opacity)
 *
 * Two consumers: {@link RibbonToggleWidget} (single store flag) and the per-
 * discipline chips of `DisciplineVisibilityToggle`. Keeping the shell here is the
 * SSoT that lets those diverge only where they genuinely differ (colour ramp,
 * icon opacity, single-vs-multi layout) without cloning the button markup.
 */

import React from 'react';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';

interface RibbonInlineToggleButtonProps {
  /** Drives `aria-pressed` — the current on/active state of the toggle. */
  readonly pressed: boolean;
  /** Fired on click; the caller owns the actual state mutation. */
  readonly onClick: () => void;
  /** Full accessible label / tooltip text for the current state. */
  readonly ariaLabel: string;
  /** Already-resolved icon node (caller chooses the glyph + opacity per state). */
  readonly icon: React.ReactNode;
  /** Inner button text (the action or status label for the current state). */
  readonly label: string;
  /** Resolved semantic text-colour class for the current state. */
  readonly colorClass: string;
  /**
   * ADR-662 Φ4 — precondition unmet ⇒ big-player "greyed command". When true the
   * toggle renders `aria-disabled` (NOT native `disabled`, so a hover tooltip can
   * still explain why — mirrors {@link PointCloud3DManageButton}), guards its
   * click, and swaps the hover ramp for the SSoT disabled look (opacity +
   * not-allowed). Optional / default `false` → existing enabled behaviour intact
   * for the second consumer (`DisciplineVisibilityToggle`).
   */
  readonly disabled?: boolean;
}

export const RibbonInlineToggleButton: React.FC<RibbonInlineToggleButtonProps> = ({
  pressed,
  onClick,
  ariaLabel,
  icon,
  label,
  colorClass,
  disabled = false,
}) => {
  const colors = useSemanticColors();

  // Disabled ⇒ SSoT greyed look (opacity-50 + not-allowed, matching
  // `.dxf-ribbon-btn[aria-disabled]`); enabled ⇒ the normal hover ramp.
  const stateClass = disabled
    ? `${PANEL_LAYOUT.OPACITY['50']} ${PANEL_LAYOUT.CURSOR.NOT_ALLOWED}`
    : HOVER_BACKGROUND_EFFECTS.MUTED;

  return (
    <button
      type="button"
      onClick={() => { if (!disabled) onClick(); }}
      aria-pressed={pressed}
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel}
      className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${colors.bg.backgroundSecondary} ${colorClass} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${stateClass} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};
