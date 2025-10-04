export type ViewerProps = {
  properties: any[];
  setProperties: (v: any) => void;
  selectedPropertyIds: string[];
  hoveredPropertyId?: string | null;
  selectedFloorId?: string | null;
  onHoverProperty?: (id?: string | null) => void;
  onSelectFloor?: (id: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  setSelectedProperties: (ids: string[]) => void;
  floors: any[];
  currentFloor: any; // διατηρούμε τον ίδιο τύπο με το hook
  activeTool?: string | null;
  setActiveTool?: (t: string | null) => void;
  showGrid: boolean;
  setShowGrid: (v: boolean) => void;
  snapToGrid: boolean;
  setSnapToGrid: (v: boolean) => void;
  gridSize: number;
  setGridSize: (v: number) => void;
  showMeasurements: boolean;
  setShowMeasurements: (v: boolean) => void;
  scale: number;
  setScale: (v: number) => void;
  handlePolygonSelect: (id: string | null) => void;
  handlePolygonCreated: (...args: any[]) => void;
  handlePolygonUpdated: (...args: any[]) => void;
  handleDuplicate: (...args: any[]) => void;
  handleDelete: (...args: any[]) => void;
  suggestionToDisplay: any;
  connections: any[];
  setConnections: (v: any[]) => void;
  groups: any[];
  setGroups: (v: any[]) => void;
  isConnecting: boolean;
  setIsConnecting: (v: boolean) => void;
  firstConnectionPoint: any;
  setFirstConnectionPoint: (v: any) => void;
  isReadOnly: true;
};

export type PublicViewerHookShape = {
  // data
  properties: any[];
  filteredProperties: any[];
  dashboardStats: any;
  isLoading: boolean;

  // selection (read-only surface kept)
  selectedPropertyIds: string[];
  hoveredPropertyId?: string | null;
  selectedFloorId?: string | null;
  selectedUnit?: any;
  floors: any[];
  currentFloor: any;

  // display modes
  viewMode: 'grid' | 'list' | 'plan';
  setViewMode: (v: 'grid' | 'list' | 'plan') => void;
  showDashboard: boolean;
  setShowDashboard: (v: boolean) => void;

  // filters
  filters: any;
  handleFiltersChange: (f: any) => void;

  // display settings
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  showMeasurements: boolean;
  scale: number;
  setScale: (v: number) => void;

  // handlers (read-only)
  onHoverProperty?: (id?: string | null) => void;
  onSelectFloor?: (id: string) => void;
  handleSelectUnit?: (id: string) => void;
  handlePolygonSelect: (id: string | null) => void;

  // everything else passthrough (disabled)
  handlePolygonCreated: (...args: any[]) => void;
  handlePolygonUpdated: (...args: any[]) => void;
  handleDuplicate: (...args: any[]) => void;
  handleDelete: (...args: any[]) => void;
  setProperties: (v: any) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  setSelectedProperties: (ids: string[]) => void;
  activeTool?: string | null;
  setActiveTool?: (t: string | null) => void;
  setShowGrid: (v: boolean) => void;
  setSnapToGrid: (v: boolean) => void;
  setGridSize: (v: number) => void;
  setShowMeasurements: (v: boolean) => void;
  setShowHistoryPanel: (v: boolean) => void;
  suggestionToDisplay: any;
  setSuggestionToDisplay: (v: any) => void;
  connections: any[];
  setConnections: (v: any[]) => void;
  groups: any[];
  setGroups: (v: any[]) => void;
  isConnecting: boolean;
  setIsConnecting: (v: boolean) => void;
  firstConnectionPoint: any;
  setFirstConnectionPoint: (v: any) => void;
  isReadOnly: boolean;
};
