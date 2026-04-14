import type { CSSProperties } from 'react';
import {
  colors,
  typography,
  spacing,
  shadows,
  borderRadius,
  animation,
  layoutUtilities
} from '../../../../../styles/design-tokens';
import { GEO_COLORS } from '../../../config/color-config';
import { GEO_CANVAS_ZINDEX, GEO_CANVAS_DIMENSIONS } from '../../../config';

// 🎯 ENTERPRISE TYPE DEFINITIONS
type StyleObject = CSSProperties & Record<string, CSSProperties | string | number>;

interface SearchInputStylesType {
  readonly container: StyleObject;
  readonly input: StyleObject;
  readonly suggestionsContainer: StyleObject;
  readonly suggestion: StyleObject;
  readonly noSuggestions: StyleObject;
  readonly icon: StyleObject;
}

interface SearchFilterStylesType {
  readonly container: StyleObject;
  readonly label: StyleObject;
  readonly input: StyleObject;
  readonly select: StyleObject;
  readonly checkbox: StyleObject;
  readonly rangeContainer: StyleObject;
  readonly rangeInput: StyleObject;
  readonly rangeLabel: StyleObject;
  readonly multiselectLabel: StyleObject;
  readonly header: StyleObject;
  readonly headerTitle: StyleObject;
  readonly clearButton: StyleObject;
  readonly filtersGrid: StyleObject;
}

interface SearchResultsStylesType {
  readonly container: StyleObject;
  readonly item: StyleObject;
  readonly itemHover: StyleObject;
  readonly itemTitle: StyleObject;
  readonly itemDescription: StyleObject;
  readonly itemMeta: StyleObject;
  readonly itemCategory: StyleObject;
  readonly itemTags: StyleObject;
  readonly tag: StyleObject;
}

interface SearchSystemStylesType {
  readonly searchInput: SearchInputStylesType;
  readonly filters: SearchFilterStylesType;
  readonly results: SearchResultsStylesType;
  readonly layout: {
    readonly main: StyleObject;
    readonly filtersSection: StyleObject;
    readonly resultsSection: StyleObject;
    readonly loadingState: StyleObject;
    readonly emptyState: StyleObject;
    readonly activeFiltersContainer: StyleObject;
    readonly activeFilterBadge: StyleObject;
    readonly activeFilterCloseButton: StyleObject;
    readonly resultCount: StyleObject;
    readonly searchInputSection: StyleObject;
  };
}

// 🔍 SEARCH INPUT STYLES - ENTERPRISE SEARCH PATTERNS
/**
 * 🎯 SEARCH INPUT: Professional search interface styling
 * Replaces 8+ inline style violations στο SearchInput component
 */
const searchInputStyles: SearchInputStylesType = {
  container: {
    position: 'relative' as const,
    width: '100%',
    marginBottom: spacing.md
  } as const,

  input: {
    ...layoutUtilities.cssVars.inputBase,
    width: '100%',
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: typography.fontSize.base,
    borderRadius: borderRadius.md,
    transition: `border-color ${animation.duration.fast}`,
    '&:focus': {
      outline: 'none',
      borderColor: colors.primary[500],
      boxShadow: `0 0 0 2px ${colors.primary[500]}20`
    }
  } as const,

  suggestionsContainer: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'hsl(var(--background))',
    border: `1px solid ${colors.border.primary}`,
    borderRadius: borderRadius.md,
    boxShadow: shadows.md,
    maxHeight: GEO_CANVAS_DIMENSIONS.SEARCH_RESULTS_MAX_HEIGHT,
    overflowY: 'auto' as const,
    zIndex: GEO_CANVAS_ZINDEX.SEARCH_RESULTS
  } as const,

  suggestion: {
    padding: `${spacing.sm} ${spacing.md}`,
    cursor: 'pointer' as const,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    transition: `background-color ${animation.duration.fast}`,
    '&:hover': {
      backgroundColor: colors.background.hover
    },
    '&:last-child': {
      borderBottom: 'none'
    }
  } as const,

  noSuggestions: {
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontStyle: 'italic' as const,
    textAlign: 'center' as const
  } as const,

  // 🎯 NEW: Search icon container styling
  icon: {
    ...layoutUtilities.cssVars.absoluteCenterY,
    right: spacing.sm,
    color: colors.text.tertiary,
    pointerEvents: 'none' as const
  } as const
} as const;

