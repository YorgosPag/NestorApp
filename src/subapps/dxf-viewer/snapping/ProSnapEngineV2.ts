/**
 * Pro Snap Engine V2 - Refactored
 * Main snap engine that orchestrates core functionality, logging, and presets
 */

import { ExtendedSnapType } from './extended-types';
import type {
  ProSnapSettings,
  ProSnapResult,
  Entity,
  Point2D,
  SnapEngineInterface,
  SnapEngineStats
} from './extended-types';
import { SnapEngineCore } from './SnapEngineCore';
import { SnapDebugLogger } from '../debug/loggers/SnapDebugLogger';
import { SnapPresets } from './SnapPresets';

interface Viewport {
  worldPerPixelAt(p: Point2D): number;
  worldToScreen(p: Point2D): Point2D;
  scale: number;
}

export class ProSnapEngineV2 implements SnapEngineInterface {
  private core: SnapEngineCore;
  private logger: SnapDebugLogger;
  private presets: SnapPresets;

  constructor(initialSettings?: Partial<ProSnapSettings>) {
    this.core = new SnapEngineCore(initialSettings);
    this.logger = new SnapDebugLogger(this.core);
    this.presets = new SnapPresets(this.core);
  }

  initialize(entities: Entity[], viewport?: Viewport): void {
    this.core.setViewport(viewport);
    // ✅ μόνο όταν είναι enabled κάνουμε log για να μη βρέχει logs όσο σέρνουμε
    if (this.core.isEnabled()) {
      this.logger.logViewportSet(!!viewport);
      this.logger.logInitialization(entities);
    }
    this.core.initialize(entities, viewport);
  }

  updateSettings(settings: Partial<ProSnapSettings>): void {
    this.core.updateSettings(settings);
  }

  getSettings(): ProSnapSettings {
    return this.core.getSettings();
  }

  // ✅ Wrapper methods for legacy compatibility
  setSnapSettings(settings: Partial<ProSnapSettings>): void {
    this.updateSettings(settings);
  }

  getSnapSettings(): ProSnapSettings {
    return this.getSettings();
  }

  setViewport(viewport?: Viewport): void {
    // ✅ μόνο όταν είναι enabled κάνουμε log για να μη βρέχει logs όσο σέρνουμε
    if (this.core.isEnabled()) {
      this.logger.logViewportSet(!!viewport);
    }
    this.core.setViewport(viewport);
  }

  findSnapPoint(cursorPoint: Point2D, excludeEntityId?: string): ProSnapResult {
    this.logger.logFindSnapPoint(cursorPoint);
    const result = this.core.findSnapPoint(cursorPoint, excludeEntityId);
    this.logger.logSnapResult(result);
    return result;
  }

  setEnabled(enabled: boolean): void {
    this.core.setEnabled(enabled);
  }

  toggleSnapType(snapType: ExtendedSnapType, enabled: boolean): void {
    this.core.toggleSnapType(snapType, enabled);
  }

  cycleCandidates(): void {
    this.core.cycleCandidates();
  }

  resetCandidateIndex(): void {
    this.core.resetCandidateIndex();
  }

  // --------- BACKWARDS COMPATIBILITY METHODS ---------

  /**
   * @deprecated Use updateSettings instead
   */
  setSnapDistance(distance: number): void {
    this.updateSettings({ snapDistance: distance });
  }

  /**
   * @deprecated Use updateSettings instead
   */
  enableSnapType(snapType: ExtendedSnapType): void {
    const settings = this.core.getSettings();
    const enabledTypes = new Set(settings.enabledTypes);
    enabledTypes.add(snapType);
    this.updateSettings({ enabledTypes });
  }

  /**
   * @deprecated Use updateSettings instead
   */
  disableSnapType(snapType: ExtendedSnapType): void {
    const settings = this.core.getSettings();
    const enabledTypes = new Set(settings.enabledTypes);
    enabledTypes.delete(snapType);
    this.updateSettings({ enabledTypes });
  }

  /**
   * @deprecated Use getStats instead
   */
  getDebugInfo(): SnapEngineStats {
    return this.getStats();
  }

  // --------- UTILITY METHODS ---------

  getStats(): SnapEngineStats {
    // 🏢 ENTERPRISE: Logger returns SnapDebugStats with orchestrator.engineStats
    // Each engine in engineStats contains SnapEngineStats, we aggregate them
    const debugStats = this.logger.getStats();
    const engineStats = debugStats.orchestrator?.engineStats ?? {};

    // Aggregate stats from all engines
    let totalSnapAttempts = 0;
    let successfulSnaps = 0;
    let totalSearchTime = 0;
    let totalEntities = debugStats.orchestrator?.totalEntities ?? 0;
    const snapsByType: Partial<Record<ExtendedSnapType, number>> = {};

    // Iterate through each engine's stats
    for (const [engineType, stats] of Object.entries(engineStats)) {
      if (stats && typeof stats === 'object') {
        totalSnapAttempts += (stats as SnapEngineStats).totalSnapAttempts ?? 0;
        successfulSnaps += (stats as SnapEngineStats).successfulSnaps ?? 0;
        totalSearchTime += (stats as SnapEngineStats).averageSearchTime ?? 0;
        totalEntities += (stats as SnapEngineStats).totalEntitiesProcessed ?? 0;

        // Merge snapsByType
        const typeStats = (stats as SnapEngineStats).snapsByType;
        if (typeStats) {
          for (const [type, count] of Object.entries(typeStats)) {
            const key = type as ExtendedSnapType;
            snapsByType[key] = (snapsByType[key] ?? 0) + count;
          }
        }
      }
    }

    const engineCount = Object.keys(engineStats).length || 1;

    return {
      totalSnapAttempts,
      successfulSnaps,
      snapsByType: snapsByType as Record<ExtendedSnapType, number>,
      averageSearchTime: totalSearchTime / engineCount,
      totalEntitiesProcessed: totalEntities,
      lastResetTime: Date.now(),
      totalEntities
    };
  }

  dispose(): void {
    this.core.dispose();
    this.logger.dispose();
  }

  // --------- CONFIGURATION PRESETS ---------

  /**
   * Προεπιλογή για αρχιτεκτονικά σχέδια
   */
  setArchitecturalPreset(): void {
    this.presets.setArchitecturalPreset();
  }

  /**
   * Προεπιλογή για μηχανικά σχέδια
   */
  setEngineeringPreset(): void {
    this.presets.setEngineeringPreset();
  }

  /**
   * Απλοποιημένη προεπιλογή για γρήγορη εργασία
   */
  setSimplePreset(): void {
    this.presets.setSimplePreset();
  }
}