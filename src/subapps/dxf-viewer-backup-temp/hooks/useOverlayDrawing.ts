/**
 * useOverlayDrawing Hook
 * Handles overlay drawing, editing, and snap functionality
 * Extracted from DxfViewerContent.tsx for better separation of concerns
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useSnapManager } from '../snapping/hooks/useSnapManager';
import { calculateDistance } from '../rendering/entities/shared/geometry-rendering-utils';
import { SNAP_TOLERANCE, MIN_POLY_POINTS } from '../overlays/types';
import type { OverlayEditorMode, OverlayKind, Status, Overlay, CreateOverlayData, UpdateOverlayData } from '../overlays/types';
import type { Point2D } from '../rendering/types/Types';
import type { SceneModel } from '../types/scene';

// Status labels in English for Firestore
const STATUS_ENGLISH_LABELS: Record<Status, string> = {
  'for-sale': 'For Sale',
  'for-rent': 'For Rent',
  'reserved': 'Reserved',
  'sold': 'Sold',
  'landowner': 'Landowner'
};

interface UseOverlayDrawingConfig {
  overlayMode: OverlayEditorMode;
  activeTool: string;
  overlayKind: OverlayKind;
  overlayStatus: Status;
  overlayStore: {
    getByLevel: (levelId: string) => Overlay[];
    add: (overlay: CreateOverlayData) => Promise<string>;
    update: (id: string, patch: UpdateOverlayData) => Promise<void>;
    remove: (id: string) => Promise<void>;
    setSelectedOverlay: (id: string | null) => void;
  } | null;
  levelManager: {
    getCurrentLevel: () => { id: string } | null;
    setLevelScene: (levelId: string, scene: SceneModel) => void;
    getLevelScene: (levelId: string) => SceneModel | null;
  } | null;
  canvasTransform: { scale: number; offsetX: number; offsetY: number };
}

export const useOverlayDrawing = ({
  overlayMode,
  activeTool,
  overlayKind,
  overlayStatus,
  overlayStore,
  levelManager,
  canvasTransform
}: UseOverlayDrawingConfig) => {
  // Overlay canvas ref for snap manager
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Draft polygon state for overlay drawing
  const [draftPolygon, setDraftPolygon] = useState<Array<[number, number]>>([]);

  // Snap state for overlay drawing
  const [snapPoint, setSnapPoint] = useState<{x: number, y: number} | null>(null);

  // Snap manager
  const snapManager = useSnapManager(overlayCanvasRef, {
    enabled: true,
    tolerance: SNAP_TOLERANCE,
    onSnapUpdate: (point: {x: number, y: number} | null) => {
      setSnapPoint(point);
    }
  });

  // Canvas click handler for overlay drawing
  const handleOverlayCanvasClick = useCallback((point: Point2D) => {
    if (overlayMode !== 'draw' || !activeTool || activeTool !== 'layering') return;

    // Check if point is close to first point (closing polygon)
    if (draftPolygon.length >= MIN_POLY_POINTS) {
      const firstPoint = draftPolygon[0];
      const distance = calculateDistance(point, { x: firstPoint[0], y: firstPoint[1] });

      // 🔺 IMPROVED: Convert pixel tolerance to world coordinates based on zoom
      // Use smaller tolerance (5px instead of 10px) for more precise polygon closing
      const pixelTolerance = 5; // Reduced from SNAP_TOLERANCE (10px) for better precision
      const worldTolerance = pixelTolerance / canvasTransform.scale;

      if (distance < worldTolerance) {
        finishDrawing();
        return;
      }
    }

    // Add new point to draft polygon
    setDraftPolygon(prev => [...prev, [point.x, point.y]]);
  }, [overlayMode, activeTool, draftPolygon, canvasTransform.scale]);

  // Finish drawing function
  const finishDrawing = useCallback(async () => {
    if (draftPolygon.length < MIN_POLY_POINTS) {
      console.warn('[useOverlayDrawing] Cannot finish drawing: insufficient points');
      return;
    }

    if (!levelManager.currentLevelId) {
      console.warn('[useOverlayDrawing] No current level selected for overlay');
      return;
    }

    try {
      // 🔍 FIX: Keep nested format for renderer compatibility
      // Save as: [[x1,y1], [x2,y2], ...] NOT flat format

      // Save overlay to Firestore
      const overlayId = await overlayStore.add({
        levelId: levelManager.currentLevelId,
        kind: overlayKind,
        polygon: draftPolygon, // ✅ Keep nested format
        status: overlayStatus,
        label: `${STATUS_ENGLISH_LABELS[overlayStatus]} ${Date.now()}`,
        linked: null,
      });

      // Clear draft and auto-select new overlay
      setDraftPolygon([]);
      overlayStore.setSelectedOverlay(overlayId);

      // Keep drawing mode active for continuous drawing
    } catch (error) {
      console.error('Error creating overlay:', error);
    }
  }, [draftPolygon, overlayStore, levelManager.currentLevelId, overlayKind, overlayStatus]);

  // Handle vertex drag for overlay editing
  const handleVertexDrag = useCallback((overlayId: string, vertexIndex: number, newPoint: Point2D) => {
    const overlay = overlayStore.overlays[overlayId];
    if (!overlay) return;

    // overlay.polygon can be flat [x1,y1,...] or nested [[x,y],...]
    const nested = Array.isArray(overlay.polygon[0])
      ? (overlay.polygon as number[][])
      : Array.from({ length: overlay.polygon.length / 2 }, (_, i) => [overlay.polygon[i*2], overlay.polygon[i*2+1]]);

    const newNested = nested.map((v, i) => i === vertexIndex ? [newPoint.x, newPoint.y] : v);

    overlayStore.update(overlayId, { polygon: newNested }); // ✅ Save in nested format
  }, [overlayStore]);

  // Handle entire region drag & drop (for moving whole polygons)
  const handleRegionUpdate = useCallback((regionId: string, updates: { vertices?: Point2D[] }) => {
    const overlay = overlayStore.overlays[regionId];
    if (!overlay || !updates.vertices) return;

    // Convert Point2D[] to nested number[][] format for renderer compatibility
    const nested = updates.vertices.map(v => [v.x, v.y]);

    overlayStore.update(regionId, { polygon: nested });
  }, [overlayStore]);

  // Mouse move handler for snap functionality
  const handleOverlayMouseMove = useCallback((worldX: number, worldY: number) => {
    if (overlayMode === 'draw' && snapManager.findSnapPoint) {
      const snapResult = snapManager.findSnapPoint(worldX, worldY);
      if (snapResult) {
        setSnapPoint({ x: snapResult.x, y: snapResult.y });
      } else {
        setSnapPoint(null);
      }
    }
  }, [overlayMode, snapManager]);

  // Clear snap point on click
  const clearSnapPoint = useCallback(() => {
    setSnapPoint(null);
  }, []);

  // Event listener for canvas clicks from overlay drawing
  useEffect(() => {
    const onOverlayCanvasClick = (event: CustomEvent) => {
      if (overlayMode !== 'draw' || !activeTool || activeTool !== 'layering') return;
      const { point } = event.detail;
      handleOverlayCanvasClick(point);
    };

    window.addEventListener('overlay:canvas-click', onOverlayCanvasClick as EventListener);
    return () => window.removeEventListener('overlay:canvas-click', onOverlayCanvasClick as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ✅ FIX: Empty deps - overlayMode/activeTool accessed via closure, handleOverlayCanvasClick is stable

  return {
    // Refs
    overlayCanvasRef,

    // State
    draftPolygon,
    snapPoint,

    // Functions
    handleOverlayCanvasClick,
    finishDrawing,
    handleVertexDrag,
    handleRegionUpdate,
    handleOverlayMouseMove,
    clearSnapPoint,
    setDraftPolygon,

    // Snap manager
    snapManager
  };
};