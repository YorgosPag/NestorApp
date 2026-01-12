/**
 * 🔺 CENTRALIZED GRIP INTERACTION MANAGER
 * Αυτόνομο κεντρικοποιημένο σύστημα για όλες τις grip interactions
 * 
 * FEATURES:
 * - Grip color states (cold→warm→hot) 
 * - Real-time measurements during dragging
 * - Universal for all entity types
 * - Standalone and reusable
 */

import type { Point2D } from '../../rendering/types/Types';
import type { EntityModel } from '../../rendering/types/Types';
import { PhaseManager } from '../phase-manager/PhaseManager';

// 🏢 ENTERPRISE: Type-safe geometry union for entity properties
export type EntityGeometry =
  | { start: Point2D; end: Point2D } // line
  | { center: Point2D; radius: number } // circle
  | { corner1: Point2D; corner2: Point2D } // rectangle
  | { center: Point2D; radius: number; startAngle: number; endAngle: number } // arc
  | { vertices: Point2D[] } // polyline
  | { center: Point2D; majorAxis: number; minorAxis: number } // ellipse
  | Record<string, unknown>; // fallback

export interface GripInteractionState {
  // Current grip states
  hoveredGrip: { entityId: string; gripIndex: number } | null;
  activeGrip: { entityId: string; gripIndex: number } | null;
  dragging: boolean;

  // Dragging state
  dragStartPosition: Point2D | null;
  currentDragPosition: Point2D | null;
  originalGeometry: EntityGeometry | null;
}

export interface GripInteractionOptions {
  ctx: CanvasRenderingContext2D;
  transform: { scale: number; offsetX: number; offsetY: number };
  worldToScreen: (point: Point2D) => Point2D;
  screenToWorld: (point: Point2D) => Point2D;
}

export class GripInteractionManager {
  private state: GripInteractionState;
  private phaseManager: PhaseManager;
  private options: GripInteractionOptions;
  
  // Event callbacks
  private onGeometryUpdate?: (entityId: string, geometry: EntityGeometry | null) => void;
  private onGripStateChange?: (state: GripInteractionState) => void;

  constructor(options: GripInteractionOptions) {
    this.options = options;
    this.phaseManager = new PhaseManager(options);
    
    this.state = {
      hoveredGrip: null,
      activeGrip: null,
      dragging: false,
      dragStartPosition: null,
      currentDragPosition: null,
      originalGeometry: null
    };
  }

  /**
   * 🔺 UNIVERSAL GRIP HOVER DETECTION
   * Works for ALL entity types automatically
   */
  checkGripHover(entity: EntityModel, mousePosition: Point2D, tolerance: number = 8): boolean {
    // This would use the entity's renderer to get grips
    // For now, simplified detection
    const wasHovering = this.state.hoveredGrip !== null;
    
    // Reset hover state
    this.state.hoveredGrip = null;
    
    // TODO: Get grips from entity renderer and check distances
    // This is where we'd integrate with BaseEntityRenderer.getGrips()
    
    const isHovering = this.state.hoveredGrip !== null;
    
    // Notify state change
    if (wasHovering !== isHovering && this.onGripStateChange) {
      this.onGripStateChange(this.state);
    }
    
    return isHovering;
  }

  /**
   * 🔺 START GRIP DRAGGING
   * Universal for all entity types
   */
  startDragging(entity: EntityModel, gripIndex: number, startPosition: Point2D): boolean {
    if (this.state.dragging) return false;
    
    this.state.activeGrip = { entityId: entity.id, gripIndex };
    this.state.dragging = true;
    this.state.dragStartPosition = startPosition;
    this.state.currentDragPosition = startPosition;
    
    // Store original geometry
    this.state.originalGeometry = this.cloneEntityGeometry(entity);

    if (this.onGripStateChange) {
      this.onGripStateChange(this.state);
    }
    
    return true;
  }

  /**
   * 🔺 UPDATE GRIP DRAG POSITION
   * Renders real-time measurements for ALL entity types
   */
  updateDragPosition(entity: EntityModel, currentPosition: Point2D): boolean {
    if (!this.state.dragging || !this.state.activeGrip) return false;
    
    this.state.currentDragPosition = currentPosition;

    // 🔺 NO DUPLICATE MEASUREMENTS - individual renderers handle this already

    // Notify geometry update
    if (this.onGeometryUpdate) {
      const newGeometry = this.calculateNewGeometry(entity, currentPosition);
      this.onGeometryUpdate(entity.id, newGeometry);
    }
    
    return true;
  }

