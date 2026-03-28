/**
 * ============================================================================
 * 🎯 ENTERPRISE DROPDOWN TOKENS HOOK — SSOT FOR ALL DROPDOWN DIMENSIONS
 * ============================================================================
 *
 * Single source of truth for dropdown/select/combobox/popover styling tokens.
 * Follows the same pattern as useIconSizes() and useBorderTokens().
 *
 * Centralizes: trigger heights, item padding, content dimensions, shadows,
 * z-index, separator styles, popover defaults, combobox specifics.
 *
 * Usage:
 * ```tsx
 * function MySelect() {
 *   const dropdown = useDropdownTokens();
 *
 *   return (
 *     <SelectTrigger className={dropdown.trigger.md}>  // h-9 px-3 py-2 text-sm
 *     <SelectContent className={dropdown.content.maxHeight}>
 *     <SelectItem className={dropdown.item.indented}>
 *   );
 * }
 * ```
 *
 * @see ADR-001 Select/Dropdown Component
 * @see src/styles/design-tokens.ts — componentSizes.dropdown
 * ============================================================================
 */

import { useMemo } from 'react';
import { componentSizes } from '@/styles/design-tokens';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Trigger size variants */
type TriggerSize = 'sm' | 'md' | 'lg';

/** Item padding variants */
type ItemPadding = 'standard' | 'indented' | 'combobox';

/** Token structure returned by useDropdownTokens() */
export interface DropdownTokens {
  // === TRIGGER ===
  readonly trigger: {
    /** Compact: h-8 px-3 py-1.5 text-xs — inline/small forms */
    readonly sm: string;
    /** Standard: h-9 px-3 py-2 text-sm — most common */
    readonly md: string;
    /** Default: h-10 px-3 py-2 text-sm — spacious forms */
    readonly lg: string;
  };

  // === CONTENT CONTAINER ===
  readonly content: {
    /** Content inner padding: p-1 */
    readonly padding: string;
    /** Default max height: max-h-96 (384px) */
    readonly maxHeight: string;
    /** Compact max height: max-h-80 (320px) */
    readonly maxHeightCompact: string;
    /** Combobox max height: max-h-60 (240px) */
    readonly maxHeightCombobox: string;
    /** Minimum content width: min-w-[8rem] (128px) */
    readonly minWidth: string;
    /** Standard shadow: shadow-md */
    readonly shadow: string;
    /** Elevated shadow (sub-menus): shadow-lg */
    readonly shadowElevated: string;
    /** Radix sideOffset prop (px): 4 */
    readonly sideOffset: number;
    /** Standard z-index: z-50 */
    readonly zIndex: string;
    /** Elevated z-index (above FloatingPanel): z-[2000] */
    readonly zIndexElevated: string;
  };

  // === ITEM ===
  readonly item: {
    /** Standard item padding: px-2 py-1.5 */
    readonly standard: string;
    /** Indented item (with left icon): py-1.5 pl-8 pr-2 */
    readonly indented: string;
    /** Combobox item (wider): px-3 py-1.5 */
    readonly combobox: string;
    /** Icon-to-text gap: gap-2 */
    readonly gap: string;
    /** Primary font size: text-sm */
    readonly fontSize: string;
    /** Secondary font size: text-xs */
    readonly fontSizeSecondary: string;
    /** Label weight: font-semibold */
    readonly fontWeightLabel: string;
    /** Option weight: font-medium */
    readonly fontWeightOption: string;
  };

  // === INDICATOR ===
  readonly indicator: {
    /** Checkbox/radio icon container: h-3.5 w-3.5 */
    readonly container: string;
    /** Indicator position: absolute left-2 flex items-center justify-center */
    readonly position: string;
  };

  // === SEPARATOR ===
  readonly separator: {
    /** Horizontal margins: -mx-1 my-1 */
    readonly margin: string;
    /** Height: h-px */
    readonly height: string;
  };

  /** Scroll button padding: py-1 */
  readonly scrollButton: string;

  /** Shortcut text styling: ml-auto text-xs tracking-widest opacity-60 */
  readonly shortcut: string;

  // === POPOVER ===
  readonly popover: {
    /** Popover padding: p-4 */
    readonly padding: string;
    /** Default width: w-72 (288px) */
    readonly width: string;
  };

  // === COMBOBOX-SPECIFIC ===
  readonly combobox: {
    /** Input right padding for buttons: pr-16 */
    readonly inputPaddingRight: string;
    /** List wrapper padding: py-1 */
    readonly listPadding: string;
    /** Add-new section border: border-t p-1 */
    readonly addNewSection: string;
    /** Add-new input sizing: h-8 text-sm flex-1 */
    readonly addNewInput: string;
    /** Add-new button sizing: h-8 px-2 text-sm */
    readonly addNewButton: string;
    /** Add-new row layout: gap-2 px-2 py-1 */
    readonly addNewRow: string;
    /** Empty state padding: p-3 text-sm */
    readonly emptyState: string;
    /** Loading state padding: py-4 */
    readonly loadingState: string;
  };

  // === CONTACT DROPDOWN (domain-specific) ===
  readonly contact: {
    readonly contentMin: string;
    readonly contentMax: string;
    readonly resultsMaxHeight: string;
    readonly searchArea: string;
    readonly searchIconPosition: string;
    readonly searchInputIndent: string;
    readonly contactItem: string;
    readonly emptyState: string;
    readonly createButton: string;
    readonly summaryFooter: string;
  };

  // === UTILITY METHODS ===
  /** Get trigger size class by variant name */
  readonly getTriggerSize: (size: TriggerSize) => string;
  /** Get item padding class by variant name */
  readonly getItemPadding: (variant: ItemPadding) => string;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Enterprise Dropdown Tokens Hook
 *
 * Provides type-safe access to centralized dropdown/select/combobox tokens.
 * All values come from `componentSizes.dropdown` in design-tokens.ts.
 *
 * @returns {DropdownTokens} Complete dropdown token set with utility methods
 */
export function useDropdownTokens(): DropdownTokens {
  return useMemo(() => {
    const tokens = componentSizes.dropdown;

    return {
      trigger: tokens.trigger,
      content: tokens.content,
      item: tokens.item,
      indicator: tokens.indicator,
      separator: tokens.separator,
      scrollButton: tokens.scrollButton,
      shortcut: tokens.shortcut,
      popover: tokens.popover,
      combobox: tokens.combobox,
      contact: tokens.contact,

      getTriggerSize: (size: TriggerSize) => tokens.trigger[size],
      getItemPadding: (variant: ItemPadding) => tokens.item[variant],
    } as const;
  }, []); // componentSizes is a static constant — no deps needed
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export default useDropdownTokens;

/** Alias for shorter imports */
export { useDropdownTokens as useDropdown };
