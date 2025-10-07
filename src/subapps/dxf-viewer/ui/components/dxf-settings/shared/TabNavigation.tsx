// TabNavigation.tsx - Reusable tab navigation component
// STATUS: ACTIVE - Phase 1 Step 1.5
// PURPOSE: Generic tab navigation UI (χρησιμοποιείται σε multiple places)

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║  CROSS-REFERENCES: docs/dxf-settings/MIGRATION_CHECKLIST.md (STEP 1.5)    ║
 * ║  Used by: panels/DxfSettingsPanel, panels/GeneralSettingsPanel            ║
 * ║  Works with: hooks/useTabNavigation.ts                                     ║
 * ║  ADR: docs/dxf-settings/DECISION_LOG.md (ADR-004: Reusable TabNavigation) ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

import React from 'react';

/**
 * TabNavigation - Reusable tab navigation component
 *
 * Purpose:
 * - Generic UI για tab buttons
 * - Επαναχρησιμοποιείται για:
 *   1. Main tabs (General / Specific)
 *   2. General tabs (Lines / Text / Grips)
 *
 * Features:
 * - Active state styling
 * - Keyboard navigation support (Arrow keys)
 * - Accessibility (ARIA labels, roles)
 * - Responsive layout
 *
 * @see docs/dxf-settings/COMPONENT_GUIDE.md#TabNavigation
 * @see docs/dxf-settings/ARCHITECTURE.md - Shared Components
 *
 * @example
 * ```tsx
 * <TabNavigation
 *   tabs={[
 *     { id: 'lines', label: 'Lines' },
 *     { id: 'text', label: 'Text' },
 *     { id: 'grips', label: 'Grips' },
 *   ]}
 *   activeTab="lines"
 *   onTabChange={(tab) => console.log('Tab changed to:', tab)}
 * />
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export interface Tab<T extends string = string> {
  /**
   * Unique identifier για το tab
   */
  id: T;

  /**
   * Display label (visible στον χρήστη)
   */
  label: string;

  /**
   * Optional icon (React element ή icon class name)
   */
  icon?: React.ReactNode | string;

  /**
   * Disabled state (αν true, το tab δεν είναι clickable)
   */
  disabled?: boolean;

  /**
   * Optional badge (π.χ. "3" για notifications, "New" για καινούρια features)
   */
  badge?: string | number;
}

export interface TabNavigationProps<T extends string = string> {
  /**
   * Array of tabs
   */
  tabs: Tab<T>[];

  /**
   * Current active tab ID
   */
  activeTab: T;

  /**
   * Callback όταν αλλάζει το tab
   */
  onTabChange: (tabId: T) => void;

  /**
   * Optional CSS class
   */
  className?: string;

  /**
   * Orientation (horizontal ή vertical)
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical';

  /**
   * Size variant
   * @default 'medium'
   */
  size?: 'small' | 'medium' | 'large';
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TabNavigation<T extends string = string>({
  tabs,
  activeTab,
  onTabChange,
  className = '',
  orientation = 'horizontal',
  size = 'medium',
}: TabNavigationProps<T>) {
  // ============================================================================
  // KEYBOARD NAVIGATION
  // ============================================================================

  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    const isHorizontal = orientation === 'horizontal';
    const nextKey = isHorizontal ? 'ArrowRight' : 'ArrowDown';
    const prevKey = isHorizontal ? 'ArrowLeft' : 'ArrowUp';

    if (e.key === nextKey) {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % tabs.length;
      const nextTab = tabs[nextIndex];
      if (!nextTab.disabled) {
        onTabChange(nextTab.id);
      }
    } else if (e.key === prevKey) {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      const prevTab = tabs[prevIndex];
      if (!prevTab.disabled) {
        onTabChange(prevTab.id);
      }
    }
  };

  // ============================================================================
  // STYLES
  // ============================================================================

  const containerClasses = [
    'tab-navigation',
    `tab-navigation--${orientation}`,
    `tab-navigation--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div
      className={containerClasses}
      role="tablist"
      aria-orientation={orientation}
    >
      {tabs.map((tab, index) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            className={[
              'tab-button',
              isActive && 'tab-button--active',
              tab.disabled && 'tab-button--disabled',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => !tab.disabled && onTabChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            disabled={tab.disabled}
            tabIndex={isActive ? 0 : -1}
          >
            {/* Icon (αν υπάρχει) */}
            {tab.icon && (
              <span className="tab-button__icon">
                {typeof tab.icon === 'string' ? (
                  <i className={tab.icon} />
                ) : (
                  tab.icon
                )}
              </span>
            )}

            {/* Label */}
            <span className="tab-button__label">{tab.label}</span>

            {/* Badge (αν υπάρχει) */}
            {tab.badge && (
              <span className="tab-button__badge">{tab.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default TabNavigation;

/**
 * CSS STYLES NOTES (για future implementation):
 *
 * .tab-navigation {
 *   display: flex;
 *   gap: 0.25rem;
 * }
 *
 * .tab-navigation--horizontal {
 *   flex-direction: row;
 * }
 *
 * .tab-navigation--vertical {
 *   flex-direction: column;
 * }
 *
 * .tab-button {
 *   padding: 0.5rem 1rem;
 *   background-color: transparent;
 *   border: 1px solid #ccc;
 *   cursor: pointer;
 *   transition: all 0.2s;
 * }
 *
 * .tab-button--active {
 *   background-color: #3b82f6;
 *   color: white;
 *   border-color: #3b82f6;
 * }
 *
 * .tab-button--disabled {
 *   opacity: 0.5;
 *   cursor: not-allowed;
 * }
 *
 * .tab-button__badge {
 *   display: inline-block;
 *   padding: 0.125rem 0.5rem;
 *   background-color: red;
 *   color: white;
 *   border-radius: 9999px;
 *   font-size: 0.75rem;
 *   margin-left: 0.5rem;
 * }
 */
