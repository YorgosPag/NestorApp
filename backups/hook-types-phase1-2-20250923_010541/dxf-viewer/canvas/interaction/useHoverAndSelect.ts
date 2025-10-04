import { useEffect, useRef } from 'react';
import { HILITE_EVENT, publishHighlight } from '../../events/selection-bus';
import { UnifiedEntitySelection } from '../../utils/unified-entity-selection';
import type { Point2D, ViewTransform } from '../../systems/rulers-grid/config';
import type { SceneModel } from '../../types/scene';

interface UseHoverAndSelectArgs {
  scene: SceneModel | null;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  transformRef: React.MutableRefObject<ViewTransform>;
  selectedIdsRef: React.MutableRefObject<Set<string>>;
  hoverIdRef: React.MutableRefObject<string | null>;
  renderImmediate: (scene: SceneModel) => void;
  activeTool?: string;
  isDraggingRef?: React.MutableRefObject<boolean>; // ✅ για να αγνοούμε hover όσο σέρνουμε
  setCursor?: (cursor: string) => void; // ✅ για να ορίζει πάντα crosshair cursor
}

export function useHoverAndSelect(args: UseHoverAndSelectArgs) {
  const {
    scene, canvasRef, transformRef,
    selectedIdsRef, hoverIdRef, renderImmediate, activeTool, isDraggingRef, setCursor
  } = args;

  const hitTest = (pt: Point2D) => {
    if (!scene || !scene.entities?.length) return null;
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect(); // ✅ ο ΣΩΣΤΟΣ rect του καμβά
    return UnifiedEntitySelection.findEntityAtPoint(
      pt,
      scene.entities,
      scene.layers,
      transformRef.current,
      rect,
      8 // tolerance px
    );
  };

  const onMouseMoveEntityHover = (pt: Point2D) => {
    if (activeTool && activeTool !== 'select') return;
    
    // ✅ Always maintain crosshair cursor in select mode
    if (setCursor) {
      setCursor('crosshair');
    }
    
    const hit = hitTest(pt);
    const id = hit?.entity.id ?? null;
    
    // ✅ New hover logic: Disable ALL hover when ANY entity is selected
    // This prevents confusion and visual noise when working with grips
    const hasAnySelection = selectedIdsRef.current.size > 0;
    const isDragging = isDraggingRef?.current || false;
    
    let actualHoverId: string | null;
    if (hasAnySelection) {
      // ✅ NO hover for ANY entity when there's a selection (prevents grip interference)
      actualHoverId = null;
    } else {
      // Only show hover when NO entities are selected
      actualHoverId = id;
    }
    
    if (actualHoverId !== hoverIdRef.current) {
      hoverIdRef.current = actualHoverId;
      publishHighlight({ ids: actualHoverId ? [actualHoverId] : [], mode: 'hover' });
      if (scene) renderImmediate(scene);
    }
  };

  const onMouseDownEntitySelect = (pt: Point2D) => {
    if (activeTool && activeTool !== 'select') return;
    const hit = hitTest(pt);
    if (hit) {
      selectedIdsRef.current = new Set([hit.entity.id]);
      publishHighlight({ ids: [hit.entity.id], mode: 'select' });
    } else {
      // ✅ Click στο κενό χωρίς Ctrl: καθαρίζει επιλογή
      // (Το Ctrl+click στο κενό δεν φτάνει ποτέ εδώ γιατί γίνεται return πιο πριν)
      selectedIdsRef.current.clear();
      publishHighlight({ ids: [], mode: 'select' });
      console.debug('🎯 Cleared selection - click on empty space');
    }
    if (scene) renderImmediate(scene);
  };

  const onMouseLeave = () => {
    hoverIdRef.current = null;
    publishHighlight({ ids: [], mode: 'hover' });
    if (scene) renderImmediate(scene);
  };

  // listener του bus με coalescing με requestAnimationFrame
  useEffect(() => {
    let rafToken: number | null = null;
    
    const onHighlight = (ev: Event) => {
      // ⛔ αγνοούμε hover/select όσο σέρνουμε
      if (isDraggingRef?.current) return;
      
      const { ids = [], mode = 'select' } = (ev as CustomEvent<any>).detail || {};
      
      // ✅ γράψε στα refs
      if (mode === 'select') selectedIdsRef.current = new Set(ids);
      else hoverIdRef.current = ids[0] ?? null;

      if (!scene) return;

      // ✅ coalesce τα renders με RAF
      if (rafToken) cancelAnimationFrame(rafToken);
      rafToken = requestAnimationFrame(() => {
        if (scene) renderImmediate(scene);
        rafToken = null;
      });
    };
    
    window.addEventListener('dxf.highlightByIds', onHighlight as EventListener);
    return () => {
      if (rafToken) cancelAnimationFrame(rafToken);
      window.removeEventListener('dxf.highlightByIds', onHighlight as EventListener);
    };
  }, [scene, renderImmediate]);

  return {
    onMouseMoveEntityHover,
    onMouseDownEntitySelect,
    onMouseLeave
  };
}