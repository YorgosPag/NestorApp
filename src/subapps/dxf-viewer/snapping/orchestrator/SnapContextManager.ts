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
  private debugCounter = 0; // 🔍 DIAGNOSTIC: Remove after confirming snap tolerance

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
      perModePxTolerance: this.settings.perModePxTolerance as Record<ExtendedSnapType, number> | undefined,
      excludeEntityId,
      maxCandidates: 8 // 🏢 FIX (2026-02-20): Reduced from 20 — only need best few candidates
    };
  }

  private worldRadiusAt(point: Point2D): number {
    const wpp = this.resolveWorldPerPixel(point);
    return this.settings.snapDistance * wpp;
  }

  private worldRadiusForType(point: Point2D, snapType: ExtendedSnapType): number {
    const customTolerance = this.settings.perModePxTolerance?.[snapType];
    const pixelRadius = customTolerance ?? this.settings.snapDistance;
    const wpp = this.resolveWorldPerPixel(point);
    return pixelRadius * wpp;
  }

  /**
   * 🏢 FIX (2026-02-20): Resolve world-per-pixel with proper caching.
   * Updates lastCalibWpp whenever viewport is available, so the fallback
   * stays accurate even during transient viewport=null states.
   */
  private resolveWorldPerPixel(point: Point2D): number {
    if (this.viewport) {
      const wpp = this.viewport.worldPerPixelAt(point);
      this.lastCalibWpp = wpp; // Cache latest known value

      // 🔍 DIAGNOSTIC: Log every 200 calls to verify pixel→world conversion
      // Shows actual tolerance values — REMOVE after confirming snap works correctly
      this.debugCounter++;
      if (this.debugCounter % 200 === 1) {
        const endpointTol = (this.settings.perModePxTolerance as Record<string, number> | undefined)?.['ENDPOINT'] ?? this.settings.snapDistance;
        console.log(`🎯 SNAP DIAG: wpp=${wpp.toFixed(6)}, hasViewport=true, ENDPOINT=${endpointTol}px → ${(endpointTol * wpp).toFixed(3)} world units`);
      }

      return wpp;
    }

    // 🔍 DIAGNOSTIC: Log fallback usage
    this.debugCounter++;
    if (this.debugCounter % 200 === 1) {
      console.warn(`⚠️ SNAP DIAG: NO VIEWPORT! Using fallback wpp=${this.lastCalibWpp}`);
    }

    return this.lastCalibWpp || 1;
  }

  getSettings(): ProSnapSettings {
    return this.settings;
  }

  getViewport(): Viewport | null {
    return this.viewport;
  }
}