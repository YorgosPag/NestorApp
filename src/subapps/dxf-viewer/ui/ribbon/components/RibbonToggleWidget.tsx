'use client';

/**
 * ADR-599 — Config-driven store-backed ribbon toggle (SSoT for the 12 single
 * inline toggles of the View tab).
 *
 * Renders the invariant `[<label> | <icon action>]` combobox row: a
 * `dxf-ribbon-combobox-row` with a constant label span + a
 * {@link RibbonInlineToggleButton}. Everything that varies between the toggles —
 * which store flag they read/write, their on/off icons, and their i18n keys —
 * arrives via a single {@link RibbonToggleConfig}, so a new toggle is a ~10-line
 * config object instead of a copy-pasted 55-line component.
 *
 * State convention (`value` = the "on / active / pressed" boolean):
 *   • icon    → `activeIcon` @ opacity-80 when on, else `inactiveIcon` @ opacity-60
 *   • colour  → semantic `info` when on, else `secondary`
 *   • label   → `activeLabelKey` (the "turn-off" action) when on, else `inactiveLabelKey`
 *   • tooltip → `activeTooltipKey` when on, else `inactiveTooltipKey`
 *
 * Visibility-style toggles (Show/Hide) model `value` as "visible", so the same
 * on=info / off=secondary ramp and the same active=turn-off-action mapping hold.
 * The genuinely divergent multi-chip `DisciplineVisibilityToggle` is NOT a
 * `RibbonToggleWidget` — it composes {@link RibbonInlineToggleButton} directly.
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { RibbonInlineToggleButton } from './RibbonInlineToggleButton';
import { Tooltip, TooltipContent, TooltipTrigger } from './RibbonTooltip';

export interface RibbonToggleConfig {
  /**
   * Reactive read of the current `value` (on/active) plus the toggle action.
   * Called as a hook by the widget, so it may subscribe to any store; it must be
   * invoked unconditionally exactly once per render (rules-of-hooks safe because
   * a config is a stable module constant per call-site).
   */
  readonly useToggleState: () => {
    readonly value: boolean;
    readonly toggle: () => void;
    /**
     * ADR-662 Φ4 — precondition unmet ⇒ the toggle is greyed (see
     * {@link RibbonInlineToggleButton.disabled}). Optional; a config that never
     * returns it stays permanently enabled (backward-compatible).
     */
    readonly disabled?: boolean;
    /** i18n key for the "why disabled" reason (aria-label + hover tooltip). */
    readonly disabledReasonKey?: string;
  };
  /** Constant row label key. */
  readonly labelKey: string;
  /** Icon shown when `value` is true (active). */
  readonly activeIcon: LucideIcon;
  /** Icon shown when `value` is false (inactive). */
  readonly inactiveIcon: LucideIcon;
  /** Inner button text key when active (typically the "turn-off" action). */
  readonly activeLabelKey: string;
  /** Inner button text key when inactive (typically the "turn-on" action). */
  readonly inactiveLabelKey: string;
  /** Accessible label / tooltip key when active. */
  readonly activeTooltipKey: string;
  /** Accessible label / tooltip key when inactive. */
  readonly inactiveTooltipKey: string;
}

interface RibbonToggleWidgetProps {
  readonly config: RibbonToggleConfig;
}

export const RibbonToggleWidget: React.FC<RibbonToggleWidgetProps> = ({ config }) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const { value, toggle, disabled, disabledReasonKey } = config.useToggleState();

  const ActiveIcon = config.activeIcon;
  const InactiveIcon = config.inactiveIcon;
  const icon = value ? (
    <ActiveIcon className="w-3 h-3 opacity-80" />
  ) : (
    <InactiveIcon className="w-3 h-3 opacity-60" />
  );

  // When disabled the "why" reason owns both the aria-label (screen readers) and
  // the hover tooltip (mirror of PointCloud3DManageButton). Otherwise the normal
  // active/inactive tooltip text applies.
  const reason = disabled && disabledReasonKey ? t(disabledReasonKey) : undefined;
  const button = (
    <RibbonInlineToggleButton
      pressed={value}
      onClick={toggle}
      disabled={disabled}
      ariaLabel={reason ?? (value ? t(config.activeTooltipKey) : t(config.inactiveTooltipKey))}
      icon={icon}
      label={value ? t(config.activeLabelKey) : t(config.inactiveLabelKey)}
      colorClass={value ? colors.text.info : colors.text.secondary}
    />
  );

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">{t(config.labelKey)}</span>
      {reason ? (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>{reason}</TooltipContent>
        </Tooltip>
      ) : (
        button
      )}
    </span>
  );
};
