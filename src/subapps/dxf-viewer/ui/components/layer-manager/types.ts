/**
 * ADMIN LAYER MANAGER TYPES
 * Shared types για το layer management system
 */

export interface Layer {
  id: string;
  name: string;
  category: string;
  visible: boolean;
  elements: number;
}

export interface Category {
  value: string;
  label: string;
}

export interface LayerManagerState {
  searchQuery: string;
  selectedCategory: string;
  isConnected: boolean;
  lastSyncTime: Date;
}

export interface LayerManagerActions {
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string) => void;
  setIsConnected: (connected: boolean) => void;
  toggleLayerVisibility: (layerId: string) => void;
}

export interface LayerStatistics {
  totalLayers: number;
  visibleLayers: number;
  totalElements: number;
}

export interface LayerFiltering {
  filteredLayers: Layer[];
  searchQuery: string;
  selectedCategory: string;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string) => void;
}

export interface AdminLayerManagerProps {
  className?: string;
}

export interface LayerHeaderProps {
  isConnected: boolean;
  onAddLayer?: () => void;
  onSettings?: () => void;
}

export interface LayerFiltersProps {
  searchQuery: string;
  selectedCategory: string;
  categories: Category[];
  onSearchChange: (query: string) => void;
  onCategoryChange: (category: string) => void;
}

export interface LayerListProps {
  layers: Layer[];
  onToggleVisibility?: (layerId: string) => void;
  onLayerAction?: (layerId: string, action: string) => void;
}

export interface LayerStatisticsProps {
  statistics: LayerStatistics;
  isConnected: boolean;
  lastSyncTime: Date;
}