// 🎛️ SEARCH FILTERS STYLES - ENTERPRISE FORM PATTERNS
/**
 * 🎯 SEARCH FILTERS: Professional filter interface styling
 * Replaces 15+ inline style violations στα Filter components
 */
const searchFiltersStyles: SearchFilterStylesType = {
  container: {
    marginBottom: spacing.md
  } as const,

  label: {
    display: 'block' as const,
    marginBottom: spacing.xs,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary
  } as const,

  input: {
    ...layoutUtilities.cssVars.inputBase,
    width: '100%',
    padding: `${spacing.xs} ${spacing.sm}`,
    fontSize: typography.fontSize.sm
  } as const,

  select: {
    ...layoutUtilities.cssVars.inputBase,
    width: '100%',
    padding: `${spacing.xs} ${spacing.sm}`,
    fontSize: typography.fontSize.sm,
    cursor: 'pointer' as const
  } as const,

  checkbox: {
    marginRight: spacing.xs,
    cursor: 'pointer' as const
  } as const,

  rangeContainer: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: spacing.sm
  } as const,

  rangeInput: {
    ...layoutUtilities.cssVars.inputBase,
    width: GEO_CANVAS_DIMENSIONS.SEARCH_BADGE_WIDTH,
    padding: `${spacing.xs} ${spacing.sm}`,
    fontSize: typography.fontSize.sm,
    textAlign: 'center' as const
  } as const,

  rangeLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary
  } as const,

  // 🎯 NEW: Multiselect label styling
  multiselectLabel: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: spacing.xs,
    fontSize: typography.fontSize.xs,
    color: colors.text.primary,
    cursor: 'pointer' as const
  } as const,

  // 🎯 NEW: Filters header styling
  header: {
    display: 'flex' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: spacing.sm
  } as const,

  headerTitle: {
    margin: 0,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary
  } as const,

  clearButton: {
    padding: `${spacing.xs} ${spacing.sm}`,
    border: `1px solid ${colors.border.primary}`,
    borderRadius: borderRadius.sm,
    backgroundColor: 'hsl(var(--background))',
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    cursor: 'pointer' as const,
    transition: `all ${animation.duration.fast}`,
    '&:hover': {
      backgroundColor: colors.background.hover
    }
  } as const,

  filtersGrid: {
    display: 'grid' as const,
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: spacing.md
  } as const
} as const;

// 📋 SEARCH RESULTS STYLES - ENTERPRISE LIST PATTERNS
/**
 * 🎯 SEARCH RESULTS: Professional search results styling
 * Replaces 10+ inline style violations στα SearchResult components
 */
