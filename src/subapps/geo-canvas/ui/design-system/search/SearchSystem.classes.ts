/**
 * 🔍 SEARCH SYSTEM — CSS CLASS BUILDERS
 *
 * Tailwind className strings and dynamic className utilities.
 * Extracted from SearchSystem.styles.ts (SRP split — Google file size standards).
 *
 * @module SearchSystem.classes
 */

export const searchSystemClasses = {
  searchInput: {
    container: 'relative w-full mb-4',
    input: 'w-full p-3 text-base border rounded-md transition-colors border-border bg-background text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
    inputFocused: 'w-full p-3 text-base border rounded-md transition-colors border-primary bg-background text-foreground outline-none ring-2 ring-primary/20',
    icon: 'absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none',
    suggestionsContainer: 'absolute top-full left-0 right-0 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-y-auto z-50'
  },
  filter: {
    container: 'mb-4',
    label: 'block mb-1 text-xs font-medium text-muted-foreground',
    input: 'w-full px-2 py-1 text-sm border border-border rounded-sm bg-background text-foreground focus:outline-none focus:border-primary',
    select: 'w-full px-2 py-1 text-sm border border-border rounded-sm bg-background text-foreground cursor-pointer focus:outline-none focus:border-primary',
    checkbox: 'mr-2 cursor-pointer accent-primary',
    rangeContainer: 'flex items-center gap-2',
    rangeInput: 'w-20 px-2 py-1 text-sm border border-border rounded-sm bg-background text-foreground text-center focus:outline-none focus:border-primary',
    rangeLabel: 'text-sm text-muted-foreground',
    multiselectLabel: 'flex items-center gap-2 text-xs text-foreground cursor-pointer',
    header: 'flex justify-between items-center mb-2',
    headerTitle: 'm-0 text-sm font-semibold text-foreground',
    clearButton: 'px-2 py-1 border border-border rounded-sm bg-background text-foreground cursor-pointer hover:bg-accent transition-colors',
    filtersGrid: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
  },
  results: {
    container: 'flex flex-col gap-2',
    item: 'p-3 border border-border rounded-md bg-card transition-all hover:bg-accent hover:border-primary hover:-translate-y-0.5 hover:shadow-sm',
    itemClickable: 'p-3 border border-border rounded-md bg-card transition-all cursor-pointer hover:bg-accent hover:border-primary hover:-translate-y-0.5 hover:shadow-sm',
    itemTitle: 'text-base font-semibold text-foreground mb-1',
    itemDescription: 'text-sm text-muted-foreground leading-relaxed mb-1',
    itemCategory: 'text-xs text-primary font-medium uppercase tracking-wide mb-1',
    itemTags: 'flex flex-wrap gap-1',
    tag: 'bg-secondary text-secondary-foreground px-1 py-0.5 rounded-sm text-xs font-medium'
  },
  layout: {
    main: 'flex flex-col w-full max-w-full',
    searchInputSection: 'mb-4',
    filtersSection: 'mb-4 p-4 bg-muted/50 rounded-md border border-border',
    activeFiltersContainer: 'flex flex-wrap gap-1 mb-4',
    activeFilterBadge: 'inline-flex items-center gap-1 bg-primary text-primary-foreground px-2 py-1 rounded-full text-xs font-medium',
    activeFilterCloseButton: 'bg-transparent border-none text-primary-foreground cursor-pointer ml-1 text-sm opacity-80 hover:opacity-100',
    resultCount: 'text-sm text-muted-foreground mb-2',
    emptyState: 'flex flex-col items-center justify-center p-8 text-center text-muted-foreground',
    emptyStateIcon: 'text-5xl mb-4 opacity-60',
    emptyStateTitle: 'text-lg font-semibold mb-2 text-foreground',
    emptyStateSubtitle: 'text-sm leading-relaxed max-w-md'
  },
  suggestion: {
    item: 'p-2 cursor-pointer border-b border-border last:border-b-0 transition-colors hover:bg-accent',
    itemSelected: 'p-2 cursor-pointer border-b border-border last:border-b-0 transition-colors bg-accent text-accent-foreground'
  }
};

export const getSearchInputClassName = (focused: boolean): string =>
  focused ? searchSystemClasses.searchInput.inputFocused : searchSystemClasses.searchInput.input;

export const getSuggestionItemClassName = (isSelected: boolean): string =>
  isSelected ? searchSystemClasses.suggestion.itemSelected : searchSystemClasses.suggestion.item;

export const getResultItemClassName = (hasClickHandler: boolean): string =>
  hasClickHandler ? searchSystemClasses.results.itemClickable : searchSystemClasses.results.item;
