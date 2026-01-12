import { useCallback, RefObject } from 'react';
import type { Property } from '@/types/property-viewer';
import type {
  FloorData,
  CanvasMode,
  UIState,
  Point,
  MeasurementLine,
  PolyLine,
  ConnectionPair,
  CanvasDimensions
} from '../types';

interface UseCanvasInteractionsProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  floorData: FloorData;
  onFloorDataChange: (data: FloorData) => void;
  mode: CanvasMode;
  uiState: UIState;
  setUIState: (state: UIState | ((prev: UIState) => UIState)) => void;
  measurements: MeasurementLine[];
  setMeasurements: (measurements: MeasurementLine[]) => void;
  polylines: PolyLine[];
  setPolylines: (polylines: PolyLine[]) => void;
  currentPolyline: Point[];
  setCurrentPolyline: (points: Point[]) => void;
  connectionPairs: ConnectionPair[];
  onConnectionPairsChange?: (pairs: ConnectionPair[]) => void;
  onPropertySelect?: (id: string | null) => void;
  onPropertyCreate?: (property: Omit<Property, 'id'>) => void;
  onPropertyUpdate?: (id: string, updates: Partial<Property>) => void;
  isReadOnly: boolean;
  dimensions: CanvasDimensions;
  GRID_SIZE: number;
  SNAP_THRESHOLD: number;
}

export function useCanvasInteractions({
  canvasRef,
  floorData,
  onFloorDataChange,
  mode,
  uiState,
  setUIState,
  measurements,
  setMeasurements,
  polylines,
  setPolylines,
  currentPolyline,
  setCurrentPolyline,
  connectionPairs,
  onConnectionPairsChange,
  onPropertySelect,
  onPropertyCreate,
  onPropertyUpdate,
  isReadOnly,
  dimensions,
  GRID_SIZE,
  SNAP_THRESHOLD
}: UseCanvasInteractionsProps) {

  const getMousePosition = useCallback((event: React.MouseEvent): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }, [canvasRef]);

  const snapToGrid = useCallback((point: Point): Point => {
    return {
      x: Math.round(point.x / GRID_SIZE) * GRID_SIZE,
      y: Math.round(point.y / GRID_SIZE) * GRID_SIZE
    };
  }, [GRID_SIZE]);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (isReadOnly) return;
    
    const point = getMousePosition(event);
    const snappedPoint = snapToGrid(point);
    
    console.log('Canvas mouse down:', { point, snappedPoint, mode });
    
    // Handle different modes
    switch (mode) {
      case 'create':
        setCurrentPolyline(prev => [...prev, snappedPoint]);
        setUIState(prev => ({ ...prev, isCreating: true }));
        break;
        
      case 'measure':
        // Start new measurement
        break;
        
      case 'view':
      default:
        // Handle property selection
        break;
    }
  }, [isReadOnly, getMousePosition, snapToGrid, mode, setCurrentPolyline, setUIState]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    const point = getMousePosition(event);
    
    // Update hover states, cursors, etc.
    if (uiState.isCreating && mode === 'create') {
      // Show preview of current line/shape
    }
  }, [getMousePosition, uiState.isCreating, mode]);

  const handleMouseUp = useCallback((event: React.MouseEvent) => {
    if (isReadOnly) return;
    
    // Handle completion of interactions
    if (uiState.isDragging) {
      setUIState(prev => ({ ...prev, isDragging: false }));
    }
  }, [isReadOnly, uiState.isDragging, setUIState]);

  const handleMouseLeave = useCallback(() => {
    // Clean up any temporary states
    setUIState(prev => ({ 
      ...prev, 
      hoveredPropertyId: null,
      isDragging: false 
    }));
  }, [setUIState]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave
  };
}