const searchResultsStyles: SearchResultsStylesType = {
  container: {
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.border.secondary}`,
    overflow: 'hidden' as const
  } as const,

  item: {
    padding: spacing.md,
    borderBottom: `1px solid ${colors.border.secondary}`,
    cursor: 'pointer' as const,
    transition: `background-color ${animation.duration.fast}`,
    '&:last-child': {
      borderBottom: 'none'
    }
  } as const,

  itemHover: {
    backgroundColor: colors.background.hover
  } as const,

  itemTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs
  } as const,

  itemDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: typography.lineHeight.relaxed,
    marginBottom: spacing.xs
  } as const,

  itemMeta: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: spacing.sm
  } as const,

  // 🎯 NEW: Category styling με uppercase transformation
  itemCategory: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px'
  } as const,

  // 🎯 NEW: Tags container styling
  itemTags: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    flexWrap: 'wrap' as const
  } as const,

  // 🎯 NEW: Individual tag styling
  tag: {
    padding: `${spacing.xs} ${spacing.sm}`,
    backgroundColor: colors.background.secondary,
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    borderRadius: borderRadius.sm,
    border: `1px solid ${colors.border.primary}`
  } as const
} as const;

// 🏗️ LAYOUT STYLES - ENTERPRISE SEARCH LAYOUT
/**
 * 🎯 LAYOUT: Search system container styling
 * Replaces 5+ inline style violations στο main SearchSystem component
 */
const searchLayoutStyles = {
  main: {
    width: '100%',
    padding: spacing.lg,
    backgroundColor: 'hsl(var(--background))'
  } as const,

  filtersSection: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.border.secondary}`
  } as const,

  resultsSection: {
    flex: 1,
    minHeight: '400px'
  } as const,

  loadingState: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: spacing['2xl'],
    fontSize: typography.fontSize.base,
    color: colors.text.secondary
  } as const,

  emptyState: {
    padding: spacing['2xl'],
    textAlign: 'center' as const,
    color: colors.text.secondary
  } as const,

  // 🎯 NEW: Active filters container styling
  activeFiltersContainer: {
    marginBottom: spacing.md,
    display: 'flex' as const,
    gap: spacing.xs,
    flexWrap: 'wrap' as const
  } as const,

  // 🎯 NEW: Active filter badge styling
  activeFilterBadge: {
    padding: `${spacing.xs} ${spacing.sm}`,
    backgroundColor: colors.blue["300"],
    color: colors.blue["600"],
    fontSize: typography.fontSize.xs,
    borderRadius: borderRadius.sm,
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: spacing.xs
  } as const,

  // 🎯 NEW: Close button styling για active filters
  activeFilterCloseButton: {
    background: 'none',
    border: 'none',
    color: colors.blue["600"],
    cursor: 'pointer' as const,
    padding: 0,
    fontSize: typography.fontSize.xs,
    transition: `opacity ${animation.duration.fast}`,
    '&:hover': {
      opacity: 0.7
    }
  } as const,

  // 🎯 NEW: Result count styling
  resultCount: {
    marginBottom: spacing.sm,
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary
  } as const,

  // 🎯 NEW: Search input section styling
  searchInputSection: {
    marginBottom: spacing.md
  } as const
} as const;

// 🎯 MAIN EXPORT - ENTERPRISE SEARCH STYLES
/**
 * 🔍 ENTERPRISE SEARCH SYSTEM STYLES EXPORT
 *
 * Centralized styling object που αντικαθιστά όλα τα inline styles
 * στο SearchSystem component και τα sub-components του.
 *
 * Usage:
 * ```typescript
 * import { searchSystemStyles } from './SearchSystem.styles';
 *
 * <div style={searchSystemStyles.searchInput.container}>
 * <input style={searchSystemStyles.searchInput.input} />
 * <div style={searchSystemStyles.layout.main}>
 * ```
 */
export const searchSystemStyles: SearchSystemStylesType = {
  searchInput: searchInputStyles,
  filters: searchFiltersStyles,
  results: searchResultsStyles,
  layout: searchLayoutStyles
} as const;

// 🔒 TYPE EXPORTS - ENTERPRISE TYPE SAFETY
export type { SearchSystemStylesType, SearchInputStylesType, SearchFilterStylesType, SearchResultsStylesType };

// 🎯 CLASS BUILDERS & UTILITIES — re-exported from SearchSystem.classes (SRP)
export {
  getFilterStateStyle,
  getSearchResultHoverHandlers,
  getSuggestionHighlightStyle,
  getDynamicSuggestionStyle,
  getDynamicInputStyle,
  getDynamicResultItemStyle,
  searchSystemClasses,
  getSearchInputClassName,
  getSuggestionItemClassName,
  getResultItemClassName
} from './SearchSystem.classes';

