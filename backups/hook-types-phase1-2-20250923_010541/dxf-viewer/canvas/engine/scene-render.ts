import type { SceneModel, AnySceneEntity } from '../../types/scene';
import type { Point2D, ViewTransform } from '../../systems/rulers-grid/config';
import type { AnyMeasurement } from '../../types/measurements';
import { MeasurementRenderer } from '../../utils/measurement-tools';
import { EntityRenderer } from '../../utils/entity-renderer';
import type { GripSettings } from '../../types/gripSettings';
// Old rulers-grid system removed - only use new RulersGridSystem
import { getLayerColor } from '../../config/color-config';
// Import RulersGrid utilities and types
import { RulersGridCalculations, RulersGridRendering } from '../../systems/rulers-grid/utils';
import type { GridSettings, RulerSettings } from '../../systems/rulers-grid/config';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_SCENE_RENDER = false;


export interface RenderOptions {
  measurementRenderer?: MeasurementRenderer;
  measurements?: AnyMeasurement[];
  tempMeasurementPoints?: Point2D[];
  mousePosition?: Point2D;
  drawingState?: { previewEntity?: AnySceneEntity };
  selectedIdsRef: React.MutableRefObject<Set<string>>;
  hoverIdRef: React.MutableRefObject<string | null>;
  previewOverrideRef?: React.MutableRefObject<{ entityId: string; next: any } | null>; // ✅ overlay preview
  marqueeOverlayRef?: React.MutableRefObject<{ start: Point2D; end: Point2D } | null>; // ✅ marquee overlay
  rulersGridSettings?: {
    grid: GridSettings;
    rulers: RulerSettings;
    origin: Point2D;
  };
}

