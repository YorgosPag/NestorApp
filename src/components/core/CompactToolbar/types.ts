// CompactToolbar Types - Generic interfaces for all list types

// 🏢 ENTERPRISE: Unified sort fields for all entity types including communications, units, parking
export type SortField = 'name' | 'progress' | 'value' | 'area' | 'date' | 'status' | 'type' | 'priority' | 'channel' | 'rooms' | 'number' | 'location';

export interface CompactToolbarConfig {
  // Search configuration
  searchPlaceholder: string;

  // Labels for actions
  labels: {
    newItem: string;
    editItem: string;
    deleteItems: string;
    filters: string;
    favorites: string;
    archive: string;
    export: string;
    import: string;
    refresh: string;
    preview: string;
    copy: string;
    share: string;
    reports: string;
    settings: string;
    favoritesManagement: string;
    help: string;
    sorting: string;
  };

  // Tooltips
  tooltips: {
    newItem: string;
    editItem: string;
    deleteItems: string;
    filters: string;
    favorites: string;
    archive: string;
    export: string;
    import: string;
    refresh: string;
    preview: string;
    copy: string;
    share: string;
    reports: string;
    settings: string;
    favoritesManagement: string;
    help: string;
    sorting: string;
  };

  // Filter categories
  filterCategories: FilterCategory[];

  // Sort options
  sortOptions: SortOption[];

  // Available actions (to show/hide specific tools)
  availableActions: {
    newItem?: boolean;
    editItem?: boolean;
    deleteItems?: boolean;
    filters?: boolean;
    favorites?: boolean;
    archive?: boolean;
    export?: boolean;
    import?: boolean;
    refresh?: boolean;
    sorting?: boolean;
    preview?: boolean;
    copy?: boolean;
    share?: boolean;
    reports?: boolean;
    settings?: boolean;
    favoritesManagement?: boolean;
    help?: boolean;
  };
}

export interface FilterCategory {
  id: string;
  label: string;
  options: FilterOption[];
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface SortOption {
  field: SortField;
  ascLabel: string;
  descLabel: string;
}

export interface CompactToolbarProps {
  // Configuration
  config: CompactToolbarConfig;

  // State
  // 🏢 ENTERPRISE: Using string IDs for Firebase compatibility
  selectedItems?: string[];
  onSelectionChange?: (items: string[]) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  activeFilters?: string[];
  onFiltersChange?: (filters: string[]) => void;
  sortBy?: SortField;
  onSortChange?: (sortBy: SortField, sortOrder: 'asc' | 'desc') => void;
  hasSelectedContact?: boolean;

  // 🏢 ENTERPRISE Header Display - Same as GenericListHeader
  headerTitle?: string; // e.g., "Εταιρείες"
  headerCount?: number; // e.g., 5
  headerIcon?: React.ComponentType<{ className?: string }>; // Icon component
  headerIconColor?: string; // entity-specific color class

  // 🏢 ENTERPRISE Custom Icons - For semantic correctness
  newItemIcon?: React.ComponentType<{ className?: string }>; // Custom new item icon (default: Plus, can be Link2 for "connect")
  deleteIcon?: React.ComponentType<{ className?: string }>; // Custom delete/unlink icon (default: Trash2)

  // Action handlers
  onNewItem?: () => void;
  onEditItem?: (id: string) => void;
  onDeleteItems?: (ids: string[]) => void;
  onExport?: () => void;
  onImport?: () => void;
  onRefresh?: () => void;
  onPreview?: () => void;
  onCopy?: () => void;
  onShare?: () => void;
  onReports?: () => void;
  onSettings?: () => void;
  onFavoritesManagement?: () => void;
  onHelp?: () => void;
}