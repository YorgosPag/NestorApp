/**
 * 🔧 SNAP ENGINE REGISTRY
 * Manages registration and initialization of snap engines
 *
 * ⚠️  ΠΡΙΝ ΠΡΟΣΘΕΣΕΙΣ ΝΕΟ SNAP ENGINE:
 * 📖 Architecture Guide: src/subapps/dxf-viewer/docs/CENTRALIZED_SYSTEMS.md
 * 🔍 Section: "Snapping Systems" - Δες τους υπάρχοντες engines
 *
 * 🏢 ENTERPRISE PATTERN: Registry για extensible snap engine system
 *
 * @example
 * // ✅ ΣΩΣΤΑ - Register new engine
 * registry.registerEngine(ExtendedSnapType.CUSTOM, CustomSnapEngine);
 *
 * // ❌ ΛΑΘΟΣ - Direct instantiation
 * const engine = new CustomSnapEngine(); // Παρακάμπτει το registry
 */

// DEBUG FLAG - Set to true for debugging snap issues
const DEBUG_SNAP_ENGINE_REGISTRY = false;

import { ExtendedSnapType, Entity, ProSnapSettings, SnapEngineStats } from '../extended-types';
import { BaseSnapEngine } from '../shared/BaseSnapEngine';
import type { Point2D } from '../../rendering/types/Types';
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
import { GridSnapEngine } from '../engines/GridSnapEngine';
import { GuideSnapEngine } from '../engines/GuideSnapEngine';
import { ConstructionPointSnapEngine } from '../engines/ConstructionPointSnapEngine';
import { DimDefPointSnapEngine } from '../engines/DimDefPointSnapEngine';
import { DimLineSnapEngine } from '../engines/DimLineSnapEngine';
import { ColumnCenterSnapEngine } from '../engines/ColumnCenterSnapEngine';

interface Viewport {
  worldPerPixelAt(p: Point2D): number;
  worldToScreen(p: Point2D): Point2D;
}

interface SnapEngineRegistryStats {
  enabledEngines: ExtendedSnapType[];
  engineStats: Record<string, SnapEngineStats>;
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
    this.engines.set(ExtendedSnapType.GRID, new GridSnapEngine());
    // ADR-189: Construction guide snap
    this.engines.set(ExtendedSnapType.GUIDE, new GuideSnapEngine());
    // ADR-189 §3.7-3.16: Construction snap points
    this.engines.set(ExtendedSnapType.CONSTRUCTION_POINT, new ConstructionPointSnapEngine());
    // ADR-362 I1: Dimension snap — def points + dim line
    this.engines.set(ExtendedSnapType.DIM_DEF_POINT, new DimDefPointSnapEngine());
    this.engines.set(ExtendedSnapType.DIM_LINE, new DimLineSnapEngine());
    // ADR-363 Phase 5.5i: Column center axis snap (structural precision)
    this.engines.set(ExtendedSnapType.BIM_COLUMN_CENTER, new ColumnCenterSnapEngine());
  }

  initializeEnginesWithEntities(entities: Entity[], settings: ProSnapSettings): void {
    if (DEBUG_SNAP_ENGINE_REGISTRY) {
      console.log('🔧 [SnapEngineRegistry] initializeEnginesWithEntities:', {
        entitiesCount: entities.length,
        enabledTypes: Array.from(settings.enabledTypes)
      });
    }

    // 🏢 ENTERPRISE: Αυτόματη σύνδεση gridStep με GridSnapEngine
    // Όταν αρχικοποιούνται τα engines, το GridSnapEngine λαμβάνει το gridStep από τα settings
    if (settings.gridStep !== undefined) {
      this.updateGridSettings(settings.gridStep);
    }

    // Καλούμε initialize σε όλα τα enabled engines
    let initializedCount = 0;
    this.engines.forEach((engine, snapType) => {
      if (settings.enabledTypes.has(snapType)) {
        if (DEBUG_SNAP_ENGINE_REGISTRY) {
          console.log(`🔧 [SnapEngineRegistry] Initializing ${snapType} engine with ${entities.length} entities`);
        }
        engine.initialize(entities);
        initializedCount++;
      }
    });

    if (DEBUG_SNAP_ENGINE_REGISTRY) {
      console.log(`🔧 [SnapEngineRegistry] Initialized ${initializedCount} engines`);
    }
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

  /**
   * 🔲 Update grid snap settings
   * Called when grid settings change (e.g., gridStep, majorInterval)
   */
  updateGridSettings(gridStep: number, majorInterval?: number): void {
    const gridEngine = this.engines.get(ExtendedSnapType.GRID);
    if (gridEngine && gridEngine instanceof GridSnapEngine) {
      gridEngine.setGridStep(gridStep);
      if (majorInterval !== undefined) {
        gridEngine.setMajorInterval(majorInterval);
      }
    }
  }

  /**
   * ADR-189: Update guide snap engine with current guides
   * Called when GuideStore changes
   */
  updateGuideData(guides: readonly import('../../systems/guides/guide-types').Guide[]): void {
    const guideEngine = this.engines.get(ExtendedSnapType.GUIDE);
    if (guideEngine && guideEngine instanceof GuideSnapEngine) {
      guideEngine.setGuides(guides);
    }
  }

  // ADR-189 §3.7-3.16: ConstructionPointSnapEngine reads directly from the singleton
  // ConstructionPointStore — no manual sync needed (removed updateConstructionPointData).

  getEngineStats(enabledTypes: Set<ExtendedSnapType>): SnapEngineRegistryStats {
    const stats: SnapEngineRegistryStats = {
      enabledEngines: Array.from(enabledTypes),
      engineStats: {}
    };

    // Συλλογή stats από κάθε engine
    this.engines.forEach((engine, snapType) => {
      if (enabledTypes.has(snapType)) {
        const engineStats = (engine as BaseSnapEngine & { getStats?: () => SnapEngineStats }).getStats?.();
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