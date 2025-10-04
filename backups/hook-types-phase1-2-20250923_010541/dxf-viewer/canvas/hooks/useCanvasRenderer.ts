/**
 * Canvas Renderer Hook
 * Manages the renderer lifecycle and state
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import type { SceneModel } from '../../types/scene';

interface UseCanvasRendererOptions {
  scene: SceneModel | null;
  gripSettings: any;
  alwaysShowCoarseGrid?: boolean;
}

export function useCanvasRenderer(options: UseCanvasRendererOptions) {
  const { scene, gripSettings, alwaysShowCoarseGrid = true } = options;
  
  const rendererRef = useRef<any | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [currentScene, setCurrentScene] = useState<SceneModel | null>(scene);
  const [canvasRect, setCanvasRect] = useState<DOMRect | null>(null);
  const [isRendererReady, setIsRendererReady] = useState(false);

  // Handle renderer initialization
  const handleRendererReady = useCallback((renderer: any) => {
    rendererRef.current = renderer;
    const canvas = renderer.getCanvas();
    
    if (canvas) {
      canvasRef.current = canvas;
      const ctx = canvas.getContext('2d');
    }
    
    try {
      const rect = renderer.getCanvas?.()?.getBoundingClientRect?.();
      if (rect) setCanvasRect(rect);
    } catch (e) {
      console.warn('Failed to get canvas rect:', e);
    }
    
    if (currentScene) {
      requestAnimationFrame(() => {
        try {
          renderer.setScene(currentScene);
          renderer.fitToView(currentScene);
        } catch (e) {
          console.warn('fitToView failed:', e);
        }
      });
    }
    
    setIsRendererReady(true);
  }, [currentScene, gripSettings]);

  // Update scene when prop changes
  useEffect(() => {
    if (!scene) return;
    setCurrentScene(scene);
    
    if (rendererRef.current && isRendererReady) {
      try {
        rendererRef.current.setScene(scene);
        if (scene.entities.length > 0) {
          rendererRef.current.fitToView(scene);
        }
      } catch (e) {
        console.warn('fitToView on scene change failed:', e);
      }
    }
  }, [scene, isRendererReady]);


  // Renderer control methods
  const fitToView = useCallback(() => {
    if (rendererRef.current && currentScene) {
      rendererRef.current.fitToView(currentScene);
    }
  }, [currentScene]);

  const zoomIn = useCallback(() => {
    rendererRef.current?.zoomIn();
  }, []);

  const zoomOut = useCallback(() => {
    rendererRef.current?.zoomOut();
  }, []);

  const zoom = useCallback((factor: number, center?: { x: number; y: number }) => {
    rendererRef.current?.zoom(factor, center);
  }, []);

  const getTransform = useCallback(() => {
    return rendererRef.current?.getTransform?.() ?? { scale: 1, offsetX: 0, offsetY: 0 };
  }, []);

  const getCoordinateManager = useCallback(() => {
    return rendererRef.current?.getCoordinateManager?.();
  }, []);

  const renderScene = useCallback((scene: SceneModel, renderOptions?: any) => {
    if (rendererRef.current && isRendererReady) {
      rendererRef.current.renderScene(scene, renderOptions);
    }
  }, [isRendererReady]);

  const setSelectedEntityIds = useCallback((ids: string[]) => {
    rendererRef.current?.setSelectedEntityIds?.(ids);
  }, []);

  const clearCanvas = useCallback(() => {
    rendererRef.current?.clearCanvas?.();
  }, []);

  return {
    // Refs
    rendererRef,
    canvasRef,
    
    // State
    currentScene,
    canvasRect,
    isRendererReady,
    
    // Methods
    handleRendererReady,
    fitToView,
    zoomIn,
    zoomOut,
    zoom,
    getTransform,
    getCoordinateManager,
    renderScene,
    setSelectedEntityIds,
    clearCanvas,
    setCurrentScene
  };
}