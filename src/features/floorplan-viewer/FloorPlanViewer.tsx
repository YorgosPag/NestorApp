'use client';

import * as React from 'react';

// ============================================================================
// ENTERPRISE TYPES FOR MOCK COMPONENTS
// ============================================================================

/** ClassValue type for cn utility */
type ClassValue = string | number | boolean | undefined | null | Record<string, boolean>;

/** Props type for mock container components */
interface MockContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  [key: string]: unknown;
}

// Mock imports for missing dependencies
const cn = (...args: ClassValue[]) => args.filter(Boolean).join(' ');
const useBorderTokens = () => ({ quick: 'border-2' });
const useSemanticColors = () => ({
  bg: { primary: 'bg-white', secondary: 'bg-gray-100' },
  text: { primary: 'text-black', secondary: 'text-gray-600' }
});

// Mock components for missing dependencies
const SidebarPanel = ({ children, ...props }: MockContainerProps) => <div {...props}>{children}</div>;
const FloorPlanCanvas = ({ children, ...props }: MockContainerProps) => <div {...props}>{children}</div>;
const ViewerToolbar = ({ children, ...props }: MockContainerProps) => <div {...props}>{children}</div>;
const ViewerTools = ({ children, ...props }: MockContainerProps) => <div {...props}>{children}</div>;
import { EmptyState } from './components/EmptyState';

import type { FloorPlanViewerLayoutProps } from './types';
// ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση existing enterprise zoom system αντί διπλότυπου
import { useZoom } from '@/subapps/dxf-viewer/systems/zoom/hooks/useZoom';
import type { ViewTransform, Viewport } from '@/subapps/dxf-viewer/rendering/types/Types';
import { asArray, ensureFloor, isNodeEditMode, safeGetProperty } from './utils/safeProps';

