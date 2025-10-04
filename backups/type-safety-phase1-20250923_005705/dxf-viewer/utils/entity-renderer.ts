/**
 * Entity Renderer - Legacy compatibility wrapper
 * This file maintains backward compatibility while using the new modular renderer system
 */

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_ENTITY_RENDERER = false;

import { EntityRendererComposite } from './renderers/EntityRendererComposite';
import type { ViewTransform, Point2D } from '../systems/rulers-grid/config';
import type { GripSettings, GripInteractionState } from '../types/gripSettings';

export interface EntityModel {
  id: string;
  type: string;
  layer: string;
  preview?: boolean;
  [key: string]: any;
}

export interface GripInfo {
  entityId: string;
  gripType: 'vertex' | 'edge' | 'center' | 'corner';
  gripIndex: number;
  position: Point2D;
  state: 'cold' | 'warm' | 'hot';
}

/**
 * Legacy EntityRenderer class that delegates to the new composite renderer
 */
export class EntityRenderer {
  private composite: EntityRendererComposite;
  private ctx: CanvasRenderingContext2D;
  // ✅ Grip interaction state
  private gripInteraction: GripInteractionState = {};

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.composite = new EntityRendererComposite(ctx);
  }

  setTransform(transform: ViewTransform) {
    this.composite.setTransform(transform);
  }

  setGripSettings(settings: GripSettings) {
    this.composite.setGripSettings(settings);
  }

  // ✅ Update grip interaction state
  setGripInteractionState(next: GripInteractionState) {
    this.gripInteraction = next || {};
    this.composite.setGripInteractionState(this.gripInteraction);
  }

  render(entity: EntityModel, options: any = {}) {
    this.composite.render(entity, options);
  }

  // Alias for backward compatibility with scene-render.ts
  renderEntity(entity: EntityModel, strokeOverride?: string | null, isSelected?: boolean) {
    const isPreviewEntity = (entity as any).preview === true;
    const showPreviewGrips = (entity as any).showPreviewGrips === true;

    // ✅ ΚΡΙΣΙΜΗ ΔΙΟΡΘΩΣΗ: Preview entities μπορούν να έχουν grips!
    const shouldShowGrips = isSelected || (strokeOverride === '#FFFFFF') || showPreviewGrips;

    if (DEBUG_ENTITY_RENDERER) console.log('🔥 [EntityRenderer] renderEntity:', {
      entityType: entity.type,
      isPreviewEntity,
      showPreviewGrips,
      isSelected,
      strokeOverride,
      shouldShowGrips
    });

    const options = {
      strokeOverride,
      isSelected: isSelected || false,
      selected: isSelected || false,
      grips: shouldShowGrips, // ✅ Show grips when entity is selected, hovered, OR preview with grips
      hovered: strokeOverride === '#FFFFFF', // White stroke means hovered
      measurement: (entity as any).measurement === true, // Check if entity is a measurement
      preview: isPreviewEntity // Pass preview flag for preview entities
    };
    
    // ✅ ΠΡΟΣΤΑΣΙΑ: Αν είμαστε σε hovered + selected state, ΜΗΝ κάνεις normal rendering
    if (entity.type === 'rectangle' && !options.hovered && this.isEntitySelectedAndHovered(entity.id)) {
      if (DEBUG_ENTITY_RENDERER) console.log(`🎯 [renderEntity] SKIPPING normal render for selected+hovered rectangle ${entity.id}`);
      return; // Skip normal rendering - θα το κάνει το hover pass
    }

    // ✅ Debug log για να δούμε τι options περνιούνται
    if (entity.type === 'rectangle' && DEBUG_ENTITY_RENDERER) {
      if (DEBUG_ENTITY_RENDERER) console.log(`🎯 [renderEntity] Rectangle ${entity.id}:`, {
        strokeOverride,
        isSelected,
        hovered: options.hovered,
        grips: options.grips
      });
    }
    
    this.composite.render(entity, options);
  }

  // ✅ Helper function to check if entity is selected and hovered
  private isEntitySelectedAndHovered(entityId: string): boolean {
    // This would need access to selection state - simplified for now
    return false; // Disable this protection for now, will fix at scene-render level instead
  }

  renderEntities(entities: EntityModel[], options: any = {}) {
    this.composite.renderEntities(entities, options);
  }

  findGripAtPoint(entity: EntityModel, screenPoint: Point2D, tolerance: number = 8): GripInfo | null {
    return this.composite.findGripAtPoint(entity, screenPoint, tolerance);
  }

  getEntityGrips(entity: EntityModel): GripInfo[] {
    return this.composite.getEntityGrips(entity);
  }

  hitTest(entities: EntityModel[], point: Point2D, tolerance: number): EntityModel | null {
    return this.composite.hitTest(entities, point, tolerance);
  }

  clear() {
    this.composite.clear();
  }
}

// Export the new modular system as well
export { EntityRendererComposite, createEntityRenderer } from './renderers';
export type { RenderOptions } from './renderers';