  /**
   * 🔺 END GRIP DRAGGING
   */
  endDragging(): boolean {
    if (!this.state.dragging) return false;

    this.state.dragging = false;
    this.state.dragStartPosition = null;
    this.state.currentDragPosition = null;
    this.state.originalGeometry = null;
    
    // Keep active grip for selection state
    // this.state.activeGrip = null; // Don't reset - keeps grip selected
    
    if (this.onGripStateChange) {
      this.onGripStateChange(this.state);
    }
    
    return true;
  }

  /**
   * 🔺 GET GRIP COLOR STATE
   * Returns appropriate color for any grip
   */
  getGripColorState(entityId: string, gripIndex: number): 'cold' | 'warm' | 'hot' {
    // Hot (red) - Currently active/dragging
    if (this.state.activeGrip?.entityId === entityId && 
        this.state.activeGrip?.gripIndex === gripIndex) {
      return 'hot';
    }
    
    // Warm (orange) - Hovered
    if (this.state.hoveredGrip?.entityId === entityId && 
        this.state.hoveredGrip?.gripIndex === gripIndex) {
      return 'warm';
    }
    
    // Cold (blue) - Normal
    return 'cold';
  }

  /**
   * 🔺 CHECK IF DRAGGING
   */
  isDragging(): boolean {
    return this.state.dragging;
  }

  /**
   * 🔺 GET CURRENT STATE
   */
  getState(): GripInteractionState {
    return { ...this.state };
  }

  /**
   * 🔺 SET EVENT CALLBACKS
   */
  setCallbacks(callbacks: {
    onGeometryUpdate?: (entityId: string, geometry: EntityGeometry | null) => void;
    onGripStateChange?: (state: GripInteractionState) => void;
  }): void {
    this.onGeometryUpdate = callbacks.onGeometryUpdate;
    this.onGripStateChange = callbacks.onGripStateChange;
  }

  /**
   * 🔺 UPDATE TRANSFORM
   */
  updateTransform(transform: { scale: number; offsetX: number; offsetY: number }): void {
    this.options.transform = transform;
    this.phaseManager.updateTransform(transform);
  }

  /**
   * PRIVATE HELPER METHODS
   */
  private cloneEntityGeometry(entity: EntityModel): EntityGeometry {
    // 🏢 ENTERPRISE: Type-safe geometry cloning using type guards
    // Access entity properties via intersection type for geometry properties
    const entityWithGeometry = entity as EntityModel & {
      start?: Point2D;
      end?: Point2D;
      center?: Point2D;
      radius?: number;
      corner1?: Point2D;
      corner2?: Point2D;
      startAngle?: number;
      endAngle?: number;
      vertices?: Point2D[];
      majorAxis?: number;
      minorAxis?: number;
    };

    switch (entity.type) {
      case 'line':
        if (entityWithGeometry.start && entityWithGeometry.end) {
          return { start: { ...entityWithGeometry.start }, end: { ...entityWithGeometry.end } };
        }
        break;
      case 'circle':
        if (entityWithGeometry.center && entityWithGeometry.radius !== undefined) {
          return { center: { ...entityWithGeometry.center }, radius: entityWithGeometry.radius };
        }
        break;
      case 'rectangle':
        if (entityWithGeometry.corner1 && entityWithGeometry.corner2) {
          return { corner1: { ...entityWithGeometry.corner1 }, corner2: { ...entityWithGeometry.corner2 } };
        }
        break;
      case 'arc':
        if (entityWithGeometry.center && entityWithGeometry.radius !== undefined &&
            entityWithGeometry.startAngle !== undefined && entityWithGeometry.endAngle !== undefined) {
          return {
            center: { ...entityWithGeometry.center },
            radius: entityWithGeometry.radius,
            startAngle: entityWithGeometry.startAngle,
            endAngle: entityWithGeometry.endAngle
          };
        }
        break;
      case 'polyline':
        if (entityWithGeometry.vertices) {
          return { vertices: entityWithGeometry.vertices.map((v: Point2D) => ({ ...v })) };
        }
        break;
      default:
        // Handle ellipse and other entity types with safe property access
        if (entityWithGeometry.center && entityWithGeometry.majorAxis !== undefined) {
          return {
            center: { ...entityWithGeometry.center },
            majorAxis: entityWithGeometry.majorAxis,
            minorAxis: entityWithGeometry.minorAxis ?? 0
          };
        }
    }
    return {}; // Fallback empty geometry
  }

  private calculateNewGeometry(entity: EntityModel, currentPosition: Point2D): EntityGeometry | null {
    if (!this.state.activeGrip || !this.state.originalGeometry) return null;
    
    // This would calculate new geometry based on entity type and grip index
    // For now, return original - would be implemented per entity type
    return this.state.originalGeometry;
  }
}