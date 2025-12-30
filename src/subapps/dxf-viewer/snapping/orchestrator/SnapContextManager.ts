/**
 * SnapContextManager
 * Creates engine contexts and manages utility methods
 */

import type { Point2D } from '../../rendering/types/Types';
import { ExtendedSnapType, type Entity, type ProSnapSettings } from '../extended-types';
import { SnapEngineContext } from '../shared/BaseSnapEngine';

interface Viewport {
  worldPerPixelAt(p: Point2D): number;
  worldToScreen(p: Point2D): Point2D;
}

export class SnapContextManager {
  private viewport: Viewport | null = null;
  private lastCalibWpp = 1;

  constructor(private settings: ProSnapSettings) {}

  setViewport(viewport: Viewport | null): void {
    this.viewport = viewport;
  }

  updateSettings(settings: Partial<ProSnapSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  createEngineContext(
    cursorPoint: Point2D, 
    entities: Entity[],
    excludeEntityId?: string
  ): SnapEngineContext {
    return {
      entities,
      worldRadiusAt: (point: Point2D) => this.worldRadiusAt(point),
      worldRadiusForType: (point: Point2D, snapType: ExtendedSnapType) => this.worldRadiusForType(point, snapType),
      pixelTolerance: this.settings.pixelTolerance,
      perModePxTolerance: this.settings.perModePxTolerance as Record<ExtendedSnapType, number> | undefined,
      excludeEntityId,
      maxCandidates: 50 // Configurable limit
    };
  }

  private worldRadiusAt(point: Point2D): number {
    const wpp = this.viewport?.worldPerPixelAt(point) ?? (this.lastCalibWpp || 1);
    return this.settings.snapDistance * wpp;
  }

  private worldRadiusForType(point: Point2D, snapType: ExtendedSnapType): number {
    const customTolerance = this.settings.perModePxTolerance?.[snapType];
    const pixelRadius = customTolerance ?? this.settings.snapDistance;
    const wpp = this.viewport?.worldPerPixelAt(point) ?? (this.lastCalibWpp || 1);
    return pixelRadius * wpp;
  }

  getSettings(): ProSnapSettings {
    return this.settings;
  }

  getViewport(): Viewport | null {
    return this.viewport;
  }
}