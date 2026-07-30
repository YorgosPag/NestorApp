/**
 * SnapContextManager
 * Creates engine contexts and manages utility methods
 */

import type { Point2D } from '../../rendering/types/Types';
import { ExtendedSnapType, type Entity, type ProSnapSettings } from '../extended-types';
import { SnapEngineContext } from '../shared/BaseSnapEngine';
// ADR-728 Φ2 — η ημιπλευρά του aperture box υπολογίζεται από ΤΙΣ ΙΔΙΕΣ συναρτήσεις ανοχής που
// παραδίδονται στις engines· ο manager τις κατέχει, άρα εδώ ζει και ο υπολογισμός.
import { resolveBroadPhaseAperture } from './snap-broad-phase';

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

  /**
   * 🎯 ADR-728 Φ2 — η ημιπλευρά του aperture box για το broad phase, στη θέση του κέρσορα.
   *
   * Ζει εδώ επειδή **εδώ ζουν οι ανοχές**: `snapDistance`, `perModePxTolerance`, και η μετατροπή
   * pixel→world μέσω του viewport. Ο orchestrator ρωτά· δεν ξαναϋπολογίζει.
   */
  getBroadPhaseAperture(cursorPoint: Point2D): number {
    return resolveBroadPhaseAperture(cursorPoint, this.settings.enabledTypes, {
      worldRadiusAt: (point: Point2D) => this.worldRadiusAt(point),
      worldRadiusForType: (point: Point2D, snapType: ExtendedSnapType) => this.worldRadiusForType(point, snapType),
    });
  }

  /**
   * @param entities — το **broad-phase φιλτραρισμένο** σύνολο (κανονικό μονοπάτι των engines).
   * @param allEntities — ο **πλήρης** πίνακας σκηνής· παραλείπεται ⇒ ταυτίζεται με το `entities`
   *   (pass-through, ίδια συμπεριφορά με πριν τη Φ2 — ADR-728 §Φ2 «δικλείδα»).
   */
  createEngineContext(
    cursorPoint: Point2D,
    entities: Entity[],
    excludeEntityId?: string,
    allEntities?: Entity[]
  ): SnapEngineContext {
    return {
      entities,
      allEntities: allEntities ?? entities,
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
      return wpp;
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