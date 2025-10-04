/**
 * useCanvasActions
 * Manages canvas operations like zoom, undo/redo, and transform tracking
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import type { DxfCanvasRef } from '../../canvas/DxfCanvas';
import type { SceneModel } from '../../types/scene';
import { useSnapContext } from '../../snapping/context/SnapContext';
import { createCanvasZoomActions } from '../../utils/geometry-utils';

export function useCanvasActions(
  dxfCanvasRef: React.RefObject<DxfCanvasRef>,
  currentScene: SceneModel | null,
  selectedEntityIds: string[],
  handleSceneChange?: (scene: SceneModel) => void
) {
  const [currentZoom, setCurrentZoom] = useState(1.0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const { snapEnabled, setSnapEnabled } = useSnapContext();

  // Update undo/redo state when scene or selection changes
  useEffect(() => {
    if (dxfCanvasRef.current) {
      setCanUndo(dxfCanvasRef.current.canUndo());
      setCanRedo(dxfCanvasRef.current.canRedo());
    }
  }, [currentScene, selectedEntityIds, dxfCanvasRef]);

  // Update zoom from canvas transform
  const updateCurrentZoomFromCanvas = useCallback(() => {
    setTimeout(() => {
      if (dxfCanvasRef.current) {
        const transform = dxfCanvasRef.current.getTransform();
        if (transform?.scale) setCurrentZoom(transform.scale);
      }
    }, 50);
  }, [dxfCanvasRef]);

  // Handle various canvas actions
  const handleAction = useCallback((action: string, data?: any) => {
    const canvas = dxfCanvasRef.current;
    if (!canvas) return;

    switch (action) {
      case 'zoom-in-action': 
        canvas.zoomIn(); 
        updateCurrentZoomFromCanvas(); 
        break;
        
      case 'zoom-out-action': 
        canvas.zoomOut(); 
        updateCurrentZoomFromCanvas(); 
        break;
        
      case 'fit': 
        canvas.fitToView(); 
        setTimeout(updateCurrentZoomFromCanvas, 100); 
        break;
        
      case 'set-zoom':
        if (typeof data === 'number' && currentScene) {
          const coordinateManager = (canvas as any).getCoordinateManager?.();
          if (coordinateManager) {
            const currentTransform = canvas.getTransform();
            coordinateManager.setTransform({ ...currentTransform, scale: data });
            canvas.renderScene(currentScene);
            setCurrentZoom(data);
          }
        }
        break;
        
      case 'toggle-snap': 
        setSnapEnabled(!snapEnabled); 
        break;
        
      case 'autocrop': 
        console.log('🔧 AutoCrop action triggered'); 
        // TODO: Implement autocrop functionality
        break;
        
      case 'export':
        console.log('🔧 Export action triggered');
        // TODO: Implement export functionality
        break;
        
      case 'undo': 
        if (canvas.undo()) { 
          setCanUndo(canvas.canUndo()); 
          setCanRedo(canvas.canRedo()); 
        } 
        break;
        
      case 'redo': 
        if (canvas.redo()) { 
          setCanUndo(canvas.canUndo()); 
          setCanRedo(canvas.canRedo()); 
        } 
        break;
        
      case 'delete-selected':
        if (currentScene && selectedEntityIds.length > 0 && handleSceneChange) {
          console.log('🗑️ Deleting selected entities:', selectedEntityIds);
          const updatedScene = {
            ...currentScene,
            entities: currentScene.entities.filter(entity => !selectedEntityIds.includes(entity.id))
          };
          handleSceneChange(updatedScene);
          // Clear selection after deletion
          canvas.setSelectedEntityIds([]);
        } else {
          console.log('🔍 Cannot delete: no scene, no selected entities, or no scene change handler');
        }
        break;
        
      default: 
        console.log('🔍 Unhandled action:', action, data);
    }
  }, [dxfCanvasRef, updateCurrentZoomFromCanvas, currentScene, snapEnabled, setSnapEnabled, selectedEntityIds, handleSceneChange]);

  // Transform change handler
  const handleTransformChange = useCallback((transform: any) => {
    if (transform?.scale && typeof transform.scale === 'number') {
      setCurrentZoom(transform.scale);
    }
  }, []);

  // Zoom actions
  // Use shared zoom actions utility to eliminate duplicate code
  const { zoomIn, zoomOut, fitToView } = createCanvasZoomActions(
    dxfCanvasRef,
    updateCurrentZoomFromCanvas
  );

  return {
    // State
    currentZoom,
    canUndo,
    canRedo,
    snapEnabled,
    
    // Actions
    handleAction,
    handleTransformChange,
    zoomIn,
    zoomOut,
    fitToView,
    setSnapEnabled
  };
}