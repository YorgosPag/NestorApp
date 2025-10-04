import { useRef } from 'react';

// ✅ Debug flag for grip interaction logging
const DEBUG_CANVAS_CORE = false;
import type { Point2D, ViewTransform } from '../../systems/rulers-grid/config';
import { coordTransforms } from '../../systems/rulers-grid/config';
import { pointDistance } from '../../utils/geometry-utils';
import type { SceneModel, LineEntity, PolylineEntity } from '../../types/scene';
import { EntityRenderer } from '../../utils/entity-renderer';
import type { GripSettings } from '../../types/gripSettings';
import { PhaseManager, type PhaseManagerOptions } from '../../systems/phase-manager/PhaseManager';
import { 
  convertLineToPolyline, 
  addVertexToPolyline, 
  isPointNearLineSegment, 
  getClosestPointOnLineSegment,
  findPolylineEdgeForGrip,
  closePolyline,
  canPolylineBeClosedByConnection,
  arePointsConnectable,
  openPolylineAtEdge
} from '../../utils/entity-conversion';
import { calculateMidpoint } from '../../utils/renderers/shared/geometry-rendering-utils';

interface UseGripInteractionArgs {
  scene: SceneModel | null;
  selectedIdsRef: React.MutableRefObject<Set<string>>;  // ✅ use selectedIdsRef instead of props
  transformRef: React.MutableRefObject<ViewTransform>;
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;  // ✅ need canvas for proper transforms
  entityRendererRef: React.MutableRefObject<EntityRenderer | null>;
  render: (scene: SceneModel, opts?: any) => void;
  gripSettings: GripSettings;
  // ✅ Overlay preview για smooth drag χωρίς διπλό redraw
  setPreviewOverride: (ov: { entityId: string; next: any } | null) => void;
  // ✅ Add onCommitLine callback for grip drag commit
  onCommitLine?: (entityId: string, next: {start:Point2D,end:Point2D}) => void;
  // ✅ Add callback for scene updates (for line-to-polyline conversion)
  onSceneChange?: (scene: SceneModel) => void;
  snapEnabled?: boolean;
  findSnapPoint?: (x: number, y: number) => {x: number; y: number} | null;
  // ✅ Callback για αλλαγή cursor
  setCursor?: (cursor: string) => void;
}

