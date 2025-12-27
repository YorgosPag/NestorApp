/**
 * OVERRIDE TOGGLE SHARED COMPONENT
 * Unified component για όλα τα override checkbox patterns
 * ΒΗΜΑ 7 του FloatingPanelContainer refactoring
 */

import React from 'react';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

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

  const handleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  }, [onChange]);

  return (
    <div className={`flex items-center justify-between p-3 ${colors.bg.secondary} rounded-lg ${className}`}>
      <div className="flex-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={handleChange}
            disabled={disabled}
            className={`rounded ${getStatusBorder('secondary')} text-blue-600 focus:ring-blue-500 focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed`}
          />
          <div className="flex flex-col">
            <span className="text-sm ${colors.text.muted} font-medium">
              {label}
            </span>
            {description && (
              <span className="text-xs ${colors.text.muted} mt-1">
                {description}
              </span>
            )}
          </div>
        </label>
      </div>

      {showStatusBadge && (
        <div className="ml-3">
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            checked
              ? `bg-orange-900/50 text-orange-300 ${quick.warning}`
              : `${colors.bg.hover} ${colors.text.muted} ${getStatusBorder('secondary')}`
          }`}>
            {statusText || (checked ? 'Ενεργό' : 'Ανενεργό')}
          </span>
        </div>
      )}
    </div>
  );
});