export function renderScene(args: {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  scene: SceneModel;
  entityRenderer: EntityRenderer;
  transformRef: React.MutableRefObject<ViewTransform>;
  gripSettings: GripSettings;
  alwaysShowCoarseGrid: boolean;
  options?: RenderOptions;
}) {
  const {
    ctx,
    canvas,
    scene,
    entityRenderer,
    transformRef,
    gripSettings,
    alwaysShowCoarseGrid,
    options = {}
  } = args;
  
  if (DEBUG_SCENE_RENDER) console.log(`🚀 [scene-render] START: entities=${scene?.entities?.length || 0}`);

  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  
  entityRenderer.setTransform(transformRef.current);

  // ✅ DEBUG: Έλεγχος grip settings
  if (DEBUG_SCENE_RENDER) console.log('🔍 [scene-render] Grip Settings passed to EntityRenderer:', {
    showGrips: gripSettings?.showGrips,
    gripSize: gripSettings?.gripSize,
    enabled: gripSettings?.enabled,
    allProps: Object.keys(gripSettings || {}).join(', ')
  });

  entityRenderer.setGripSettings(gripSettings);
  
  
  // ✅ Extract preview override για overlay system
  const previewOv = options.previewOverrideRef?.current; // {entityId, next} | null
  
  // ✅ Get selected and hovered IDs from refs FIRST
  const selectedIds = options.selectedIdsRef?.current ?? new Set<string>();
  const hoverId = options.hoverIdRef?.current ?? null;
  
  if (DEBUG_SCENE_RENDER) console.log(`🎯 [scene-render] START: selectedIds size=${selectedIds.size}, hoverId=${hoverId}`);
  
  // ✅ 1) Regular pass (authentic, no grips) - SKIP selected AND hovered entities
  scene.entities.forEach(entity => {
    // ✅ Skip selected entities - they will render with grips in the selected pass
    if (selectedIds.has(entity.id)) {
      if (entity.type === 'rectangle') {
        if (DEBUG_SCENE_RENDER) console.log(`🎯 [scene-render] SKIP regular pass for selected rectangle ${entity.id}`);
      }
      return;
    }
    
    // ✅ Skip hovered entities - they will render in the hover pass
    if (hoverId === entity.id) {
      if (entity.type === 'rectangle') {
        if (DEBUG_SCENE_RENDER) console.log(`🎯 [scene-render] SKIP regular pass for hovered rectangle ${entity.id}`);
      }
      return;
    }
    
    if (scene.layers[entity.layer]?.visible !== false) {
      entity.color = getLayerColor(entity.layer);
      
      // ✅ αν υπάρχει preview για αυτό το entity, το ζωγραφίζουμε με την "next" γεωμετρία
      const drawEntity = (previewOv && previewOv.entityId === entity.id)
        ? { ...entity, ...previewOv.next }
        : entity;
      
      if (entity.type === 'rectangle') {
        if (DEBUG_SCENE_RENDER) console.log(`🎯 [scene-render] Regular pass rendering rectangle ${entity.id}`);
      }
      entityRenderer.renderEntity(drawEntity, null, false); // authentic style, NO grips
    }
  });

  // ΝΕΟΣ ΚΩΔΙΚΑΣ: Render preview entity από drawingState
  if (options.drawingState?.previewEntity) {
    const previewEntity = options.drawingState.previewEntity;
    // Reduced spam: console.log('[scene-render] Rendering preview entity:', previewEntity.type);

    // ✅ ΚΡΙΣΙΜΗ ΔΙΟΡΘΩΣΗ: Check για showPreviewGrips flag
    const shouldShowGrips = (previewEntity as any).showPreviewGrips === true;
    if (DEBUG_SCENE_RENDER) console.log('🎯 [scene-render] Preview entity grips flag:', shouldShowGrips);

    // 🎯 Let the 3-phase system handle preview styling (blue dashed with measurements)
    entityRenderer.renderEntity(previewEntity, null, shouldShowGrips);
  }


  // ✅ 2) Selected pass (authentic + grips) with preview override support
  scene.entities.forEach(entity => {
    if (selectedIds.has(entity.id) && scene.layers[entity.layer]?.visible !== false) {
      // ✅ χρησιμοποίησε το drawEntity με τον ίδιο τρόπο για να μη «επιστρέφει»
      const drawEntity = (previewOv && previewOv.entityId === entity.id)
        ? { ...entity, ...previewOv.next }
        : entity;
      
      // ✅ Αν το selected entity είναι και hovered, περάσε '#FFFFFF' για hover effect
      const isHovered = hoverId === entity.id;
      const strokeOverride = isHovered ? '#FFFFFF' : null;
      
      if (entity.type === 'rectangle') {
        if (DEBUG_SCENE_RENDER) console.log(`🎯 [scene-render] Selected pass for rectangle ${entity.id}: isHovered=${isHovered}, strokeOverride=${strokeOverride}`);
      }
      
      entityRenderer.renderEntity(drawEntity, strokeOverride, true);  // authentic + grips, με hover αν χρειάζεται
    }
  });

  // ✅ 3) Hover pass (white dashed + grips) — μόνο αν το hovered δεν είναι ήδη selected
  if (hoverId && !selectedIds.has(hoverId)) {
    const hovered = scene.entities.find(e => e.id === hoverId);
    if (hovered && scene.layers[hovered.layer]?.visible !== false) {
      // ✅ χρησιμοποίησε το preview override και για το hover
      const drawEntity = (previewOv && previewOv.entityId === hovered.id)
        ? { ...hovered, ...previewOv.next }
        : hovered;
        
      entityRenderer.renderEntity(drawEntity, '#FFFFFF', true); // ✅ dashed + grips
    }
  }
  
  // ✅ 4) Marquee overlay (AutoCAD-style window/crossing selection)
  const marqueeOverlay = options.marqueeOverlayRef?.current;
  if (marqueeOverlay) {
    const a = marqueeOverlay.start, b = marqueeOverlay.end;
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    const w = Math.abs(a.x - b.x), h = Math.abs(a.y - b.y);
    const ltr = b.x >= a.x; // left-to-right → Window (inside only)

    ctx.save();
    ctx.lineWidth = 1;
    if (ltr) {
      // Window: Μπλε συμπαγές περίγραμμα
      ctx.strokeStyle = 'rgba(33,150,243,0.9)';
      ctx.fillStyle = 'rgba(33,150,243,0.15)';
      ctx.setLineDash([]); // solid
    } else {
      // Crossing: Πράσινο διακεκομμένο
      ctx.strokeStyle = 'rgba(76,175,80,0.9)';
      ctx.fillStyle = 'rgba(76,175,80,0.12)';
      ctx.setLineDash([8, 6]);
    }
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }
  
  // Measurements
  if (options.measurementRenderer) {
    options.measurementRenderer.setTransform(transformRef.current);
    
    if (options.measurements?.length > 0) {
      options.measurementRenderer.renderMeasurements(options.measurements, canvas.getBoundingClientRect());
    }

    if (options.tempMeasurementPoints?.length > 0 && options.mousePosition) {
      options.measurementRenderer.renderTemporaryMeasurement(
        options.tempMeasurementPoints, 
        options.mousePosition, 
        canvas.getBoundingClientRect()
      );
    }
  }

  // Render rulers and grid using new RulersGridSystem
  if (DEBUG_SCENE_RENDER) console.log('🔍 [scene-render] About to render rulers/grid');
  if (DEBUG_SCENE_RENDER) console.log('🔍 [scene-render] options.rulersGridSettings exists:', !!options.rulersGridSettings);
  if (DEBUG_SCENE_RENDER) console.log('🔍 [scene-render] alwaysShowCoarseGrid:', alwaysShowCoarseGrid);
  
  if (options.rulersGridSettings) {
    if (DEBUG_SCENE_RENDER) console.log('🔍 [scene-render] Using NEW RulersGridSystem');
    const { grid, rulers, origin } = options.rulersGridSettings;
    if (DEBUG_SCENE_RENDER) console.log('🔍 [scene-render] Grid enabled:', grid.visual.enabled);
    if (DEBUG_SCENE_RENDER) console.log('🔍 [scene-render] Grid color:', grid.visual.color);
    if (DEBUG_SCENE_RENDER) console.log('🔍 [scene-render] Rulers H enabled:', rulers.horizontal.enabled);
    if (DEBUG_SCENE_RENDER) console.log('🔍 [scene-render] Rulers V enabled:', rulers.vertical.enabled);
    
    const canvasRect = { width: rect.width, height: rect.height };
    
    // Calculate bounds for the current view
    const bounds = RulersGridCalculations.calculateVisibleBounds(
      transformRef.current,
      canvasRect,
      grid.visual.step
    );
    if (DEBUG_SCENE_RENDER) console.log('🔍 [scene-render] Calculated bounds:', bounds);
    
    // Render grid if enabled
    if (grid.visual.enabled) {
      if (DEBUG_SCENE_RENDER) console.log('🔍 [scene-render] Rendering grid with new system');
      const gridLines = RulersGridCalculations.generateGridLines(bounds, grid, transformRef.current);
      if (DEBUG_SCENE_RENDER) console.log('🔍 [scene-render] Generated grid lines:', gridLines.length);
      RulersGridRendering.renderGridLines(ctx, gridLines, transformRef.current);
    } else {
      if (DEBUG_SCENE_RENDER) console.log('🔍 [scene-render] Grid disabled in settings');
    }
    
    // Calculate rulers layout
    const layout = RulersGridCalculations.calculateLayout(canvasRect, rulers);
    
    // Render rulers if enabled
    if (rulers.horizontal.enabled || rulers.vertical.enabled) {
      if (DEBUG_SCENE_RENDER) console.log('🟦🟦🟦 [scene-render] RENDERING RULERS WITH NEW SYSTEM:', {
        horizontalEnabled: rulers.horizontal.enabled,
        verticalEnabled: rulers.vertical.enabled,
        canvasSize: { width: canvas.width, height: canvas.height },
        message: '*** RULERS RENDERING STARTED ***'
      });
      // Create temporary canvases for rulers
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      
      if (tempCtx) {
        // First draw ruler backgrounds
        if (DEBUG_SCENE_RENDER) console.log('🟦🟦🟦 [scene-render] DRAWING RULER BACKGROUNDS');
        
        // Horizontal ruler background (bottom)
        if (rulers.horizontal.enabled && rulers.horizontal.showBackground) {
          if (DEBUG_SCENE_RENDER) console.log('🟦🟦🟦 [scene-render] DRAWING HORIZONTAL RULER BACKGROUND');
          tempCtx.fillStyle = rulers.horizontal.backgroundColor || '#f0f0f0';
          tempCtx.fillRect(0, canvas.height - (rulers.horizontal.height || 30), canvas.width, rulers.horizontal.height || 30);
        }
        
        // Vertical ruler background (left)
        if (rulers.vertical.enabled && rulers.vertical.showBackground) {
          if (DEBUG_SCENE_RENDER) console.log('🟦🟦🟦 [scene-render] DRAWING VERTICAL RULER BACKGROUND');
          tempCtx.fillStyle = rulers.vertical.backgroundColor || '#f0f0f0';
          tempCtx.fillRect(0, 0, rulers.vertical.width || 30, canvas.height);
        }
        
        // Render horizontal ruler
        if (rulers.horizontal.enabled) {
          if (DEBUG_SCENE_RENDER) console.log('🟦🟦🟦 [scene-render] RENDERING HORIZONTAL RULER:', {
            bounds,
            rulerSettings: rulers.horizontal,
            message: '*** HORIZONTAL RULER RENDERING ***'
          });
          const horizontalTicks = RulersGridCalculations.calculateTicks(
            'horizontal', bounds, rulers, transformRef.current, canvasRect
          );
          if (DEBUG_SCENE_RENDER) console.log('🟦🟦🟦 [scene-render] HORIZONTAL TICKS CALCULATED:', horizontalTicks.length, 'ticks');
          RulersGridRendering.renderRuler(tempCtx, horizontalTicks, rulers.horizontal, 'horizontal');
        }
        
        // Render vertical ruler  
        if (rulers.vertical.enabled) {
          if (DEBUG_SCENE_RENDER) console.log('🟦🟦🟦 [scene-render] RENDERING VERTICAL RULER:', {
            bounds,
            rulerSettings: rulers.vertical,
            message: '*** VERTICAL RULER RENDERING ***'
          });
          const verticalTicks = RulersGridCalculations.calculateTicks(
            'vertical', bounds, rulers, transformRef.current, canvasRect
          );
          if (DEBUG_SCENE_RENDER) console.log('🟦🟦🟦 [scene-render] VERTICAL TICKS CALCULATED:', verticalTicks.length, 'ticks');
          RulersGridRendering.renderRuler(tempCtx, verticalTicks, rulers.vertical, 'vertical');
        }
        
        // Copy rulers to main canvas
        if (DEBUG_SCENE_RENDER) console.log('🟦🟦🟦 [scene-render] COPYING TEMP CANVAS TO MAIN CANVAS');
        ctx.drawImage(tempCanvas, 0, 0);
      }
    } else {
      if (DEBUG_SCENE_RENDER) console.log('🔍 [scene-render] No rulers enabled');
    }
  } else {
    if (DEBUG_SCENE_RENDER) console.log('🔍 [scene-render] NO rulers/grid settings - SKIPPING old fallback system');
    // Old fallback system completely removed - only use new RulersGridSystem
  }
  
}