export function useGripInteraction({ 
  snapEnabled=false, 
  findSnapPoint, 
  scene,
  selectedIdsRef,  // ✅ use selectedIdsRef instead of props
  transformRef,
  canvasRef,       // ✅ need canvas for proper transforms
  entityRendererRef,
  render,
  gripSettings,
  setPreviewOverride, // ✅ overlay preview system
  onCommitLine,
  onSceneChange,   // ✅ scene update callback
  setCursor        // ✅ cursor callback
}: UseGripInteractionArgs) {
  const hoverGripRef = useRef<{ entityId: string; gripIndex: number } | null>(null);
  const activeGripRef = useRef<{ entityId: string; gripIndex: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{entityId:string; start:Point2D; end:Point2D; gripIndex:0|1|2} | null>(null);
  
  // 🎯 CREATE PHASE MANAGER FOR LIVE MEASUREMENTS
  const phaseManagerRef = useRef<PhaseManager | null>(null);
  
  const getPhaseManager = (): PhaseManager => {
    if (!phaseManagerRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        const phaseOptions: PhaseManagerOptions = {
          ctx,
          transform: transformRef.current,
          worldToScreen: (point: Point2D) => {
            // ✅ FIXED: Use OVERLAY coordinate system for overlays
            const transform = transformRef.current;
            return {
              x: point.x * transform.scale + transform.offsetX,
              y: -point.y * transform.scale + transform.offsetY  // ✅ FIX: Invert Y axis
            };
          }
        };
        phaseManagerRef.current = new PhaseManager(phaseOptions);
        // Pass grip settings to PhaseManager for proper grip rendering
        phaseManagerRef.current.setGripSettings(gripSettings);
      }
    }
    return phaseManagerRef.current!;
  };
  // ✅ Track potential edge hover for grip addition (line or polyline)
  const hoverLineEdgeRef = useRef<{ 
    entityId: string; 
    insertPoint: Point2D; 
    insertIndex?: number; // For polylines - where to insert the vertex
    tolerance: number;
  } | null>(null);
  
  // ✅ Track potential polyline closing opportunity
  const hoverPolylineCloseRef = useRef<{
    entityId: string;
    canClose: boolean;
    tolerance: number;
  } | null>(null);
  // 🔐 κράτα το τελευταίο preview για commit
  const dragPreviewRef = useRef<{
    entityId: string;
    start: Point2D;
    end: Point2D;
  } | null>(null);
  
  
  const schedulePreview = (ov: { entityId: string; next: any }) => {
    // ✅ Immediate update για responsive grip dragging - χωρίς RAF delay
    setPreviewOverride(ov);
  };

  // ✅ FIXED: Use OVERLAY coordinate system instead of UGS for overlays
  const worldToScreen = (p: Point2D) => {
    const transform = transformRef.current;
    return {
      x: p.x * transform.scale + transform.offsetX,
      y: -p.y * transform.scale + transform.offsetY  // ✅ FIX: Invert Y axis for correct screen coordinates
    };
  };

  const s2w = (screenPt: Point2D): Point2D => {
    const transform = transformRef.current;
    const w = {
      x: (screenPt.x - transform.offsetX) / transform.scale,
      y: -(screenPt.y - transform.offsetY) / transform.scale  // ✅ FIX: Invert Y axis for correct world coordinates
    };
    
    // ✅ RE-ENABLED SNAPPING during grip drag for overlay-to-DXF snapping
    if (snapEnabled && typeof findSnapPoint === 'function') {
      if (DEBUG_CANVAS_CORE) console.log('🔍 GRIP: Trying snap for point:', w);
      const snapResult = findSnapPoint(w.x, w.y);
      if (snapResult && snapResult.found && snapResult.snappedPoint) {
        const snappedPoint = snapResult.snappedPoint;
        if (DEBUG_CANVAS_CORE) console.log('✅ GRIP: Snap SUCCESS:', snappedPoint, 'from raw:', w, 'result:', snapResult);
        return snappedPoint;
      } else {
        if (DEBUG_CANVAS_CORE) console.log('❌ GRIP: No snap found for:', w, 'result:', snapResult);
      }
    } else {
      if (DEBUG_CANVAS_CORE) console.log('🚫 GRIP: Snap disabled or no findSnapPoint function');
    }
    
    return w; // raw world coords
  };

  const collectLineGrips = (e: any): {pos: Point2D, idx: number}[] => {
    if (e.type !== 'line' || !e.start || !e.end) return [];
    const mid = { x: (e.start.x + e.end.x)/2, y: (e.start.y + e.end.y)/2 };
    // ✅ ΣΩΣΤΗ ΣΕΙΡΑ: 0=start, 1=end, 2=mid (ταιριάζει με BaseEntityRenderer.getGrips)
    return [
      { pos: e.start, idx: 0 },
      { pos: e.end,   idx: 1 },
      { pos: mid,     idx: 2 },
    ];
  };

  const collectPolygonGrips = (e: any): {pos: Point2D, idx: number}[] => {
    if (DEBUG_CANVAS_CORE) console.log('🔍 [collectPolygonGrips] Input entity:', {
      id: e.id,
      type: e.type,
      vertices: e.vertices,
      verticesLength: e.vertices?.length,
      hasVertices: !!e.vertices,
      isArray: Array.isArray(e.vertices)
    });
    
    if (!e.vertices || !Array.isArray(e.vertices) || e.vertices.length < 2) {
      console.log('❌ [collectPolygonGrips] Invalid vertices, returning empty grips');
      return [];
    }
    
    const grips: {pos: Point2D, idx: number}[] = [];
    
    // Add vertex grips (corners)
    e.vertices.forEach((vertex: Point2D, idx: number) => {
      if (DEBUG_CANVAS_CORE) console.log(`🔍 [collectPolygonGrips] Adding vertex grip ${idx}:`, vertex);
      grips.push({ pos: vertex, idx });
    });
    
    // Add midpoint grips (edges) - starting after vertex grips
    const midpointOffset = e.vertices.length;
    for (let i = 0; i < e.vertices.length; i++) {
      const current = e.vertices[i];
      const next = e.vertices[(i + 1) % e.vertices.length];
      const midpoint = calculateMidpoint(current, next);
      grips.push({ pos: midpoint, idx: midpointOffset + i });
    }
    
    return grips;
  };

  const collectRectangleGrips = (e: any): {pos: Point2D, idx: number}[] => {
    if (e.type !== 'rectangle' || !e.corner1 || !e.corner2) return [];
    
    const { corner1, corner2 } = e;
    const grips: {pos: Point2D, idx: number}[] = [];
    
    // Calculate all 4 vertices from corners
    const vertices = [
      corner1,                                    // 0: top-left
      { x: corner2.x, y: corner1.y },            // 1: top-right
      corner2,                                    // 2: bottom-right
      { x: corner1.x, y: corner2.y }             // 3: bottom-left
    ];
    
    // Add corner grips (0-3)
    vertices.forEach((vertex, idx) => {
      grips.push({ pos: vertex, idx });
    });
    
    // Add edge midpoint grips (4-7)
    for (let i = 0; i < vertices.length; i++) {
      const current = vertices[i];
      const next = vertices[(i + 1) % vertices.length];
      const midpoint = calculateMidpoint(current, next);
      grips.push({ pos: midpoint, idx: 4 + i });
    }
    
    return grips;
  };

  const hitTestGrip = (pt: Point2D, ent: any): { entityId: string; gripIndex: number } | null => {
    // Support line, polygon, and rectangle entities
    let grips: {pos: Point2D, idx: number}[] = [];
    if (ent.type === 'line') {
      grips = collectLineGrips(ent);
    } else if (ent.type === 'rectangle') {
      grips = collectRectangleGrips(ent);
    } else {
      grips = collectPolygonGrips(ent);
    }
    
    if (DEBUG_CANVAS_CORE) console.log('🔍 [hitTestGrip] Entity details:', {
      entityId: ent.id,
      entityType: ent.type,
      gripsCount: grips.length,
      mousePoint: pt,
      grips: grips.map(g => ({ pos: g.pos, idx: g.idx }))
    });
    
    if (!grips.length) return null;
    const aperture = gripSettings.apertureSize * 10; // ✅ 10x tolerance for debugging coordinate issues
    for (const g of grips) {
      const s = worldToScreen(g.pos);
      const dx = pt.x - s.x, dy = pt.y - s.y;
      const distance = Math.sqrt(dx*dx + dy*dy);
      
      // Debug logging για κάθε grip
      if (DEBUG_CANVAS_CORE) console.log(`🎯 [DEBUG] Grip ${g.idx}: world(${g.pos.x.toFixed(2)}, ${g.pos.y.toFixed(2)}) -> screen(${s.x.toFixed(2)}, ${s.y.toFixed(2)}) | mouse(${pt.x.toFixed(2)}, ${pt.y.toFixed(2)}) | distance: ${distance.toFixed(2)} | tolerance: ${aperture}`);
      
      if (distance <= aperture) {
        const hit = { entityId: ent.id, gripIndex: g.idx };
        if (DEBUG_CANVAS_CORE) console.log('✅ GRIP HIT:', hit, 'distance:', distance, 'tolerance:', aperture);
        
        return hit;
      }
    }
    if (DEBUG_CANVAS_CORE) console.log('❌ GRIP MISS: no grip within tolerance', aperture);
    return null;
  };

  const onMouseMoveGrip = (pt: Point2D): boolean => {
    // Grip hover logic (higher priority)
    if (!scene) {
      console.log('⚠️ [GripHover] No scene available for grip detection');
      return false;
    }
    
    if (selectedIdsRef.current.size === 0) {
      if (DEBUG_CANVAS_CORE) console.log('⚠️ [GripHover] No selected regions - κάνε κλικ πρώτα πάνω σε ένα layer για να εμφανιστούν τα grips!');
      return false;
    }
    
    if (scene && selectedIdsRef.current.size > 0) {
      if (DEBUG_CANVAS_CORE) console.log('🎯 Grip hover check - selectedIds:', Array.from(selectedIdsRef.current));
      const selectedId = Array.from(selectedIdsRef.current)[0]; // first selected entity
      const ent = scene.entities.find(e => e.id === selectedId);
      let hg: any = null;
      let lineEdgeHover: any = null;
      
      if (ent) {
        hg = hitTestGrip(pt, ent);
        
        // ✅ If no grip hit, check for edge hover (line or polyline, but not rectangles)
        if (!hg && (ent.type === 'line' || ent.type === 'polyline' || ent.type === 'lwpolyline')) {
          const world = s2w(pt);
          const tolerance = gripSettings.apertureSize / transformRef.current.scale; // Convert to world units
          
          if (ent.type === 'line') {
            // Line edge logic (existing)
            const line = ent as LineEntity;
            if (isPointNearLineSegment(world, line.start, line.end, tolerance)) {
              const insertPoint = getClosestPointOnLineSegment(world, line.start, line.end);
              
              // Don't allow insertion too close to existing grips using shared geometry utility
              const startDist = pointDistance(insertPoint, line.start);
              const endDist = pointDistance(insertPoint, line.end);
              
              if (startDist > tolerance * 2 && endDist > tolerance * 2) {
                lineEdgeHover = {
                  entityId: ent.id,
                  insertPoint,
                  tolerance
                };
                console.log('🎯 Line edge hover detected:', lineEdgeHover);
              }
            }
          } else if (ent.type === 'polyline' || ent.type === 'lwpolyline') {
            // Polyline edge logic (new)
            const polyline = ent as PolylineEntity;
            const edgeInfo = findPolylineEdgeForGrip(world, polyline, tolerance);
            
            if (edgeInfo) {
              lineEdgeHover = {
                entityId: ent.id,
                insertPoint: edgeInfo.insertPoint,
                insertIndex: edgeInfo.insertIndex,
                tolerance
              };
              console.log('🎯 Polyline edge hover detected:', lineEdgeHover);
            }
          }
        }
      }
      
      if (DEBUG_CANVAS_CORE) console.log('🎯 Grip hit-test result:', hg);
      
      // Update hover state
      const gripStateChanged = (hg?.entityId !== hoverGripRef.current?.entityId) || (hg?.gripIndex !== hoverGripRef.current?.gripIndex);
      const lineEdgeStateChanged = (lineEdgeHover?.entityId !== hoverLineEdgeRef.current?.entityId) || 
                                  (lineEdgeHover?.insertPoint?.x !== hoverLineEdgeRef.current?.insertPoint?.x) ||
                                  (lineEdgeHover?.insertPoint?.y !== hoverLineEdgeRef.current?.insertPoint?.y);
      
      if (gripStateChanged || lineEdgeStateChanged) {
        hoverGripRef.current = hg;
        hoverLineEdgeRef.current = lineEdgeHover;
        
        // ✅ Update cursor based on hover state
        if (hg && setCursor) {
          setCursor('all-scroll');
          console.log('🎯 Cursor changed to ALL-SCROLL (σταυρός με βέλη) - hovering over grip');
        } else if (lineEdgeHover && setCursor) {
          setCursor('copy');
          console.log('🎯 Cursor changed to COPY - hovering over line edge (can add grip)');
        } else if (setCursor) {
          setCursor('crosshair');
          console.log('🎯 Cursor changed to CROSSHAIR - no grip or line edge hover');
        }
        
        // Update grip interaction state (for rendering)
        console.log('🎯 Grip hover state:', { 
          hovered: hg || undefined, 
          active: activeGripRef.current || undefined 
        });
        try {
          render(scene);
        } catch (error) {
          console.error('🚨 HOVER RENDER FAILED:', error);
        }
      }
      return !!(hg || lineEdgeHover);
    }
    
    // Επιστρέφω cursor σε default αν δεν υπάρχουν selected entities
    if (setCursor) {
      setCursor('crosshair');
    }
    
    return false;
  };

  const onMouseDownGrip = (pt: Point2D): boolean => {
    // Grip click logic (higher priority)
    if (DEBUG_CANVAS_CORE) console.log('🔍 onMouseDownGrip CALLED: pt:', pt, 'selectedIds:', selectedIdsRef.current.size);
    console.log('🎯 GRIP MOUSEDOWN: pt:', pt, 'selectedIds:', selectedIdsRef.current.size);
    if (DEBUG_CANVAS_CORE) console.log('🔍 [useGripInteraction] Scene available?', !!scene);
    if (DEBUG_CANVAS_CORE) console.log('🔍 [useGripInteraction] Scene entities:', scene?.entities?.length || 0);
    if (DEBUG_CANVAS_CORE) console.log('🔍 [useGripInteraction] Selected IDs:', Array.from(selectedIdsRef.current));
    if (scene && selectedIdsRef.current.size > 0) {
      const selectedId = Array.from(selectedIdsRef.current)[0]; // first selected entity
      const ent = scene.entities.find(e => e.id === selectedId);
      const hg = ent ? hitTestGrip(pt, ent) : null;
      if (DEBUG_CANVAS_CORE) console.log('🎯 Grip click result:', hg, 'entity:', ent?.type, ent?.id);

      if (hg) {
        if (DEBUG_CANVAS_CORE) console.log('🔍 PROCESSING GRIP HIT: Starting drag setup');
        // ξεκινάμε drag
        activeGripRef.current = hg;
        if (DEBUG_CANVAS_CORE) console.log('🔍 ACTIVE GRIP SET:', activeGripRef.current);
        
        // Update grip interaction state (for rendering)
        if (DEBUG_CANVAS_CORE) console.log('🎯 Grip active state:', {
          hovered: hoverGripRef.current || undefined,
          active: hg
        });
        
        if (DEBUG_CANVAS_CORE) console.log('🔍 CALLING RENDER...');
        try {
          render(scene);
          if (DEBUG_CANVAS_CORE) console.log('🔍 RENDER COMPLETED');
        } catch (error) {
          console.error('🚨 RENDER FAILED:', error);
          // Continue execution despite render failure
        }

        // αποθήκευσε και το αρχικό geometry για το drag
        if (DEBUG_CANVAS_CORE) console.log('🔍 DRAG SETUP for entity type:', ent!.type, 'entity:', ent);
        if (ent!.type === 'line') {
          dragStartRef.current = {
            entityId: ent!.id,
            start: { ...ent!.start },
            end:   { ...ent!.end },
            gripIndex: hg.gripIndex
          };
          if (DEBUG_CANVAS_CORE) console.log('🔍 LINE DRAG START saved:', dragStartRef.current);
        } else if (ent!.type === 'rectangle') {
          // For rectangle entities
          dragStartRef.current = {
            entityId: ent!.id,
            corner1: { ...ent!.corner1 },
            corner2: { ...ent!.corner2 },
            gripIndex: hg.gripIndex
          };
        } else if (ent!.vertices) {
          // For polygon entities
          dragStartRef.current = {
            entityId: ent!.id,
            vertices: ent!.vertices.map((v: Point2D) => ({ ...v })),
            gripIndex: hg.gripIndex
          };
        }
        isDraggingRef.current = true;
        
        // ✅ Enhanced debug logging for drag state
        if (DEBUG_CANVAS_CORE) console.log('🔍 DRAG STATE SET: isDraggingRef.current =', isDraggingRef.current);
        if (DEBUG_CANVAS_CORE) console.log('🔍 DRAG START DATA:', dragStartRef.current);
        
        // ✅ Αλλάζω cursor σε grabbing όταν αρχίζει το drag
        if (setCursor) {
          setCursor('grabbing');
          console.log('🎯 Cursor changed to GRABBING - started grip drag');
        }
        
        console.log('🎯 useGripInteraction: Started grip drag:', hg.entityId, hg.gripIndex);
        if (DEBUG_CANVAS_CORE) console.log('🔍 RETURNING TRUE FROM onMouseDownGrip');
        return true;
      } else if (hoverLineEdgeRef.current && onSceneChange) {
        // ✅ Handle clicking on edge to add grip (line or polyline)
        const lineEdge = hoverLineEdgeRef.current;
        
        if (ent?.type === 'line') {
          // Convert line to polyline with new grip point
          const line = ent as LineEntity;
          console.log('🎯 Converting line to polyline at point:', lineEdge.insertPoint);
          
          const newPolyline = convertLineToPolyline(line, lineEdge.insertPoint);
          
          const updatedScene = {
            ...scene,
            entities: scene.entities.map(e => 
              e.id === line.id ? newPolyline : e
            )
          };
          
          onSceneChange(updatedScene);
          console.log('🎯 Line converted to polyline successfully');
          
        } else if (ent?.type === 'polyline' || ent?.type === 'lwpolyline') {
          // Add vertex to existing polyline
          const polyline = ent as PolylineEntity;
          console.log('🎯 Adding vertex to polyline at point:', lineEdge.insertPoint, 'index:', lineEdge.insertIndex);
          
          if (lineEdge.insertIndex !== undefined) {
            const updatedPolyline = addVertexToPolyline(polyline, lineEdge.insertIndex, lineEdge.insertPoint);
            
            const updatedScene = {
              ...scene,
              entities: scene.entities.map(e => 
                e.id === polyline.id ? updatedPolyline : e
              )
            };
            
            onSceneChange(updatedScene);
            console.log('🎯 Vertex added to polyline successfully');
          }
        }
        
        // Clear hover states
        hoverLineEdgeRef.current = null;
        hoverGripRef.current = null;
        return true;
      }
    }
    return false;
  };

  const onMouseMoveDrag = (pt: Point2D): boolean => {
    // ✅ Enhanced debug logging
    if (DEBUG_CANVAS_CORE) console.log('🔍 DRAG CHECK: scene:', !!scene, 'isDragging:', isDraggingRef.current, 'dragStart:', !!dragStartRef.current);
    
    if (!scene || !isDraggingRef.current || !dragStartRef.current) {
      // ✅ Debug log to see why drag is not working
      if (!scene) if (DEBUG_CANVAS_CORE) console.log('🔍 DRAG DEBUG: No scene');
      if (!isDraggingRef.current) if (DEBUG_CANVAS_CORE) console.log('🔍 DRAG DEBUG: Not dragging - isDraggingRef.current =', isDraggingRef.current);
      if (!dragStartRef.current) if (DEBUG_CANVAS_CORE) console.log('🔍 DRAG DEBUG: No drag start - dragStartRef.current =', dragStartRef.current);
      return false;
    }
    
    if (DEBUG_CANVAS_CORE) console.log('✅ DRAG ACTIVE: Moving grip, pt:', pt);

    const dragStart = dragStartRef.current;
    let world = s2w(pt); // ✅ Το s2w ήδη κάνει snap, δεν χρειάζεται διπλό snap

    if (DEBUG_CANVAS_CORE) console.log('🔍 DRAG STATE:', { 
      hasStart: !!dragStart.start, 
      hasEnd: !!dragStart.end, 
      hasCorner1: !!dragStart.corner1, 
      hasVertices: !!dragStart.vertices,
      gripIndex: dragStart.gripIndex 
    });

    if (dragStart.start && dragStart.end) {
      // Line entity drag logic
      const { entityId, start, end, gripIndex } = dragStart;
      if (DEBUG_CANVAS_CORE) console.log('🔍 LINE DRAG:', { entityId, gripIndex, world, start, end });
      const updated = { start: { ...start }, end: { ...end } };
      if (gripIndex === 0) {
        updated.start = world;        // Move start point
        if (DEBUG_CANVAS_CORE) console.log('🔍 Moving START point to:', world);
      } else if (gripIndex === 1) {
        updated.end = world;         // Move end point
        if (DEBUG_CANVAS_CORE) console.log('🔍 Moving END point to:', world);
      } else {
        const mid0 = { x:(start.x+end.x)/2, y:(start.y+end.y)/2 };
        const dx = world.x - mid0.x, dy = world.y - mid0.y;
        updated.start = { x: start.x + dx, y: start.y + dy };
        updated.end   = { x: end.x   + dx, y: end.y   + dy };
      }

      // 🔐 κράτα το τελευταίο preview για commit
      dragPreviewRef.current = { entityId, start: updated.start, end: updated.end };
      schedulePreview({ entityId, next: updated });
      
      // 🎯 NO DUPLICATE MEASUREMENTS για Line - ο LineRenderer τα κάνει ήδη
      console.log(`📏 Line grip ${gripIndex} at (${world.x.toFixed(2)}, ${world.y.toFixed(2)}) - measurements handled by renderer`);
      
    } else if (dragStart.corner1 && dragStart.corner2) {
      // Rectangle entity drag logic
      const { entityId, corner1, corner2, gripIndex } = dragStart;
      let updatedCorner1 = { ...corner1 };
      let updatedCorner2 = { ...corner2 };

      if (gripIndex < 4) {
        // Corner grips (0-3)
        if (gripIndex === 0) {
          // Top-left corner
          updatedCorner1 = world;
        } else if (gripIndex === 1) {
          // Top-right corner
          updatedCorner1 = { x: corner1.x, y: world.y };
          updatedCorner2 = { x: world.x, y: corner2.y };
        } else if (gripIndex === 2) {
          // Bottom-right corner
          updatedCorner2 = world;
        } else if (gripIndex === 3) {
          // Bottom-left corner
          updatedCorner1 = { x: world.x, y: corner1.y };
          updatedCorner2 = { x: corner2.x, y: world.y };
        }
      } else {
        // Edge grips (4-7)
        const edgeIndex = gripIndex - 4;
        if (edgeIndex === 0) {
          // Top edge
          updatedCorner1 = { x: corner1.x, y: world.y };
        } else if (edgeIndex === 1) {
          // Right edge
          updatedCorner2 = { x: world.x, y: corner2.y };
        } else if (edgeIndex === 2) {
          // Bottom edge
          updatedCorner2 = { x: corner2.x, y: world.y };
        } else if (edgeIndex === 3) {
          // Left edge
          updatedCorner1 = { x: world.x, y: corner1.y };
        }
      }

      // 🔐 κράτα το τελευταίο preview για commit
      dragPreviewRef.current = { entityId, corner1: updatedCorner1, corner2: updatedCorner2 };
      schedulePreview({ entityId, next: { corner1: updatedCorner1, corner2: updatedCorner2 } });
      
      // 🎯 NO DUPLICATE MEASUREMENTS για Rectangle - ο RectangleRenderer τα κάνει ήδη
      console.log(`📏 Rectangle grip ${gripIndex} at (${world.x.toFixed(2)}, ${world.y.toFixed(2)}) - measurements handled by renderer`);
      
    } else if (dragStart.vertices) {
      // Polygon entity drag logic
      const { entityId, vertices, gripIndex } = dragStart;
      const numVertices = vertices.length;
      const updatedVertices = vertices.map(v => ({ ...v }));

      if (gripIndex < numVertices) {
        // Moving a vertex (corner)
        updatedVertices[gripIndex] = world;
      } else {
        // Moving a midpoint (edge) - this moves both adjacent vertices
        const edgeIndex = gripIndex - numVertices;
        const currentVertex = vertices[edgeIndex];
        const nextVertex = vertices[(edgeIndex + 1) % numVertices];
        
        // Calculate how much the midpoint moved
        const originalMidpoint = {
          x: (currentVertex.x + nextVertex.x) / 2,
          y: (currentVertex.y + nextVertex.y) / 2
        };
        const deltaX = world.x - originalMidpoint.x;
        const deltaY = world.y - originalMidpoint.y;
        
        // Move both vertices by the same delta
        updatedVertices[edgeIndex].x += deltaX;
        updatedVertices[edgeIndex].y += deltaY;
        updatedVertices[(edgeIndex + 1) % numVertices].x += deltaX;
        updatedVertices[(edgeIndex + 1) % numVertices].y += deltaY;
      }

      // 🔐 κράτα το τελευταίο preview για commit
      dragPreviewRef.current = { entityId, vertices: updatedVertices };
      schedulePreview({ entityId, next: { vertices: updatedVertices } });
      
      // 🎯 NO DUPLICATE MEASUREMENTS για Polygon - τα renderers τα κάνουν ήδη
      console.log(`📏 Polygon grip ${gripIndex} at (${world.x.toFixed(2)}, ${world.y.toFixed(2)}) - measurements handled by renderer`);
    }

    return true;
  };

  const onMouseUpDrag = (): void => {
    if (DEBUG_CANVAS_CORE) console.log('🔍 MOUSE UP DRAG CALLED: scene=', !!scene, 'isDragging=', isDraggingRef.current);
    
    if (!scene || !isDraggingRef.current) {
      if (DEBUG_CANVAS_CORE) console.log('🔍 MOUSE UP DRAG: Early return - not dragging');
      return;
    }

    if (DEBUG_CANVAS_CORE) console.log('🔍 MOUSE UP DRAG: Processing end of drag');
    isDraggingRef.current = false;
    activeGripRef.current = null; // καθάρισε active grip state
    
    // ✅ Επιστρέφω cursor στο default state μετά το drag
    if (setCursor) {
      setCursor('crosshair');
      console.log('🎯 Cursor changed to CROSSHAIR - ended grip drag');
    }
    
    // Update grip interaction state (for rendering)
    console.log('🎯 Grip end state:', { 
      hovered: hoverGripRef.current || undefined 
    });

    const payload = dragPreviewRef.current; // {entityId, start, end}
    dragPreviewRef.current = null;
    dragStartRef.current = null;

    // ✅ καθάρισε overlay
    setPreviewOverride(null);

    // ✅ Check for polyline closing opportunity before commit
    if (payload && payload.vertices && onSceneChange) {
      const entity = scene.entities.find(e => e.id === payload.entityId) as PolylineEntity;
      if (entity && entity.type === 'polyline' && !entity.closed && payload.vertices.length >= 3) {
        const tolerance = gripSettings.apertureSize / transformRef.current.scale;
        
        // Create updated polyline with current vertices
        const updatedPolyline = { ...entity, vertices: payload.vertices };
        
        // Check if we can close the polyline by connecting endpoints
        if (canPolylineBeClosedByConnection(updatedPolyline, tolerance * 3)) {
          console.log('🎯 Polyline endpoints are close - closing polyline to create polygon');
          
          const closedPolyline = closePolyline(updatedPolyline);
          const updatedScene = {
            ...scene,
            entities: scene.entities.map(e => 
              e.id === entity.id ? closedPolyline : e
            )
          };
          
          onSceneChange(updatedScene);
          return; // Don't commit via onCommitLine
        }
      }
    }
    
    // ✅ commit στο state (functional, όπως έχεις στον parent)
    if (payload && typeof onCommitLine === 'function') {
      if (payload.start && payload.end) {
        // Line entity
        console.log('🎯 useGripInteraction: COMMITTING line grip changes:', payload.entityId);
        onCommitLine(payload.entityId, { start: payload.start, end: payload.end });
      } else if (payload.corner1 && payload.corner2) {
        // Rectangle entity
        console.log('🎯 useGripInteraction: COMMITTING rectangle grip changes:', payload.entityId);
        onCommitLine(payload.entityId, { corner1: payload.corner1, corner2: payload.corner2 });
      } else if (payload.vertices) {
        // Polygon entity
        console.log('🎯 useGripInteraction: COMMITTING polygon grip changes:', payload.entityId);
        onCommitLine(payload.entityId, { vertices: payload.vertices });
      }
    }
  };

  // ✅ Break polygon at edge grip functionality
  const breakPolygonAtGrip = (pt: Point2D): boolean => {
    if (!scene || selectedIdsRef.current.size === 0) return false;
    
    const selectedId = Array.from(selectedIdsRef.current)[0];
    const entity = scene.entities.find(e => e.id === selectedId) as PolylineEntity;
    
    if (!entity || entity.type !== 'polyline' || !entity.closed || !entity.vertices) {
      console.log('🎯 Break polygon: Entity is not a closed polyline');
      return false;
    }
    
    // Find which grip was clicked
    const hg = hitTestGrip(pt, entity);
    if (!hg) {
      console.log('🎯 Break polygon: No grip hit');
      return false;
    }
    
    const grips = collectPolygonGrips(entity);
    const grip = grips.find(g => g.idx === hg.gripIndex);
    if (!grip) {
      console.log('🎯 Break polygon: Grip not found');
      return false;
    }
    
    // Check if it's an edge grip (midpoint grip)
    const isEdgeGrip = hg.gripIndex >= entity.vertices.length;
    if (!isEdgeGrip) {
      console.log('🎯 Break polygon: Not an edge grip, cannot break');
      return false;
    }
    
    // Calculate which edge this is (edge grips start after vertex grips)
    const edgeIndex = hg.gripIndex - entity.vertices.length;
    console.log('🎯 Breaking polygon at edge:', edgeIndex);
    
    // Open the polygon at the specified edge
    const openedPolyline = openPolylineAtEdge(entity, edgeIndex);
    
    // Update the scene
    const updatedScene = {
      ...scene,
      entities: scene.entities.map(e => e.id === entity.id ? openedPolyline : e)
    };
    
    if (onSceneChange) {
      onSceneChange(updatedScene);
      console.log('🎯 Polygon broken successfully - converted to open polyline');
      return true;
    }
    
    return false;
  };

  return {
    onMouseMoveGrip,
    onMouseDownGrip,
    onMouseMoveDrag,
    onMouseUpDrag,
    isDraggingRef,  // ✅ εξάγουμε για να το χρησιμοποιήσει το hover system
    breakPolygonAtGrip  // ✅ νέα functionality για breaking polygons
  };
}