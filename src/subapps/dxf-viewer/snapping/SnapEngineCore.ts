/**
 * SnapEngineCore
 * Core snap engine functionality without logging and presets
 */

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_SNAP_ENGINE_CORE = false;

import {
  ExtendedSnapType,
  type ProSnapSettings,
  ProSnapResult,
  Entity,
  Point2D,
  DEFAULT_PRO_SNAP_SETTINGS,
  SnapEngineInterface
} from './extended-types';
import { SnapOrchestrator } from './orchestrator/SnapOrchestrator';

interface Viewport {
  worldPerPixelAt(p: Point2D): number;
  worldToScreen(p: Point2D): Point2D;
  scale: number;
}

export class SnapEngineCore implements SnapEngineInterface {
  protected orchestrator: SnapOrchestrator;
  protected settings: ProSnapSettings;
  protected viewport?: Viewport;

  constructor(initialSettings?: Partial<ProSnapSettings>) {
    this.settings = { ...DEFAULT_PRO_SNAP_SETTINGS, ...initialSettings };
    this.orchestrator = new SnapOrchestrator(this.settings);
  }

  initialize(entities: Entity[], viewport?: Viewport): void {
    this.viewport = viewport;
    const entitiesCount = Array.isArray(entities) ? entities.length : 'invalid array';

    this.orchestrator.initialize(entities, viewport);
  }

  updateSettings(settings: Partial<ProSnapSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.orchestrator.updateSettings(settings);
  }

  setViewport(viewport?: Viewport): void {
    this.viewport = viewport || undefined;
  }

  findSnapPoint(cursorPoint: Point2D, excludeEntityId?: string): ProSnapResult {
    return this.orchestrator.findSnapPoint(cursorPoint, excludeEntityId);
  }

  setEnabled(enabled: boolean): void {
    this.settings.enabled = enabled;
    this.orchestrator.setEnabled(enabled);
  }

  isEnabled(): boolean {
    return this.settings.enabled;
  }

  toggleSnapType(snapType: ExtendedSnapType, enabled: boolean): void {
    this.orchestrator.toggleSnapType(snapType, enabled);
  }

  cycleCandidates(): void {
    this.orchestrator.cycleCandidates();
  }

  resetCandidateIndex(): void {
    this.orchestrator.resetCandidateIndex();
  }

  dispose(): void {
    this.orchestrator.dispose();
    this.viewport = undefined;
  }

  // Getters for protected properties
  getSettings(): ProSnapSettings {
    return this.settings;
  }

  getOrchestrator(): SnapOrchestrator {
    return this.orchestrator;
  }

  getViewport(): Viewport | undefined {
    return this.viewport;
  }
}