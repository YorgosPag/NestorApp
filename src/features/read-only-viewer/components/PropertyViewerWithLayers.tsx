// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CommonBadge } from '@/core/badges';
import { Separator } from '@/components/ui/separator';
import {
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
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';

import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// 🏢 ENTERPRISE: Centralized Unit Icon & Color
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;
const unitColor = NAVIGATION_ENTITIES.unit.color;

// Import components
import { ReadOnlyLayerViewer } from '@/components/property-viewer/ReadOnlyLayerViewer';
import { FloorPlanViewer } from '@/components/property-viewer/FloorPlanViewer';

// Import types
import type { Property } from '@/types/property-viewer';
import type { FloorData } from '@/features/floorplan-viewer/types';

interface PropertyViewerWithLayersProps {
  floorId: string;
  buildingId: string;
  properties: Property[];
  
  // Floor data
  currentFloor?: FloorData;
  
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
  const { t } = useTranslation('properties');
  const iconSizes = useIconSizes();
  const { getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showLayers, setShowLayers] = useState(showLayerPanel);
  const [isLayersCollapsed, setIsLayersCollapsed] = useState(false);
  const [pdfBackgroundUrl, setPdfBackgroundUrl] = useState<string | null>(null);
  const [layerVisibilityStates, setLayerVisibilityStates] = useState<Record<string, { isVisible: boolean; opacity: number }>>({});

  // Load PDF background if available
  useEffect(() => {
    if (currentFloor?.floorPlanUrl) {
      setPdfBackgroundUrl(currentFloor.floorPlanUrl);
    }
  }, [currentFloor?.floorPlanUrl]);

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
        // 🏢 ENTERPRISE: i18n-enabled filename
        link.download = `${t('viewer.download.filename')}-${currentFloor?.name || 'floor'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } else {
        window.print();
      }
    } catch (error) {
      // 🏢 ENTERPRISE: i18n-enabled error message
      console.error(t('viewer.errors.loadingError'), error);
      window.print();
    }
  };

  // Info handler
  // 🏢 ENTERPRISE: i18n-enabled info message
  const handleShowInfo = () => {
    const visibleLayers = Object.values(layerVisibilityStates).filter(state => state.isVisible).length;
    const pdfStatus = pdfBackgroundUrl ? t('viewer.info.available') : t('viewer.info.notAvailable');
    const info = `${t('viewer.info.title')}\n${t('viewer.info.floor')} ${currentFloor?.name || t('viewer.info.unknown')}\n${t('viewer.info.properties')} ${properties.length}\n${t('viewer.info.zoom')} ${zoomLevel}%\n${t('viewer.info.visibleLayers')} ${visibleLayers}\n${t('viewer.info.pdfFloorplan')} ${pdfStatus}`;
    alert(info);
  };

  if (!currentFloor) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center h-96 text-center text-muted-foreground">
          <UnitIcon className={`${iconSizes.xl6} mb-4 opacity-50 ${unitColor}`} />
          <h3 className="text-xl font-semibold mb-2">{t('viewer.emptyState.noFloorplan')}</h3>
          <p className="text-sm max-w-sm">
            {t('viewer.emptyState.noFloorplanDescription')}
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
                    aria-label={t('viewer.actions.info')}
                  >
                    <Info className={iconSizes.sm} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownload}
                    className={`${iconSizes.xl} p-0`}
                    aria-label={t('viewer.actions.download')}
                  >
                    <Download className={iconSizes.sm} />
                  </Button>
                </li>
              </ul>

              {/* Right side - Status info */}
              <section className="flex items-center gap-2 text-xs text-muted-foreground" aria-label="Status information">
                <CommonBadge
                  status="units"
                  customLabel={t('viewer.badges.propertiesCount', { count: properties.length })}
                  variant="outline"
                  className="text-xs"
                />
                <CommonBadge
                  status="company"
                  customLabel={t('viewer.badges.viewOnly')}
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
          <div className="flex-1 overflow-auto flex justify-center items-center p-5">
            <div
              className="w-full h-full min-w-[600px] min-h-[400px] relative transition-transform duration-200 ease-in-out origin-center"
              data-zoom-level={zoomLevel}
              style={{
                transform: `scale(${zoomLevel / 100})`
              }}
            >
              {/* PDF Background Layer */}
              {pdfBackgroundUrl && (
                <div
                  className="absolute inset-0 w-full h-full bg-contain bg-no-repeat bg-center opacity-70 -z-10 pointer-events-none"
                  data-pdf-background
                  style={{
                    backgroundImage: `url(${pdfBackgroundUrl})`
                  }}
                />
              )}
              
              {/* FloorPlan Viewer Component */}
              <FloorPlanViewer
                currentFloor={currentFloor}
                floors={[currentFloor]}
                properties={properties}
                onPropertySelect={(propertyId) => {
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
                pdfBackgroundUrl={pdfBackgroundUrl ?? undefined}
              />
            </div>
          </div>
        </section>
      </section>

      {/* Status bar */}
      <footer className={`px-4 py-2 bg-muted/30 ${getDirectionalBorder('muted', 'top')}`}>
        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>{t('viewer.statusBar.floor')} {currentFloor.name}</span>
            <span>{t('viewer.info.zoom')} {zoomLevel}%</span>
            {Object.keys(layerVisibilityStates).length > 0 && (
              <span>
                {t('viewer.statusBar.layers')} {Object.values(layerVisibilityStates).filter(s => s.isVisible).length}/
                {Object.keys(layerVisibilityStates).length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className={`${iconSizes.xs} ${colors.bg.success} rounded-full`} />
              <span>{t('viewer.statusBar.realTimeUpdates')}</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
