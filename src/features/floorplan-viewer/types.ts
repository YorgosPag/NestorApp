'use client';

import type { Property } from '@/types/property-viewer';

interface Suggestion {
  id: string;
  text: string;
}

interface Connection {
  id: string;
  fromPropertyId: string;
  toPropertyId: string;
}

interface PropertyGroup {
  id: string;
  name: string;
  properties: Property[];
}

export interface LayerState {
  visible: boolean;
  locked: boolean;
  opacity: number;
}

export interface FloorData {
  id: string;
  name: string;
  level?: number;
  buildingId?: string;
  floorPlanUrl?: string;
  properties: Property[];
  metadata?: Record<string, unknown>;
}

export interface FloorPlanViewerLayoutProps {
  currentFloor?: FloorData | null;
  floors?: FloorData[];
  zoom?: number;
  pan?: { x: number; y: number };
  showLabels?: boolean;
  selectedPropertyIds?: string[];
  hoveredPropertyId?: string | null;
  activeTool?: 'create' | 'edit_nodes' | 'measure' | 'polyline' | null;
  layerStates?: Record<string, LayerState>;
  suggestionToDisplay?: Suggestion | null;
  connections?: Connection[];
  groups?: PropertyGroup[];
  isConnecting?: boolean;
  firstConnectionPoint?: Property | null;
  showGrid?: boolean;
  snapToGrid?: boolean;
  gridSize?: number;
  showMeasurements?: boolean;
  scale?: number;
  isReadOnly?: boolean;
  pdfBackgroundUrl?: string; // ✅ ΠΡΟΣΘΗΚΗ PDF PROP

  setZoom?: (zoom: number | ((prevZoom: number) => number)) => void;
  setPan?: (pan: { x: number; y: number }) => void;
  setShowLabels?: (show: boolean) => void;
  onSelectFloor?: (floorId: string | null) => void;
  onFileUpload?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onHoverProperty?: (propertyId: string | null) => void;
  onSelectProperty?: (propertyId: string, isShiftClick: boolean) => void;
  onPolygonCreated?: (newProperty: Omit<Property, 'id' | 'name' | 'type' | 'status' | 'building' | 'floor' | 'project' | 'buildingId' | 'floorId'>) => void;
  onPolygonUpdated?: (polygonId: string, vertices: Array<{ x: number; y: number }>) => void;
  onNavigateLevels?: (property: Property) => void;
  onDuplicate?: (propertyId: string) => void;
  onDelete?: (propertyId: string) => void;
  setLayerStates?: React.Dispatch<React.SetStateAction<Record<string, LayerState>>>;
  setConnections?: React.Dispatch<React.SetStateAction<Connection[]>>;
  setGroups?: React.Dispatch<React.SetStateAction<PropertyGroup[]>>;
  setIsConnecting?: React.Dispatch<React.SetStateAction<boolean>>;

  properties?: Property[];
  // Additional missing properties
  onFloorChange?: (floor: FloorData | string | null) => void;
  selectedPropertyId?: string | null;
  onPropertySelect?: (propertyId: string) => void;
  onPropertyCreate?: (property: Partial<Property>) => void;
  onPropertyUpdate?: (propertyId: string, property: Partial<Property>) => void;
  viewMode?: 'view' | 'edit' | 'create';
  onViewModeChange?: (mode: 'view' | 'edit' | 'create') => void;
  showSidebar?: boolean;
  sidebarWidth?: number;
  connectionPairs?: Connection[];
  onConnectionPairsChange?: (pairs: Connection[]) => void;
  layerVisibilityStates?: Record<string, { isVisible: boolean; opacity: number }>;
  className?: string;
}