export function FloorPlanViewer(props: FloorPlanViewerLayoutProps) {
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();

  const {
    currentFloor,
    onFloorChange,
    selectedPropertyId,
    onPropertySelect,
    onPropertyCreate,
    onPropertyUpdate,
    viewMode = 'view',
    onViewModeChange,
    showSidebar = true,
    sidebarWidth = 320,
    isReadOnly = false,
    connectionPairs = [],
    onConnectionPairsChange,
    groups = [],
    setGroups,
    className
  } = props;

  const [isConnecting, setIsConnecting] = React.useState(false);
  const [pdfUrl, setPdfUrl] = React.useState<string | undefined>();

  // ✅ ENTERPRISE ZOOM SYSTEM: Χρήση κεντρικοποιημένου ZoomManager
  const initialTransform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
  const viewport: Viewport = { width: 800, height: 600 }; // Default viewport

  const zoomSystem = useZoom({
    initialTransform,
    viewport,
    onTransformChange: (transform) => {
      console.log('🔍 Transform updated:', transform);
    }
  });

  const currentTransform = zoomSystem.getCurrentTransform();
  const scale = currentTransform.scale;
  const position = { x: currentTransform.offsetX, y: currentTransform.offsetY };

  // Ensure we have a valid floor με safe properties
  const floor = ensureFloor(currentFloor);
  const properties = asArray(floor.properties);

  // Initialize PDF URL from floor data
  React.useEffect(() => {
    if (floor.floorPlanUrl && !pdfUrl) {
      setPdfUrl(floor.floorPlanUrl);
    }
  }, [floor.floorPlanUrl, pdfUrl]);

  // Handle PDF upload
  const handlePdfUpload = React.useCallback((file: File) => {
    try {
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
      
      console.log('📄 PDF uploaded successfully:', {
        name: file.name,
        size: file.size,
        url: url.substring(0, 50) + '...'
      });
      
      // Update floor data safely
      if (onFloorChange) {
        const updatedFloor = {
          ...floor,
          floorPlanUrl: url,
          metadata: {
            ...floor.metadata,
            lastPDFUpdate: new Date().toISOString(),
            pdfFileName: file.name,
            pdfFileSize: file.size
          }
        };
        onFloorChange(updatedFloor);
      }
    } catch (error) {
      console.error('❌ PDF upload failed:', error);
    }
  }, [floor, onFloorChange]);

  // Safe property selection
  const handlePropertySelect = React.useCallback((propertyId: string | null) => {
    console.log('🎯 Property selected:', propertyId);
    onPropertySelect?.(propertyId);
  }, [onPropertySelect]);

  // ✅ ENTERPRISE EVENT HANDLERS: Χρήση κεντρικοποιημένου zoom system
  const handleWheelZoom = React.useCallback((event: React.WheelEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const center = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    zoomSystem.handleWheelZoom(event.deltaY, center);
  }, [zoomSystem]);

  const handleZoomIn = React.useCallback(() => {
    zoomSystem.zoomIn();
  }, [zoomSystem]);

  const handleZoomOut = React.useCallback(() => {
    zoomSystem.zoomOut();
  }, [zoomSystem]);

  const handleResetView = React.useCallback(() => {
    zoomSystem.setTransform(initialTransform);
  }, [zoomSystem, initialTransform]);

  // Get selected property safely
  const selectedProperty = safeGetProperty(properties, selectedPropertyId);

  // Show empty state if no floor
  if (!currentFloor && properties.length === 0) {
    return (
      <div className={cn('h-full', className)}>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className={cn('flex h-full', className)}>
      {/* Main viewer area */}
      <div className="flex-1 flex flex-col relative">
        
        {/* VIEWER TOOLBAR */}
        <ViewerToolbar
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          onPdfUpload={handlePdfUpload}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetView={handleResetView}
          scale={scale}
          isReadOnly={isReadOnly}
          currentFloor={floor}
          onFloorChange={onFloorChange}
        />

        {/* VIEWER TOOLS */}
        <ViewerTools
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          selectedPropertyId={selectedPropertyId}
          onPropertySelect={handlePropertySelect}
          isConnecting={isConnecting}
          onConnectingChange={setIsConnecting}
          connectionPairs={connectionPairs || []}
          onConnectionPairsChange={onConnectionPairsChange}
          properties={properties}
          isReadOnly={isReadOnly}
        />

        {/* FLOOR PLAN CANVAS */}
        <div
          className={`flex-1 relative overflow-hidden ${colors.bg.secondary}`}
          onWheel={handleWheelZoom}
        >
          <div
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: '0 0',
              transition: 'transform 0.1s ease-out'
            }}
          >
            <FloorPlanCanvas
              floorData={floor}
              onFloorDataChange={onFloorChange}
              mode={viewMode}
              selectedPropertyId={selectedPropertyId}
              onPropertySelect={handlePropertySelect}
              onPropertyCreate={onPropertyCreate}
              onPropertyUpdate={onPropertyUpdate}
              isReadOnly={isReadOnly}
              pdfBackgroundUrl={pdfUrl}
              enableGrid={true}
              enableMeasurements={true}
              enableConnections={isConnecting}
              showStatusLegend={true}
              showPropertyCount={true}
              connectionPairs={connectionPairs || []}
              onConnectionPairsChange={onConnectionPairsChange}
              onModeChange={onViewModeChange}
            />
          </div>
        </div>

        {/* STATUS BAR */}
        <div className={`flex items-center justify-between px-4 py-2 ${colors.bg.primary} border-t text-sm ${colors.text.secondary}`}>
          <div className="flex items-center gap-4">
            <span>Properties: {properties.length}</span>
            <span>Selected: {selectedPropertyId || 'None'}</span>
            <span>Connections: {(connectionPairs || []).length}</span>
          </div>
          <div className="flex items-center gap-4">
            {pdfUrl && (
              <span className={`${colors.text.primary}`}>• PDF Loaded</span>
            )}
            <span>Zoom: {Math.round(scale * 100)}%</span>
            <span className="capitalize">Mode: {viewMode}</span>
            {isConnecting && <span className={`${colors.text.primary}`}>• Connecting</span>}
          </div>
        </div>
      </div>

      {/* SIDEBAR */}
      {showSidebar && (
        <SidebarPanel
          width={sidebarWidth}
          floor={floor}
          selectedPropertyId={selectedPropertyId}
          onPropertySelect={handlePropertySelect}
          onPropertyCreate={onPropertyCreate}
          onPropertyUpdate={onPropertyUpdate}
          viewMode={viewMode}
          connectionPairs={connectionPairs || []}
          onConnectionPairsChange={onConnectionPairsChange}
          groups={groups || []}
          setGroups={setGroups}
          isConnecting={isConnecting}
          setIsConnecting={setIsConnecting}
        />
      )}
    </div>
  );
}
