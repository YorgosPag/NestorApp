/**
 * Pro Snap Engine V2 - Refactored
 * Main snap engine that orchestrates core functionality, logging, and presets
 */

import {
  ExtendedSnapType,
  type ProSnapSettings,
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
    return this.logger.getStats();
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