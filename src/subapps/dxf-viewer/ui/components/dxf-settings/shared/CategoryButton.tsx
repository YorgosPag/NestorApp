// CategoryButton.tsx - Reusable category button component
// STATUS: ACTIVE - Phase 1 Step 1.5
// PURPOSE: Generic button για Specific settings categories

import React from 'react';

/**
 * CategoryButton - Reusable category button component
 *
 * Purpose:
 * - UI button για Specific settings categories (7 categories)
 * - Vertical list layout
 * - Icon + Label + Optional badge
 *
 * Features:
 * - Active state styling
 * - Hover effects
 * - Icon support
 * - Badge support (για notifications ή "Coming Soon")
 * - Accessibility (ARIA labels, keyboard navigation)
 *
 * @see docs/dxf-settings/COMPONENT_GUIDE.md#CategoryButton
 * @see docs/dxf-settings/ARCHITECTURE.md - Shared Components
 *
 * @example
 * ```tsx
 * <CategoryButton
 *   id="selection"
 *   label="Επιλογή"
 *   icon="🎯"
 *   isActive={true}
 *   onClick={() => console.log('Selection clicked')}
 * />
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export interface CategoryButtonProps {
  /**
   * Unique identifier για το category
   */
  id: string;

  /**
   * Display label (visible στον χρήστη)
   */
  label: string;

  /**
   * Optional icon (React element, emoji, ή icon class name)
   */
  icon?: React.ReactNode | string;

  /**
   * Active state (αν true, το button είναι highlighted)
   */
  isActive: boolean;

  /**
   * Click callback
   */
  onClick: () => void;

  /**
   * Disabled state (αν true, το button δεν είναι clickable)
   */
  disabled?: boolean;

  /**
   * Optional badge (π.χ. "New", "3", "Coming Soon")
   */
  badge?: string | number;

  /**
   * Optional CSS class
   */
  className?: string;

  /**
   * Optional tooltip (για additional info)
   */
  tooltip?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const CategoryButton: React.FC<CategoryButtonProps> = ({
  id,
  label,
  icon,
  isActive,
  onClick,
  disabled = false,
  badge,
  className = '',
  tooltip,
}) => {
  // ============================================================================
  // KEYBOARD NAVIGATION
  // ============================================================================

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!disabled) {
        onClick();
      }
    }
  };

  // ============================================================================
  // STYLES
  // ============================================================================

  const buttonClasses = [
    'category-button',
    isActive && 'category-button--active',
    disabled && 'category-button--disabled',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <button
      type="button"
      className={buttonClasses}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      aria-label={label}
      aria-pressed={isActive}
      title={tooltip}
      data-category-id={id}
    >
      {/* Icon Container */}
      {icon && (
        <span className="category-button__icon">
          {typeof icon === 'string' ? (
            // String icon (emoji ή class name)
            icon.length === 1 || icon.startsWith('emoji:') ? (
              <span className="category-button__emoji">{icon}</span>
            ) : (
              <i className={icon} />
            )
          ) : (
            // React element icon
            icon
          )}
        </span>
      )}

      {/* Label Container */}
      <span className="category-button__label">{label}</span>

      {/* Badge (αν υπάρχει) */}
      {badge && <span className="category-button__badge">{badge}</span>}
    </button>
  );
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default CategoryButton;

/**
 * CSS STYLES NOTES (για future implementation):
 *
 * .category-button {
 *   display: flex;
 *   align-items: center;
 *   gap: 0.75rem;
 *   padding: 0.75rem 1rem;
 *   width: 100%;
 *   background-color: transparent;
 *   border: 1px solid #e5e7eb;
 *   border-radius: 0.375rem;
 *   cursor: pointer;
 *   transition: all 0.2s;
 *   text-align: left;
 * }
 *
 * .category-button:hover:not(.category-button--disabled) {
 *   background-color: #f3f4f6;
 *   border-color: #3b82f6;
 * }
 *
 * .category-button--active {
 *   background-color: #3b82f6;
 *   color: white;
 *   border-color: #3b82f6;
 * }
 *
 * .category-button--disabled {
 *   opacity: 0.5;
 *   cursor: not-allowed;
 * }
 *
 * .category-button__icon {
 *   display: flex;
 *   align-items: center;
 *   justify-content: center;
 *   width: 1.5rem;
 *   height: 1.5rem;
 *   font-size: 1.25rem;
 * }
 *
 * .category-button__label {
 *   flex: 1;
 *   font-weight: 500;
 * }
 *
 * .category-button__badge {
 *   display: inline-block;
 *   padding: 0.125rem 0.5rem;
 *   background-color: #ef4444;
 *   color: white;
 *   border-radius: 9999px;
 *   font-size: 0.75rem;
 *   font-weight: 600;
 * }
 *
 * .category-button--active .category-button__badge {
 *   background-color: white;
 *   color: #3b82f6;
 * }
 */

/**
 * USAGE EXAMPLE (για Phase 3 implementation):
 *
 * ```tsx
 * import { CategoryButton } from '../shared/CategoryButton';
 * import { useCategoryNavigation } from '../hooks/useCategoryNavigation';
 *
 * function SpecificSettingsPanel() {
 *   const { activeTab, setActiveTab } = useCategoryNavigation('selection');
 *
 *   const categories = [
 *     { id: 'selection', label: 'Επιλογή', icon: '🎯' },
 *     { id: 'cursor', label: 'Κέρσορας', icon: '🖱️' },
 *     { id: 'layers', label: 'Layers', icon: '📚' },
 *     { id: 'entities', label: 'Entities', icon: '🔷' },
 *     { id: 'background', label: 'Φόντο', icon: '🎨' },
 *     { id: 'drawing', label: 'Χάραξη', icon: '✏️', badge: 'New' },
 *     { id: 'import', label: 'Εισαγωγή', icon: '📥', badge: 'Coming Soon', disabled: true },
 *   ];
 *
 *   return (
 *     <div className="specific-settings-panel">
 *       <div className="category-list">
 *         {categories.map((category) => (
 *           <CategoryButton
 *             key={category.id}
 *             id={category.id}
 *             label={category.label}
 *             icon={category.icon}
 *             isActive={activeTab === category.id}
 *             onClick={() => setActiveTab(category.id)}
 *             badge={category.badge}
 *             disabled={category.disabled}
 *           />
 *         ))}
 *       </div>
 *       <div className="category-content">
 *         {activeTab === 'selection' && <SelectionCategory />}
 *         {activeTab === 'cursor' && <CursorCategory />}
 *         ...
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 */
