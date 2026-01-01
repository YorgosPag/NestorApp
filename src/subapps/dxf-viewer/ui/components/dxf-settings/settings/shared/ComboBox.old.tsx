/**
 * 🏢 ENTERPRISE COMBOBOX COMPONENT
 *
 * @description
 * Centralized, reusable combo box (dropdown) component following DRY principles.
 * Replaces 240+ lines of duplicate code across LineSettings, TextSettings, etc.
 *
 * @features
 * - ✅ Generic Type Support: ComboBox<T> για οποιονδήποτε τύπο
 * - ✅ Simple & Grouped Options: Απλά options ή grouped με categories
 * - ✅ Keyboard Navigation: Arrow keys, Enter, Escape
 * - ✅ Consistent Styling: Ίδιο look σε όλα τα dropdowns
 * - ✅ Selected Indicator: Checkmark για το επιλεγμένο item
 * - ✅ Optional Description: Για template-style options
 * - ✅ Customizable: className props για flexibility
 * - ✅ Enterprise z-index: 9999 + position: absolute (consistent)
 * - ✅ Overlay Support: Works with AccordionSection overflow-visible
 *
 * @architecture
 * ```
 * ComboBox<T>
 *   ├── State: isOpen, highlightedIndex
 *   ├── Button: Display value + chevron icon
 *   ├── Dropdown: Absolute positioned, z-index: 9999
 *   └── Options: Simple OR Grouped (categories)
 * ```
 *
 * @usage
 * ```tsx
 * // Simple options
 * <ComboBox
 *   value={settings.lineType}
 *   options={[
 *     { value: 'solid', label: 'Συμπαγής' },
 *     { value: 'dashed', label: 'Διακεκομμένη' }
 *   ]}
 *   onChange={(value) => updateSettings({ lineType: value })}
 *   placeholder="Επιλέξτε τύπο..."
 * />
 *
 * // Grouped options (with categories)
 * <ComboBox
 *   value={activeTemplate}
 *   groupedOptions={[
 *     {
 *       category: 'Engineering',
 *       options: [
 *         { value: 'center', label: 'Center Line', description: '...' }
 *       ]
 *     }
 *   ]}
 *   onChange={handleTemplateSelect}
 *   placeholder="Επιλέξτε πρότυπο..."
 * />
 * ```
 *
 * @benefits
 * - 🎯 DRY: 1 implementation αντί για 10+ duplicates
 * - 🏗️ Maintainability: Αλλαγή σε 1 σημείο → όλα ενημερώνονται
 * - ✅ Consistency: Ίδιο styling, behavior, z-index παντού
 * - 🧪 Testability: Test 1 component αντί για 10+
 * - 🔄 Reusability: Χρήση σε LineSettings, TextSettings, GripSettings, κλπ.
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI)
 * @since 2025-10-07
 * @version 1.0.0
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useIconSizes } from '../../../../../../../hooks/useIconSizes';
import { useBorderTokens } from '../../../../../../../hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { layoutUtilities } from '@/styles/design-tokens';

// ===== TYPES =====

export interface ComboBoxOption<T> {
  value: T;
  label: string;
  description?: string; // Optional για template-style dropdowns
}

export interface ComboBoxGroupedOptions<T> {
  category: string;
  categoryLabel?: string; // Optional custom label (default: category)
  options: ComboBoxOption<T>[];
}

export interface ComboBoxProps<T> {
  // Required
  value: T;
  onChange: (value: T) => void;

  // Options (either simple OR grouped)
  options?: ComboBoxOption<T>[]; // Simple options
  groupedOptions?: ComboBoxGroupedOptions<T>[]; // Grouped options (με categories)

  // Optional
  placeholder?: string;
  label?: string; // Label πάνω από το combo box
  className?: string; // Custom className για το wrapper div
  buttonClassName?: string; // Custom className για το button
  disabled?: boolean;

  // Display
  getDisplayValue?: (value: T) => string; // Custom display για το button
  showCheckmark?: boolean; // Show checkmark for selected item (default: true)
  maxHeight?: string; // Max height για το dropdown (default: '24rem')
}

// ===== CHEVRON ICON =====

const ChevronDownIcon = ({ className, isOpen }: { className?: string; isOpen: boolean }) => (
  <svg
    className={`${className} transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

// ===== CHECKMARK ICON =====

const CheckmarkIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

// ===== MAIN COMPONENT =====

export function ComboBox<T>({
  value,
  onChange,
  options,
  groupedOptions,
  placeholder = 'Επιλέξτε...',
  label,
  className = '',
  buttonClassName = '',
  disabled = false,
  getDisplayValue,
  showCheckmark = true,
  maxHeight = '24rem' // 96 = 24rem
}: ComboBoxProps<T>) {
  const iconSizes = useIconSizes();
  const { getFocusBorder, getStatusBorder, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();

  // ===== STATE =====

  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ===== FLATTEN OPTIONS (για keyboard navigation) =====

  const flatOptions: ComboBoxOption<T>[] = options ||
    (groupedOptions?.flatMap(group => group.options) || []);

  // ===== DISPLAY VALUE =====

  const displayValue = getDisplayValue
    ? getDisplayValue(value)
    : flatOptions.find(opt => opt.value === value)?.label || placeholder;

  // ===== HANDLERS =====

  const handleSelect = (newValue: T) => {
    onChange(newValue);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (isOpen && highlightedIndex >= 0 && highlightedIndex < flatOptions.length) {
          handleSelect(flatOptions[highlightedIndex].value);
        } else {
          setIsOpen(!isOpen);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setHighlightedIndex(0);
        } else {
          setHighlightedIndex(prev =>
            prev < flatOptions.length - 1 ? prev + 1 : prev
          );
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev);
        }
        break;
    }
  };

  // ===== CLOSE ON OUTSIDE CLICK =====

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // ===== RENDER OPTION =====

  const renderOption = (option: ComboBoxOption<T>, index: number) => {
    const isHighlighted = highlightedIndex === index;
    const isSelected = option.value === value;

    return (
      <button
        key={String(option.value)}
        onClick={() => handleSelect(option.value)}
        className={`w-full px-3 py-2 text-left text-sm ${getDirectionalBorder('muted', 'bottom')} last:border-none transition-colors flex items-start justify-between ${
          isHighlighted
            ? `${colors.bg.info} ${colors.text.inverted}`
            : `${colors.text.primary} ${HOVER_BACKGROUND_EFFECTS.GRAY}`
        }`}
      >
        <div className="flex-1">
          <div className="font-medium">{option.label}</div>
          {option.description && (
            <div className={`text-xs ${isHighlighted ? colors.text.mutedInverted : colors.text.muted}`}>
              {option.description}
            </div>
          )}
        </div>
        {showCheckmark && isSelected && (
          <CheckmarkIcon className={`${iconSizes.md} ${colors.text.success} flex-shrink-0 ml-2`} />
        )}
      </button>
    );
  };

  // ===== RENDER =====

  return (
    <div className={`space-y-2 ${className}`} ref={dropdownRef}>
      {/* Label (optional) */}
      {label && (
        <label className={`block text-sm font-medium ${colors.text.secondary}`}>{label}</label>
      )}

      {/* Button */}
      <div className="relative">
        <button
          onClick={() => {
            if (!disabled) {
              setIsOpen(!isOpen);
              setHighlightedIndex(-1);
            }
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={`w-full px-3 py-2 pr-8 ${colors.bg.hover} ${getStatusBorder('default')} rounded-md ${colors.text.primary} text-left ${HOVER_BACKGROUND_EFFECTS.GRAY} focus:ring-2 ${colors.border.focus} ${getFocusBorder('input')} ${
            disabled ? 'opacity-disabled cursor-not-allowed' : ''
          } ${buttonClassName}`}
        >
          {displayValue}
        </button>

        {/* Chevron Icon */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <ChevronDownIcon className={`${iconSizes.sm} ${colors.text.muted}`} isOpen={isOpen} />
        </div>

        {/* Dropdown Content */}
        {isOpen && (
          <div
            data-dropdown-content
            className={`absolute top-full left-0 right-0 mt-1 ${colors.bg.elevated} rounded-md shadow-2xl overflow-y-auto border ${colors.border.muted} ${layoutUtilities.zIndex.dropdown} max-h-dropdown`}
          >
            {/* Simple Options */}
            {options && options.map((option, index) => renderOption(option, index))}

            {/* Grouped Options */}
            {groupedOptions && (() => {
              let globalIndex = 0;
              return groupedOptions.map(group => {
                const groupStartIndex = globalIndex;
                const groupOptions = group.options.map((option, localIndex) => {
                  const optionIndex = groupStartIndex + localIndex;
                  globalIndex = optionIndex + 1;
                  return renderOption(option, optionIndex);
                });

                return (
                  <div key={group.category} className={`${getDirectionalBorder('default', 'bottom')} last:border-none`}>
                    {/* Category Header */}
                    <div className={`px-3 py-2 text-xs font-medium ${colors.text.muted} ${colors.bg.primary}`}>
                      {group.categoryLabel || group.category}
                    </div>
                    {/* Category Options */}
                    {groupOptions}
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
