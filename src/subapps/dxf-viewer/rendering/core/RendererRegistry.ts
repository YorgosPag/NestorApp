/**
 * 📋 RENDERER REGISTRY
 * ✅ CENTRALIZED: Plugin-like registration για entity renderers
 *
 * ⚠️  ΠΡΙΝ ΔΗΜΙΟΥΡΓΗΣΕΙΣ ΝΕΟ ENTITY RENDERER:
 * 📖 Architecture Guide: src/subapps/dxf-viewer/docs/CENTRALIZED_SYSTEMS.md
 * 🔍 Section: "Entity Management Systems" - Ελέγξε τους υπάρχοντες renderers
 *
 * 🏢 ENTERPRISE PATTERN: Registry Pattern για extensible rendering system
 *
 * @example
 * // ✅ ΣΩΣΤΑ - Register through registry
 * registry.register('line', () => new LineRenderer());
 *
 * // ❌ ΛΑΘΟΣ - Direct renderer usage without registration
 * const renderer = new LineRenderer(); // Skip registry
 */

import type { BaseEntityRenderer } from '../entities/BaseEntityRenderer';
import type { IRenderContext } from './IRenderContext';

/**
 * Κεντρικό registry για όλους τους entity renderers
 * Επιτρέπει runtime registration και hot-swapping
 */
export class RendererRegistry {
  private renderers = new Map<string, RendererFactory>();
  private instances = new Map<string, BaseEntityRenderer>();
  private context?: IRenderContext;

  /**
   * Register a renderer factory for an entity type
   */
  register(entityType: string, factory: RendererFactory): void {
    this.renderers.set(entityType.toLowerCase(), factory);

    // Clear existing instance to force recreation with new factory
    this.instances.delete(entityType.toLowerCase());
  }

  /**
   * Register multiple renderers at once
   */
  registerBatch(renderers: Record<string, RendererFactory>): void {
    Object.entries(renderers).forEach(([type, factory]) => {
      this.register(type, factory);
    });
  }

  /**
   * Get or create renderer instance for entity type
   */
  getRenderer(entityType: string): BaseEntityRenderer | null {
    const normalizedType = entityType.toLowerCase();

    // Return cached instance if available
    if (this.instances.has(normalizedType)) {
      return this.instances.get(normalizedType)!;
    }

    // Create new instance using factory
    const factory = this.renderers.get(normalizedType);
    if (factory && this.context) {
      const renderer = factory(this.context);
      this.instances.set(normalizedType, renderer);
      return renderer;
    }

    return null;
  }

  /**
   * Set render context - all renderers will be recreated
   */
  setRenderContext(context: IRenderContext): void {
    this.context = context;

    // Clear all instances to force recreation with new context
    this.instances.clear();
  }

  /**
   * Check if renderer is registered for entity type
   */
  hasRenderer(entityType: string): boolean {
    return this.renderers.has(entityType.toLowerCase());
  }

  /**
   * Get all registered entity types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.renderers.keys());
  }

  /**
   * Unregister renderer for entity type
   */
  unregister(entityType: string): boolean {
    const normalizedType = entityType.toLowerCase();
    const hadRenderer = this.renderers.delete(normalizedType);
    this.instances.delete(normalizedType);
    return hadRenderer;
  }

  /**
   * Clear all renderers
   */
  clear(): void {
    this.renderers.clear();
    this.instances.clear();
  }

  /**
   * Register common entity aliases
   */
  registerAliases(): void {
    // Common DXF entity aliases
    const aliases = {
      'lwpolyline': this.renderers.get('polyline'),
      'mtext': this.renderers.get('text'),
      'rect': this.renderers.get('rectangle'),
      'ellipse': this.renderers.get('ellipse'),
    };

    Object.entries(aliases).forEach(([alias, factory]) => {
      if (factory) {
        this.renderers.set(alias, factory);
      }
    });
  }

  /**
   * Get statistics about registered renderers
   */
  getStats(): RegistryStats {
    return {
      totalRegistered: this.renderers.size,
      totalInstances: this.instances.size,
      registeredTypes: this.getRegisteredTypes(),
      hasContext: !!this.context
    };
  }
}

/**
 * Factory function type για δημιουργία renderers
 */
export type RendererFactory = (context: IRenderContext) => BaseEntityRenderer;

/**
 * Registry statistics
 */
export interface RegistryStats {
  totalRegistered: number;
  totalInstances: number;
  registeredTypes: string[];
  hasContext: boolean;
}

/**
 * Global registry instance - singleton pattern
 */
export const globalRendererRegistry = new RendererRegistry();