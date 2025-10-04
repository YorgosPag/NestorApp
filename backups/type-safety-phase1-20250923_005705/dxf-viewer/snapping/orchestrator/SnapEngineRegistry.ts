/**
 * SnapEngineRegistry
 * Manages registration and initialization of snap engines
 */

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_SNAP_ENGINE_REGISTRY = false;

import { ExtendedSnapType, Entity, ProSnapSettings } from '../extended-types';
import { BaseSnapEngine } from '../shared/BaseSnapEngine';
import { EndpointSnapEngine } from '../engines/EndpointSnapEngine';
import { MidpointSnapEngine } from '../engines/MidpointSnapEngine';
import { IntersectionSnapEngine } from '../engines/IntersectionSnapEngine';
import { CenterSnapEngine } from '../engines/CenterSnapEngine';
import { QuadrantSnapEngine } from '../engines/QuadrantSnapEngine';
import { NearestSnapEngine } from '../engines/NearestSnapEngine';
import { TangentSnapEngine } from '../engines/TangentSnapEngine';
import { ParallelSnapEngine } from '../engines/ParallelSnapEngine';
import { ExtensionSnapEngine } from '../engines/ExtensionSnapEngine';
import { NodeSnapEngine } from '../engines/NodeSnapEngine';
import { InsertionSnapEngine } from '../engines/InsertionSnapEngine';
import { NearSnapEngine } from '../engines/NearSnapEngine';
import { PerpendicularSnapEngine } from '../engines/PerpendicularSnapEngine';
import { OrthoSnapEngine } from '../engines/OrthoSnapEngine';

interface Viewport {
  worldPerPixelAt(p: { x: number; y: number }): number;
  worldToScreen(p: { x: number; y: number }): { x: number; y: number };
}

export class SnapEngineRegistry {
  private engines = new Map<ExtendedSnapType, BaseSnapEngine>();
  
  constructor() {
    this.initializeEngines();
  }

  private initializeEngines(): void {
    // Καταχώρηση όλων των διαθέσιμων engines
    this.engines.set(ExtendedSnapType.ENDPOINT, new EndpointSnapEngine());
    this.engines.set(ExtendedSnapType.MIDPOINT, new MidpointSnapEngine());
    this.engines.set(ExtendedSnapType.INTERSECTION, new IntersectionSnapEngine());
    this.engines.set(ExtendedSnapType.CENTER, new CenterSnapEngine());
    this.engines.set(ExtendedSnapType.QUADRANT, new QuadrantSnapEngine());
    this.engines.set(ExtendedSnapType.NEAREST, new NearestSnapEngine());
    this.engines.set(ExtendedSnapType.TANGENT, new TangentSnapEngine());
    this.engines.set(ExtendedSnapType.PARALLEL, new ParallelSnapEngine());
    this.engines.set(ExtendedSnapType.EXTENSION, new ExtensionSnapEngine());
    this.engines.set(ExtendedSnapType.NODE, new NodeSnapEngine());
    this.engines.set(ExtendedSnapType.INSERTION, new InsertionSnapEngine());
    this.engines.set(ExtendedSnapType.NEAR, new NearSnapEngine());
    this.engines.set(ExtendedSnapType.PERPENDICULAR, new PerpendicularSnapEngine());
    this.engines.set(ExtendedSnapType.ORTHO, new OrthoSnapEngine());

    if (DEBUG_SNAP_ENGINE_REGISTRY) console.log('🎯 SnapEngineRegistry: Initialized', this.engines.size, 'snap engines');
  }

  initializeEnginesWithEntities(entities: Entity[], settings: ProSnapSettings): void {
    // Καλούμε initialize σε όλα τα enabled engines
    this.engines.forEach((engine, snapType) => {
      if (settings.enabledTypes.has(snapType)) {
        engine.initialize(entities);
      }
    });
  }

  getEngine(snapType: ExtendedSnapType): BaseSnapEngine | undefined {
    return this.engines.get(snapType);
  }

  getAllEngines(): Map<ExtendedSnapType, BaseSnapEngine> {
    return this.engines;
  }

  toggleEngine(snapType: ExtendedSnapType, enabled: boolean, entities: Entity[]): void {
    const engine = this.engines.get(snapType);
    if (!engine) return;

    if (enabled) {
      engine.initialize(entities);
    } else {
      engine.dispose();
    }
  }

  getEngineStats(enabledTypes: Set<ExtendedSnapType>): any {
    const stats: any = {
      enabledEngines: Array.from(enabledTypes),
      engineStats: {}
    };

    // Συλλογή stats από κάθε engine
    this.engines.forEach((engine, snapType) => {
      if (enabledTypes.has(snapType)) {
        const engineStats = (engine as any).getStats?.();
        if (engineStats) {
          stats.engineStats[snapType] = engineStats;
        }
      }
    });

    return stats;
  }

  dispose(): void {
    this.engines.forEach(engine => {
      engine.dispose();
    });
    this.engines.clear();
  }
}