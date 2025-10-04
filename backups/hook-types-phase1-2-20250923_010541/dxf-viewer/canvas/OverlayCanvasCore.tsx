'use client';

// ✅ Debug flag for OverlayCanvasCore logging
const DEBUG_CANVAS_CORE = false;

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { OverlayRenderer } from './overlay-renderer';
import { useGripContext } from '../providers/GripProvider';
import { useGripInteraction } from './interaction/useGripInteraction';
import { coordTransforms } from '../systems/rulers-grid/config';
import { isFeatureEnabled } from '../config/feature-flags';
import type { ViewTransform } from '../systems/rulers-grid/config';
import type { Region, RegionStatus, Point2D } from '../types/overlay';

interface OverlayCanvasCoreProps {
  transform: ViewTransform;
  visibleRegions: Region[];
  selectedRegionIds: string[];
  isDrawing: boolean;
  drawingVertices: Point2D[];
  drawingStatus: RegionStatus;
  showHandles: boolean;
  showLabels: boolean;
  editingRegionId: string | null;
  mousePosition: { x: number; y: number } | null;
  className?: string;
  onRendererReady: (renderer: OverlayRenderer) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onRegionClick?: (regionId: string) => void;
  onVertexDrag?: (regionId: string, vertexIndex: number, newPoint: { x: number; y: number }) => void; // 🎯 NEW: For grip editing
  onRegionUpdate?: (regionId: string, updates: { vertices?: Point2D[] }) => void; // 🏗️ NEW: For polygon drag & drop
  // Snap integration props
  snapEnabled?: boolean;
  findSnapPoint?: (x: number, y: number) => any;
}

