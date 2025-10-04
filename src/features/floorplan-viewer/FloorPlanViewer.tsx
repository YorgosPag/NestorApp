'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { SidebarPanel } from '@/components/property-viewer/SidebarPanel';
import { FloorPlanCanvas } from '@/components/property-viewer/FloorPlanCanvas';
import { ViewerToolbar } from '@/components/property-viewer/ViewerToolbar';
import { ViewerTools } from '@/components/property-viewer/ViewerTools';
import { EmptyState } from './components/EmptyState';

import type { FloorPlanViewerLayoutProps } from './types';
import { useSafePanZoom } from './hooks/useSafePanZoom';
import { asArray, ensureFloor, isNodeEditMode, safeGetProperty } from './utils/safeProps';

export function FloorPlanViewer(props: FloorPlanViewerLayoutProps) {
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

  // Safe pan-zoom functionality με default values
  const panZoomResult = useSafePanZoom();
  const scale = panZoomResult?.scale ?? 1;
  const position = panZoomResult?.position ?? { x: 0, y: 0 };
  const {
    handleWheel,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    resetView,
    zoomIn,
    zoomOut
  } = panZoomResult || {};

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

  // Safe event handlers με fallbacks
  const safeHandleWheel = React.useCallback((event: React.WheelEvent) => {
    if (handleWheel) {
      handleWheel(event);
    }
  }, [handleWheel]);

  const safeHandlePanStart = React.useCallback((event: React.MouseEvent) => {
    if (handlePanStart) {
      handlePanStart(event);
    }
  }, [handlePanStart]);

  const safeHandlePanMove = React.useCallback((event: React.MouseEvent) => {
    if (handlePanMove) {
      handlePanMove(event);
    }
  }, [handlePanMove]);

  const safeHandlePanEnd = React.useCallback(() => {
    if (handlePanEnd) {
      handlePanEnd();
    }
  }, [handlePanEnd]);

  const safeZoomIn = React.useCallback(() => {
    if (zoomIn) {
      zoomIn();
    }
  }, [zoomIn]);

  const safeZoomOut = React.useCallback(() => {
    if (zoomOut) {
      zoomOut();
    }
  }, [zoomOut]);

  const safeResetView = React.useCallback(() => {
    if (resetView) {
      resetView();
    }
  }, [resetView]);

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
          onZoomIn={safeZoomIn}
          onZoomOut={safeZoomOut}
          onResetView={safeResetView}
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
          className="flex-1 relative overflow-hidden bg-gray-50"
          onWheel={safeHandleWheel}
          onMouseDown={safeHandlePanStart}
          onMouseMove={safeHandlePanMove}
          onMouseUp={safeHandlePanEnd}
          onMouseLeave={safeHandlePanEnd}
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
        <div className="flex items-center justify-between px-4 py-2 bg-white border-t border-gray-200 text-sm text-gray-600">
          <div className="flex items-center gap-4">
            <span>Properties: {properties.length}</span>
            <span>Selected: {selectedPropertyId || 'None'}</span>
            <span>Connections: {(connectionPairs || []).length}</span>
          </div>
          <div className="flex items-center gap-4">
            {pdfUrl && (
              <span className="text-green-600">• PDF Loaded</span>
            )}
            <span>Zoom: {Math.round(scale * 100)}%</span>
            <span className="capitalize">Mode: {viewMode}</span>
            {isConnecting && <span className="text-blue-600">• Connecting</span>}
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
