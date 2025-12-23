'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CommonBadge } from '@/core/badges';
import { Separator } from '@/components/ui/separator';
import {
  Home,
  Layers,
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Info
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

// Import components
import { ReadOnlyLayerViewer } from '@/components/property-viewer/ReadOnlyLayerViewer';
import { FloorPlanViewer } from '@/components/property-viewer/FloorPlanViewer';

// Import types
import type { Property } from '@/types/property-viewer';

interface PropertyViewerWithLayersProps {
  floorId: string;
  buildingId: string;
  properties: Property[];
  
  // Floor data
  currentFloor?: {
    id: string;
    name: string;
    pdfUrl?: string;
  };
  
  // Display options
  className?: string;
  showToolbar?: boolean;
  showLayerPanel?: boolean;
  enableZoom?: boolean;
  
  // Callbacks
  onPropertySelect?: (propertyId: string) => void;
  onLayerVisibilityChange?: (layerId: string, isVisible: boolean) => void;
}

export function PropertyViewerWithLayers({
  floorId,
  buildingId,
  properties,
  currentFloor,
  className,
  showToolbar = true,
  showLayerPanel = true,
  enableZoom = true,
  onPropertySelect,
  onLayerVisibilityChange
}: PropertyViewerWithLayersProps) {
  const iconSizes = useIconSizes();
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showLayers, setShowLayers] = useState(showLayerPanel);
  const [isLayersCollapsed, setIsLayersCollapsed] = useState(false);
  const [pdfBackgroundUrl, setPdfBackgroundUrl] = useState<string | null>(null);
  const [layerVisibilityStates, setLayerVisibilityStates] = useState<Record<string, { isVisible: boolean; opacity: number }>>({});

  // Load PDF background if available
  useEffect(() => {
    if (currentFloor?.pdfUrl) {
      setPdfBackgroundUrl(currentFloor.pdfUrl);
    }
  }, [currentFloor?.pdfUrl]);

  // Zoom handlers
  const handleZoomIn = () => {
    if (!enableZoom) return;
    setZoomLevel(prev => Math.min(prev + 10, 300));
  };

  const handleZoomOut = () => {
    if (!enableZoom) return;
    setZoomLevel(prev => Math.max(prev - 10, 50));
  };

  const handleResetZoom = () => {
    if (!enableZoom) return;
    setZoomLevel(100);
  };

  // Layer handlers
  const handleLayerVisibilityChange = (layerId: string, isVisible: boolean) => {
    setLayerVisibilityStates(prev => ({
      ...prev,
      [layerId]: {
        ...prev[layerId],
        isVisible
      }
    }));
    
    onLayerVisibilityChange?.(layerId, isVisible);
  };

  const handleLayerOpacityChange = (layerId: string, opacity: number) => {
    setLayerVisibilityStates(prev => ({
      ...prev,
      [layerId]: {
        ...prev[layerId],
        opacity
      }
    }));
  };

  // Download handler
  const handleDownload = () => {
    try {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      if (canvas) {
        const link = document.createElement('a');
        link.download = `κάτοψη-${currentFloor?.name || 'floor'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } else {
        window.print();
      }
    } catch (error) {
      console.error('Σφάλμα κατά τη φόρτωση:', error);
      window.print();
    }
  };

  // Info handler
  const handleShowInfo = () => {
    const visibleLayers = Object.values(layerVisibilityStates).filter(state => state.isVisible).length;
    const info = `Πληροφορίες Ακινήτου:\nΌροφος: ${currentFloor?.name || 'Άγνωστος'}\nΑκίνητα: ${properties.length}\nZoom: ${zoomLevel}%\nOrατά Layers: ${visibleLayers}\nΚάτοψη PDF: ${pdfBackgroundUrl ? 'Διαθέσιμη' : 'Μη διαθέσιμη'}`;
    alert(info);
  };

  if (!currentFloor) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center h-96 text-center text-muted-foreground">
          <Home className={`${iconSizes.xl6} mb-4 opacity-50`} />
          <h3 className="text-xl font-semibold mb-2">Δεν υπάρχει διαθέσιμη κάτοψη</h3>
          <p className="text-sm max-w-sm">
            Δεν υπάρχουν διαθέσιμα δεδομένα κάτοψης για αυτό το ακίνητο.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <main className={`flex flex-col h-full ${className}`}>
      {/* Toolbar - Read-only version */}
      {showToolbar && (
        <nav className="px-2 py-2 shrink-0" role="toolbar" aria-label="Property viewer controls">
          <Card className="border-none shadow-none">
            <CardContent className="p-1 flex items-center justify-between">
              {/* Left side - View tools */}
              <ul className="flex items-center gap-2 list-none">
                {/* Layer Panel Toggle */}
                {showLayerPanel && (
                  <li className="flex items-center gap-1 bg-muted p-1 rounded-md">
                    <Button 
                      variant={showLayers ? "default" : "ghost"}
                      size="sm" 
                      onClick={() => setShowLayers(!showLayers)}
                      className={`${iconSizes.xl} p-0`} 
                      aria-label="Layers"
                    >
                      <Layers className={iconSizes.sm} />
                    </Button>
                  </li>
                )}
                
                <Separator orientation="vertical" className="h-6" />
                
                {/* Zoom Controls */}
                {enableZoom && (
                  <li className="flex items-center gap-1 bg-muted p-1 rounded-md">
                    <Button variant="ghost" size="sm" onClick={handleZoomOut} className={`${iconSizes.xl} p-0`}>
                      <ZoomOut className={iconSizes.sm} />
                    </Button>
                    <div className="px-2 text-xs">
                      {zoomLevel}%
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleZoomIn} className={`${iconSizes.xl} p-0`}>
                      <ZoomIn className={iconSizes.sm} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleResetZoom} className={`${iconSizes.xl} p-0`}>
                      <RotateCcw className={iconSizes.sm} />
                    </Button>
                  </li>
                )}
                
                <Separator orientation="vertical" className="h-6" />
                
                {/* Info and Download */}
                <li className="flex items-center gap-1 bg-muted p-1 rounded-md">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleShowInfo}
                    className={`${iconSizes.xl} p-0`} 
                    aria-label="Πληροφορίες"
                  >
                    <Info className={iconSizes.sm} />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleDownload} 
                    className={`${iconSizes.xl} p-0`} 
                    aria-label="Φόρτωση"
                  >
                    <Download className={iconSizes.sm} />
                  </Button>
                </li>
              </ul>

              {/* Right side - Status info */}
              <section className="flex items-center gap-2 text-xs text-muted-foreground" aria-label="Status information">
                <CommonBadge
                  status="units"
                  customLabel={`${properties.length} Ακίνητα`}
                  variant="outline"
                  className="text-xs"
                />
                <CommonBadge
                  status="company"
                  customLabel="Προβολή μόνο"
                  variant="outline"
                  className="text-xs"
                />
              </section>
            </CardContent>
          </Card>
        </nav>
      )}

      {/* Main content area */}
      <section className="flex-1 flex gap-2 h-full overflow-hidden">
        {/* Layer Panel */}
        {showLayers && showLayerPanel && (
          <aside className="w-80 flex-shrink-0" aria-label="Layer controls panel">
            <ReadOnlyLayerViewer
              floorId={floorId}
              buildingId={buildingId}
              properties={properties}
              className="h-full"
              isCollapsed={isLayersCollapsed}
              onToggleCollapse={() => setIsLayersCollapsed(!isLayersCollapsed)}
              onLayerVisibilityChange={handleLayerVisibilityChange}
              onLayerOpacityChange={handleLayerOpacityChange}
              showSearch={true}
              showCategoryFilter={true}
              showStatistics={true}
              maxHeight="600px"
            />
          </aside>
        )}

        {/* FloorPlan Viewer */}
        <section className="flex-1 flex flex-col h-full overflow-hidden" aria-label="Floor plan viewer">
          <div 
            className="flex-1 overflow-auto"
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '20px'
            }}
          >
            <div
              style={{
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: 'center center',
                transition: 'transform 0.2s ease-in-out',
                width: '100%',
                height: '100%',
                minWidth: '600px',
                minHeight: '400px',
                position: 'relative'
              }}
            >
              {/* PDF Background Layer */}
              {pdfBackgroundUrl && (
                <div 
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundImage: `url(${pdfBackgroundUrl})`,
                    backgroundSize: 'contain',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    opacity: 0.7,
                    zIndex: -1,
                    pointerEvents: 'none'
                  }}
                />
              )}
              
              {/* FloorPlan Viewer Component */}
              <FloorPlanViewer
                currentFloor={currentFloor}
                floors={[currentFloor]}
                properties={properties}
                onSelectProperty={(propertyId) => {
                  onPropertySelect?.(propertyId);
                }}
                // Read-only props
                activeTool={null}
                showGrid={false}
                snapToGrid={false}
                showMeasurements={false}
                isReadOnly={true}
                // Layer visibility states
                layerVisibilityStates={layerVisibilityStates}
                pdfBackgroundUrl={pdfBackgroundUrl}
              />
            </div>
          </div>
        </section>
      </section>

      {/* Status bar */}
      <footer className="px-4 py-2 bg-muted/30 border-t">
        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>Όροφος: {currentFloor.name}</span>
            <span>Zoom: {zoomLevel}%</span>
            {Object.keys(layerVisibilityStates).length > 0 && (
              <span>
                Layers: {Object.values(layerVisibilityStates).filter(s => s.isVisible).length}/
                {Object.keys(layerVisibilityStates).length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className={`${iconSizes.xs} bg-green-500 rounded-full`} />
              <span>Ενημερώσεις σε πραγματικό χρόνο</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}