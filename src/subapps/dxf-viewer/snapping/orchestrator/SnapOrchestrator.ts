/**
 * 🎭 SNAP ORCHESTRATOR
 * Main orchestrator that coordinates snap engines using specialized components
 *
 * ⚠️  ΠΡΙΝ ΤΡΟΠΟΠΟΙΗΣΕΙΣ ΤΟ SNAPPING SYSTEM:
 * 📖 Architecture Guide: src/subapps/dxf-viewer/docs/CENTRALIZED_SYSTEMS.md
 * 🔍 Section: "Snapping Systems" - Κατάλαβε την αρχιτεκτονική πριν αλλάξεις
 *
 * 🏢 ENTERPRISE PATTERN: Orchestrator για coordination πολλαπλών snap engines
 *
 * @example
 * // ✅ ΣΩΣΤΑ - Χρήση μέσω orchestrator
 * const snap = orchestrator.findSnap(cursor, entities, viewport);
 *
 * // ❌ ΛΑΘΟΣ - Direct engine usage
 * const snap = snapEngine.findSnap(...); // Παρακάμπτει το orchestrator
 */

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_SNAP_ORCHESTRATOR = false;

import type { Point2D } from '../../rendering/types/Types';
import { ExtendedSnapType, type Entity, type SnapEngineStats, type ProSnapSettings, type ProSnapResult, type SnapCandidate } from '../extended-types';
import { SnapEngineRegistry } from './SnapEngineRegistry';
import { SnapCandidateProcessor } from './SnapCandidateProcessor';
import { SnapContextManager } from './SnapContextManager';

interface Viewport {
  worldPerPixelAt(p: Point2D): number;
  worldToScreen(p: Point2D): Point2D;
}

export interface SnapOrchestratorStats {
  totalEntities: number;
  candidateIndex: number;
  enabledEngines: ExtendedSnapType[];
  engineStats: Record<string, SnapEngineStats>;
}

export class SnapOrchestrator {
  private registry: SnapEngineRegistry;
  private processor: SnapCandidateProcessor;
  private contextManager: SnapContextManager;
  private entities: Entity[] = [];

  constructor(settings: ProSnapSettings) {
    this.registry = new SnapEngineRegistry();
    this.processor = new SnapCandidateProcessor();
    this.contextManager = new SnapContextManager(settings);
  }

  initialize(entities: Entity[], viewport?: Viewport): void {
    this.entities = entities;
    this.contextManager.setViewport(viewport || null);
    
    // Initialize engines through registry
    this.registry.initializeEnginesWithEntities(entities, this.contextManager.getSettings());
  }

  updateSettings(settings: Partial<ProSnapSettings>): void {
    this.contextManager.updateSettings(settings);

    // 🏢 ENTERPRISE: Αυτόματη ενημέρωση GridSnapEngine όταν αλλάζει το gridStep
    if (settings.gridStep !== undefined) {
      this.registry.updateGridSettings(settings.gridStep);
    }

    // Re-initialize engines αν άλλαξαν τα enabled types και έχουμε entities
    if (settings.enabledTypes && this.entities.length > 0) {
      this.registry.initializeEnginesWithEntities(this.entities, this.contextManager.getSettings());
    }
  }

  findSnapPoint(cursorPoint: Point2D, excludeEntityId?: string): ProSnapResult {
    const settings = this.contextManager.getSettings();
    
    if (!settings.enabled || settings.enabledTypes.size === 0) {

      return this.processor.processResults(cursorPoint, [], settings);
    }

    // Έλεγχος αν έχουμε entities - αν όχι, επιστρέφουμε κενό αποτέλεσμα
    if (this.entities.length === 0) {

      return this.processor.processResults(cursorPoint, [], settings);
    }

    // Debug logging (limited frequency)
    const shouldLog = DEBUG_SNAP_ORCHESTRATOR && Math.random() < 0.005; // 0.5% of calls
    if (shouldLog) {

    }

    const allCandidates: SnapCandidate[] = [];
    const context = this.contextManager.createEngineContext(cursorPoint, this.entities, excludeEntityId);

    // Εκτέλεση όλων των enabled engines
    for (const snapType of settings.priority) {
      if (!settings.enabledTypes.has(snapType)) continue;
      
      const engine = this.registry.getEngine(snapType);
      if (!engine) {

        continue;
      }

      if (shouldLog) {

      }
      const result = engine.findSnapCandidates(cursorPoint, context);
      
      // Guard against null/undefined result
      if (!result) {
        if (DEBUG_SNAP_ORCHESTRATOR) console.warn(`🔺 SnapOrchestrator: ${snapType} engine returned null/undefined result`);
        continue;
      }
      
      // Early return αν το engine το ζητάει
      if (result.earlyReturn) {
        return result.earlyReturn;
      }
      
      // Guard against invalid candidates array
      if (Array.isArray(result.candidates)) {
        allCandidates.push(...result.candidates);
      } else {
        if (DEBUG_SNAP_ORCHESTRATOR) console.warn(`🔺 SnapOrchestrator: Invalid candidates from ${snapType} engine:`, result.candidates);
      }
      
      // Αν έχουμε αρκετούς candidates, σταματάμε
      if (allCandidates.length >= context.maxCandidates) {
        break;
      }
    }

    return this.processor.processResults(cursorPoint, allCandidates, settings);
  }

  cycleCandidates(): void {
    this.processor.cycleCandidates();
  }

  resetCandidateIndex(): void {
    this.processor.resetCandidateIndex();
  }

  setEnabled(enabled: boolean): void {
    const settings = this.contextManager.getSettings();
    this.contextManager.updateSettings({ enabled });
  }

  toggleSnapType(snapType: ExtendedSnapType, enabled: boolean): void {
    const settings = this.contextManager.getSettings();
    
    if (enabled) {
      settings.enabledTypes.add(snapType);
      this.registry.toggleEngine(snapType, true, this.entities);
    } else {
      settings.enabledTypes.delete(snapType);
      this.registry.toggleEngine(snapType, false, this.entities);
    }
    
    this.contextManager.updateSettings({ enabledTypes: settings.enabledTypes });
  }

  getStats(): SnapOrchestratorStats {
    const settings = this.contextManager.getSettings();
    const registryStats = this.registry.getEngineStats(settings.enabledTypes);

    return {
      ...registryStats,
      totalEntities: this.entities.length,
      candidateIndex: this.processor.getCandidateIndex()
    };
  }

  /**
   * 🔲 Update grid snap settings
   * Called when grid settings change (e.g., gridStep, majorInterval)
   */
  updateGridSettings(gridStep: number, majorInterval?: number): void {
    this.registry.updateGridSettings(gridStep, majorInterval);
  }

  dispose(): void {
    this.registry.dispose();
    this.entities = [];
  }
}