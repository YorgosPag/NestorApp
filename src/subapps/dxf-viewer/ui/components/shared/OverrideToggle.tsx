/**
 * OVERRIDE TOGGLE SHARED COMPONENT
 * Unified component για όλα τα override checkbox patterns
 * ΒΗΜΑ 7 του FloatingPanelContainer refactoring
 */

import React from 'react';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// ✅ ENTERPRISE: Centralized Radix Checkbox - Single Source of Truth
import { Checkbox } from '@/components/ui/checkbox';
// 🏢 ENTERPRISE: Import centralized panel spacing (Single Source of Truth)
import { PANEL_LAYOUT } from '../../../config/panel-tokens';

/**
 * Props for the OverrideToggle component
 */
interface OverrideToggleProps {
  /** Current checked state of the toggle */
  checked: boolean;
  /** Callback fired when the toggle state changes */
  onChange: (checked: boolean) => void;
  /** Main label text for the toggle */
  label: string;
  /** Optional description text shown below the label */
  description?: string;
  /** Additional CSS classes to apply to the container */
  className?: string;
  /** Whether the toggle is disabled */
  disabled?: boolean;
  /** Whether to show the status badge */
  showStatusBadge?: boolean;
  /** Custom text for the status badge */
  statusText?: string;
}

/**
 * Unified Override Toggle Component
 *
 * Reusable checkbox component that replaces all duplicate override patterns
 * across the DXF viewer settings. Provides consistent styling and behavior
 * for enable/disable functionality with optional status badges.
 *
 * @component
 * @example
 * ```tsx
 * <OverrideToggle
 *   checked={isEnabled}
 *   onChange={setIsEnabled}
 *   label="Enable Custom Settings"
 *   description="Override default behavior"
 *   showStatusBadge={true}
 * />
 * ```
 *
 * Performance optimizations:
 * - React.memo prevents unnecessary re-renders
 * - useCallback optimizes event handlers
 *
 * @since ΒΗΜΑ 7 του FloatingPanelContainer refactoring
 */
export const OverrideToggle = React.memo<OverrideToggleProps>(function OverrideToggle({
  checked,
  onChange,
  label,
  description,
  className = '',
  disabled = false,
  showStatusBadge = false,
  statusText
}) {
  const { getStatusBorder, quick } = useBorderTokens();
  const colors = useSemanticColors();

  // ✅ ENTERPRISE: Handler για Radix Checkbox onCheckedChange
  const handleCheckedChange = React.useCallback((checkedState: boolean | 'indeterminate') => {
    onChange(checkedState === true);
  }, [onChange]);

  // 🏢 ENTERPRISE: Using PANEL_LAYOUT for consistent spacing - ZERO HARDCODED VALUES
  return (
    <div className={`${PANEL_LAYOUT.SPACING.MD} ${colors.bg.secondary} ${PANEL_LAYOUT.CONTAINER.BORDER_RADIUS} ${className}`}>
      <label className={`flex items-start ${PANEL_LAYOUT.GAP.SM} cursor-pointer`}>
        {/* ✅ ENTERPRISE: Centralized Radix Checkbox - Single Source of Truth */}
        <Checkbox
          checked={checked}
          onCheckedChange={handleCheckedChange}
          disabled={disabled}
          className={PANEL_LAYOUT.MARGIN.LEFT_HALF}
        />
        <div className="flex flex-col flex-1">
          <span className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE} ${colors.text.muted} font-medium`}>
            {label}
          </span>
          {description && (
            <span className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>
              {description}
            </span>
          )}
          {/* ✅ ENTERPRISE: Status badge moved to bottom row - ALL via PANEL_LAYOUT tokens */}
          {showStatusBadge && (
            <span className={`${PANEL_LAYOUT.MARGIN.TOP_SM} ${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.ALERT.BORDER_RADIUS} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} font-medium inline-block w-fit ${
              checked
                ? `${colors.bg.warningSubtle} ${colors.text.warning} ${quick.warning}`
                : `${colors.bg.hover} ${colors.text.muted} ${getStatusBorder('muted')}`
            }`}>
              {statusText || (checked ? 'Ενεργό' : 'Ανενεργό')}
            </span>
          )}
        </div>
      </label>
    </div>
  );
});