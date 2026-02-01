/**
 * Entity Renderer - Legacy compatibility wrapper
 * This file maintains backward compatibility while using the new modular renderer system
 */

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_ENTITY_RENDERER = false;

import { EntityRendererComposite } from '../rendering/core/EntityRendererComposite';
import type { Point2D, ViewTransform, GripInfo } from '../rendering/types/Types';
import type { GripSettings, GripInteractionState } from '../types/gripSettings';
import { UI_COLORS } from '../config/color-config';
// 🏢 ADR-151: Centralized grip tolerance
import { TOLERANCE_CONFIG } from '../config/tolerance-config';

// ✅ ENTERPRISE: EntityModel now imported from centralized entity system
// ✅ REMOVED DUPLICATE: No need for local EntityModel interface
import type { EntityModel, Entity } from '../types/entities';


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

  render(entity: EntityModel, options: { strokeOverride?: string; isSelected?: boolean; showGrips?: boolean } = {}) {
    this.composite.render(entity as Entity, options);
  }

  // Alias for backward compatibility with scene-render.ts
  renderEntity(entity: EntityModel, strokeOverride?: string | null, isSelected?: boolean) {
    const isPreviewEntity = ('preview' in entity && entity.preview === true);
    const showPreviewGrips = ('showPreviewGrips' in entity && entity.showPreviewGrips === true);

    // ✅ ΚΡΙΣΙΜΗ ΔΙΟΡΘΩΣΗ: Preview entities μπορούν να έχουν grips!
    const shouldShowGrips = isSelected || (strokeOverride === UI_COLORS.WHITE) || showPreviewGrips;

    const options = {
      strokeOverride,
      isSelected: isSelected || false,
      selected: isSelected || false,
      grips: shouldShowGrips, // ✅ Show grips when entity is selected, hovered, OR preview with grips
      hovered: strokeOverride === UI_COLORS.WHITE, // White stroke means hovered
      measurement: ('measurement' in entity && entity.measurement === true), // Check if entity is a measurement
      preview: isPreviewEntity // Pass preview flag for preview entities
    };
    
    // ✅ ΠΡΟΣΤΑΣΙΑ: Αν είμαστε σε hovered + selected state, ΜΗΝ κάνεις normal rendering
    if (entity.type === 'rectangle' && !options.hovered && this.isEntitySelectedAndHovered(entity.id)) {

      return; // Skip normal rendering - θα το κάνει το hover pass
    }

    // ✅ Debug log για να δούμε τι options περνιούνται
    if (entity.type === 'rectangle' && DEBUG_ENTITY_RENDERER) {

    }

    this.composite.render(entity as Entity, options);
  }

  // ✅ Helper function to check if entity is selected and hovered
  private isEntitySelectedAndHovered(entityId: string): boolean {
    // This would need access to selection state - simplified for now
    return false; // Disable this protection for now, will fix at scene-render level instead
  }

  renderEntities(entities: EntityModel[], options: { strokeOverride?: string; isSelected?: boolean; showGrips?: boolean } = {}) {
    this.composite.renderEntities(entities as Entity[], options);
  }

  findGripAtPoint(entity: EntityModel, screenPoint: Point2D, tolerance: number = TOLERANCE_CONFIG.GRIP_APERTURE): GripInfo | null {
    return this.composite.findGripAtPoint(entity as Entity, screenPoint, tolerance);
  }

  getEntityGrips(entity: EntityModel): GripInfo[] {
    return this.composite.getEntityGrips(entity as Entity);
  }

  hitTest(entities: EntityModel[], point: Point2D, tolerance: number): EntityModel | null {
    return this.composite.hitTest(entities as Entity[], point, tolerance);
  }

  clear() {
    this.composite.clear();
  }
}

// ✅ ΔΙΟΡΑΘΩΣΗ ΔΙΠΛΟΤΥΠΟΥ: EntityRendererComposite αφαιρέθηκε - χρήση direct import από ../rendering/core/EntityRendererComposite
export { createEntityRenderer } from '../rendering/entities';
export type { RenderOptions } from '../rendering/entities';