export function OverlayCanvasCore({
  transform,
  visibleRegions,
  selectedRegionIds,
  isDrawing,
  drawingVertices,
  drawingStatus,
  showHandles,
  showLabels,
  editingRegionId,
  mousePosition,
  className,
  onRendererReady,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onContextMenu,
  onRegionClick,
  onVertexDrag,
  onRegionUpdate,
  snapEnabled,
  findSnapPoint
}: OverlayCanvasCoreProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<OverlayRenderer | null>(null);
  const animationFrameRef = useRef<number>();

  // === GRIP SETTINGS INTEGRATION (καθαρή) ===
  const { gripSettings } = useGripContext();
  
  // === CURSOR STATE FOR GRIP HOVER ===
  const [cursor, setCursor] = useState<string>('crosshair');
  
  // === GRIP INTERACTION STATE ===
  const [gripInteractionState, setGripInteractionState] = useState<{
    hovered?: { entityId: string; gripIndex: number };
    active?: { entityId: string; gripIndex: number };
  }>({});
  
  // === GRIP PREVIEW STATE FOR LIVE DRAGGING ===
  const [gripPreview, setGripPreview] = useState<{
    entityId: string;
    next: { vertices?: Point2D[]; start?: Point2D; end?: Point2D };
  } | null>(null);
  
  // === SELECTED REGIONS STATE FOR GRIP INTERACTION ===
  const selectedIdsRef = useRef<Set<string>>(new Set(selectedRegionIds));
  
  // Update selected regions ref when props change
  useEffect(() => {
    const newSelectedIds = new Set(selectedRegionIds);
    selectedIdsRef.current = newSelectedIds;
    if (DEBUG_CANVAS_CORE) console.log('🎯 [OverlayCanvasCore] Updated selectedIdsRef:', Array.from(newSelectedIds));
  }, [selectedRegionIds]);
  
  // Debug (μόνο σε development)
  const DEBUG = process.env.NODE_ENV !== 'production';

  // === CREATE MOCK SCENE FOR GRIP INTERACTION ===
  const mockScene = useCallback(() => {
    if (!visibleRegions?.length) return null;
    
    // Convert regions to polygon entities for grip interaction
    const entities = visibleRegions.map(region => {
      if (region.vertices?.length >= 2) {
        return {
          id: region.id,
          type: 'polygon',
          vertices: region.vertices,
        };
      }
      return null;
    }).filter(Boolean);

    return { entities };
  }, [visibleRegions]);

  // === GRIP INTERACTION SETUP ===
  const transformRef = useRef(transform);
  transformRef.current = transform;

  // Mock functions for grip interaction  
  const renderMock = useCallback((scene: any) => {
    // Trigger a re-render of the overlay
    const renderer = rendererRef.current;
    if (!renderer) return;
    
    renderer.renderOverlay(visibleRegions, transform, {
      showHandles,
      showLabels,
      selectedRegionIds,
      isDrawing,
      drawingVertices,
      drawingStatus,
      editingRegionId,
      mousePosition,
      gripSettings,
      gripInteractionState // === ΝΕΟ: ΠΡΟΣΘΕΣΑ GRIP STATE ===
    }, gripSettings, gripPreview); // === ΝΕΟ: ΠΕΡΑΣΑ GRIP PREVIEW ===
  }, [visibleRegions, transform, showHandles, showLabels, selectedRegionIds, 
      isDrawing, drawingVertices, drawingStatus, editingRegionId, mousePosition, gripSettings, gripInteractionState, gripPreview]);

  const setPreviewOverride = useCallback((preview: any) => {
    // ✅ FIXED: Implement live preview for grip dragging
    if (DEBUG_CANVAS_CORE) console.log('🎯 [OverlayCanvasCore] Setting grip preview:', preview);
    setGripPreview(preview);
  }, []);

  const onCommitLine = useCallback((entityId: string, next: { start?: Point2D; end?: Point2D; vertices?: Point2D[] }) => {
    if (DEBUG_CANVAS_CORE) console.log('🎯 [OverlayCanvas] Committing grip changes for region:', entityId, next);
    
    // Find the region to update
    const region = visibleRegions.find(r => r.id === entityId);
    if (!region) {
      console.warn('Region not found for grip update:', entityId);
      return;
    }

    // Update region vertices based on grip changes
    if (next.vertices) {
      // For polygon regions - update vertices directly
      if (DEBUG_CANVAS_CORE) console.log('🎯 Updating region vertices from', region.vertices.length, 'to', next.vertices.length);
      
      // 🎯 FIXED: Call parent callback to update region in store
      if (onVertexDrag) {
        // For full polygon updates, we need a special callback
        // Use a custom approach since onVertexDrag is designed for single vertex updates
        
        // Create a custom event to update the entire polygon
        const customEvent = new CustomEvent('overlay:polygon-update', {
          detail: {
            regionId: entityId,
            newVertices: next.vertices
          }
        });
        window.dispatchEvent(customEvent);
        
        if (DEBUG_CANVAS_CORE) console.log('🎯 Dispatched polygon update event for region:', entityId);
      } else {
        console.warn('🎯 No onVertexDrag callback provided - changes will be lost!');
      }
      
      if (DEBUG_CANVAS_CORE) console.log('🎯 New vertices:', next.vertices);
    } else if (next.start && next.end) {
      // For line-based regions - convert back to vertices
      const newVertices = [next.start, next.end];
      if (DEBUG_CANVAS_CORE) console.log('🎯 Updating region from line grips:', newVertices);
    }
  }, [visibleRegions]);

  // === POLYGON DRAG & DROP STATE ===
  const [polygonDragState, setPolygonDragState] = useState<{
    isDragging: boolean;
    draggedRegionId: string | null;
    startPoint: Point2D | null;
    originalVertices: Point2D[] | null;
  }>({
    isDragging: false,
    draggedRegionId: null,
    startPoint: null,
    originalVertices: null
  });

  // === REGION HIT TESTING ===
  const findRegionUnderCursor = useCallback((screenPt: Point2D) => {
    if (!visibleRegions?.length) return null;
    
    // Convert screen point to world coordinates using OVERLAY coordinate system (not UGS)
    // This ensures overlays stay in same position when switching between draw/edit modes
    const worldPt = {
      x: (screenPt.x - transform.offsetX) / transform.scale,
      y: (screenPt.y - transform.offsetY) / transform.scale
    };
    
    // Check each region to see if point is inside
    for (const region of visibleRegions) {
      if (region.vertices?.length >= 3) {
        // Point-in-polygon test
        if (isPointInPolygon(worldPt, region.vertices)) {
          return region;
        }
      }
    }
    return null;
  }, [visibleRegions, transform]);

  // Point in polygon helper function
  const isPointInPolygon = useCallback((point: Point2D, vertices: Point2D[]) => {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i].x, yi = vertices[i].y;
      const xj = vertices[j].x, yj = vertices[j].y;
      
      if (((yi > point.y) !== (yj > point.y)) &&
          (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }, []);

  // === MOCK ENTITY RENDERER FOR GRIP INTERACTION ===
  const mockEntityRenderer = useRef({
    setGripInteractionState: (state: any) => {
      if (DEBUG_CANVAS_CORE) console.log('🎯 [OverlayCanvas] Setting grip interaction state:', state);
      setGripInteractionState(state || {});
    }
  });

  // Store current scene for grip interaction
  const [currentMockScene, setCurrentMockScene] = useState<any>(null);
  
  // Update mock scene when regions change
  useEffect(() => {
    const newScene = mockScene();
    if (DEBUG_CANVAS_CORE) console.log('🎯 [OverlayCanvasCore] Updating mock scene for grip interaction:', {
      entitiesCount: newScene?.entities?.length || 0,
      selectedRegions: selectedRegionIds,
      visibleRegionsCount: visibleRegions?.length || 0,
      entities: newScene?.entities?.map(e => ({ id: e.id, type: e.type, verticesCount: e.vertices?.length }))
    });
    setCurrentMockScene(newScene);
  }, [visibleRegions, selectedRegionIds, mockScene]);

  // Initialize grip interaction with snap support
  const gripInteraction = useGripInteraction({
    scene: currentMockScene,
    selectedIdsRef,
    transformRef,
    canvasRef,
    entityRendererRef: mockEntityRenderer,
    render: renderMock,
    gripSettings,
    setPreviewOverride,
    onCommitLine,
    setCursor,
    snapEnabled: snapEnabled || false, // Enable snapping
    findSnapPoint: findSnapPoint || undefined, // Pass snap function
  });

  // === ENHANCED MOUSE HANDLERS WITH GRIP SUPPORT ===
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // 🎨 Allow overlay hover effects even when unified engine is drawing
    
    if (DEBUG_CANVAS_CORE) console.log('🔍 [OverlayCanvasCore] handleMouseMove called - LAYER SYSTEM IS ACTIVE');
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenPt = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    // Check for grip hover first (higher priority)
    const gripHandled = gripInteraction.onMouseMoveGrip(screenPt);
    
    if (gripInteraction.isDraggingRef.current) {
      gripInteraction.onMouseMoveDrag(screenPt);
      
      // Cancel polygon drag if grip drag is active
      if (polygonDragState.isDragging) {
        if (DEBUG_CANVAS_CORE) console.log('🚫 [PolygonDrag] Cancelling polygon drag due to grip drag');
        setPolygonDragState({
          isDragging: false,
          draggedRegionId: null,
          startPoint: null,
          originalVertices: null
        });
      }
    } else if (polygonDragState.isDragging) {
      // Handle polygon drag
      const worldPt = {
        x: (screenPt.x - transform.offsetX) / transform.scale,
        y: (screenPt.y - transform.offsetY) / transform.scale
      };
      
      const deltaX = worldPt.x - polygonDragState.startPoint!.x;
      const deltaY = worldPt.y - polygonDragState.startPoint!.y;
      
      // Update polygon vertices
      const newVertices = polygonDragState.originalVertices!.map(vertex => ({
        x: vertex.x + deltaX,
        y: vertex.y + deltaY
      }));
      
      if (DEBUG_CANVAS_CORE) console.log('🏗️ [PolygonDrag] Moving region:', polygonDragState.draggedRegionId, 'delta:', deltaX.toFixed(2), deltaY.toFixed(2));
      
      // Update the region (you'll need to implement this callback)
      if (onRegionUpdate && polygonDragState.draggedRegionId) {
        onRegionUpdate(polygonDragState.draggedRegionId, { vertices: newVertices });
      }
    } else if (!gripHandled) {
      // Check for region hover (for white dashed border effect) - ONLY if no grip is hovered
      const hoveredRegion = findRegionUnderCursor(screenPt);
      
      if (hoveredRegion) {
        if (DEBUG_CANVAS_CORE) console.log('🎯 [OverlayCanvas] Region hovered:', hoveredRegion.id);
        setGripInteractionState({
          hovered: { entityId: hoveredRegion.id, gripIndex: -1 }
        });
        setCursor('pointer');
      } else {
        setGripInteractionState({});
        setCursor('crosshair');
      }
      
      // Call original mouse move handler
      onMouseMove(e);
    } else {
      // gripHandled is true - don't override grip cursor, just call original handler
      onMouseMove(e);
    }
  }, [onMouseMove, gripInteraction, findRegionUnderCursor, isDrawing, polygonDragState, transform, onRegionUpdate, setGripInteractionState, setCursor]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // 🎨 Allow grip interactions even when unified engine is drawing
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenPt = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    // Check for grip click first (higher priority)
    const gripHandled = gripInteraction.onMouseDownGrip(screenPt);
    
    if (!gripHandled && !gripInteraction.isDraggingRef.current) {
      // Check for polygon drag (middle priority) - ONLY if no grip is being dragged
      const hitRegion = findRegionUnderCursor(screenPt);
      if (hitRegion && selectedRegionIds.includes(hitRegion.id)) {
        // Start polygon drag
        if (DEBUG_CANVAS_CORE) console.log('🏗️ [PolygonDrag] Starting drag for region:', hitRegion.id);
        const worldPt = {
          x: (screenPt.x - transform.offsetX) / transform.scale,
          y: (screenPt.y - transform.offsetY) / transform.scale
        };
        
        setPolygonDragState({
          isDragging: true,
          draggedRegionId: hitRegion.id,
          startPoint: worldPt,
          originalVertices: [...(hitRegion.vertices || [])]
        });
        
        setCursor('grabbing');
        return; // Don't call original handler
      }
      
      // Call original mouse down handler (lowest priority)
      onMouseDown(e);
    }
  }, [onMouseDown, gripInteraction, isDrawing, findRegionUnderCursor, selectedRegionIds, transform, setPolygonDragState, setCursor]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (gripInteraction.isDraggingRef.current) {
      gripInteraction.onMouseUpDrag();
    } else if (polygonDragState.isDragging) {
      // End polygon drag
      if (DEBUG_CANVAS_CORE) console.log('🏗️ [PolygonDrag] Ending drag for region:', polygonDragState.draggedRegionId);
      
      setPolygonDragState({
        isDragging: false,
        draggedRegionId: null,
        startPoint: null,
        originalVertices: null
      });
      
      setCursor('pointer');
    } else {
      // Check for region click if onRegionClick is provided
      if (onRegionClick) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const screenPt = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
          };
          const hitRegion = findRegionUnderCursor(screenPt);
          if (hitRegion) {
            onRegionClick(hitRegion.id);
            return; // Don't call original handler if region was clicked
          }
        }
      }
      
      // Call original mouse up handler
      onMouseUp(e);
    }
  }, [onMouseUp, gripInteraction, onRegionClick, findRegionUnderCursor, polygonDragState, setPolygonDragState, setCursor]);

  const renderOverlay = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    
    // === GUARD: Skip overlay preview only if unified engine is drawing DXF entities (not overlays) ===
    // ΣΗΜ: Για το layering, το unified engine σχεδιάζει polyline που μετατρέπεται σε overlay,
    // οπότε εδώ χρειαζόμαστε τη βοήθεια του overlay renderer για final rendering
    if (DEBUG_CANVAS_CORE) console.log('🎨 [OverlayCanvasCore] Rendering overlay preview (unified engine coexistence)');
    
    // Clean debug log (όχι spam)
    if (DEBUG) {
      if (DEBUG_CANVAS_CORE) console.log('🎨 [OverlayCanvasCore] RAF render triggered');
    }
    
    // === PASS GRIP SETTINGS AND PREVIEW TO RENDERER ===
    renderer.renderOverlay(visibleRegions, transform, {
      showHandles,
      showLabels,
      selectedRegionIds,
      isDrawing,
      drawingVertices,
      drawingStatus,
      editingRegionId,
      mousePosition: isDrawing ? mousePosition || undefined : undefined
    }, gripSettings, gripPreview);
  }, [
    visibleRegions, transform, showHandles, showLabels, selectedRegionIds,
    isDrawing, drawingVertices, drawingStatus, editingRegionId, mousePosition,
    gripSettings, gripPreview, DEBUG
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    rendererRef.current = new OverlayRenderer(canvas);
    onRendererReady(rendererRef.current);
    
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      
      // Trigger render after resize
      requestAnimationFrame(renderOverlay);
    };
    
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [onRendererReady, renderOverlay]);

  // === OPTIMIZED: RAF render on grip settings change ===
  useEffect(() => {
    // Cancel previous frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Schedule new render
    animationFrameRef.current = requestAnimationFrame(renderOverlay);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [renderOverlay]);

  return (
    <div className={`relative w-full h-full ${className || ''}`}>
      
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-auto"
        style={{ zIndex: 10, cursor }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={onMouseLeave}
        onContextMenu={onContextMenu}
      />
      
      {/* Debug overlay (μόνο development) */}
      {DEBUG && (
        <div className="absolute top-2 right-2 text-xs text-white bg-black bg-opacity-75 p-2 rounded">
          <div>Regions: {visibleRegions.length}</div>
          <div>GripSize: {gripSettings.gripSize}</div>
          <div>Handles: {showHandles ? 'ON' : 'OFF'}</div>
        </div>
      )}
    </div>
  );
}
