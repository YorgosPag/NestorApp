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
import { OrthoTrackSnapEngine } from '../engines/OrthoTrackSnapEngine';
import { GridSnapEngine } from '../engines/GridSnapEngine';
import { GuideSnapEngine } from '../engines/GuideSnapEngine';
import { ConstructionPointSnapEngine } from '../engines/ConstructionPointSnapEngine';
import { DimDefPointSnapEngine } from '../engines/DimDefPointSnapEngine';
import { DimLineSnapEngine } from '../engines/DimLineSnapEngine';
// ADR-370: ONE generic BIM characteristic-point snap engine (corner/midpoint/center)
// — replaces the 5 per-entity {Wall,Beam,Slab,Column,Opening}CornerSnapEngine classes.
import { BimCharacteristicSnapEngine } from '../engines/BimCharacteristicSnapEngine';
import { SNAP_ENGINE_PRIORITIES } from '../../config/tolerance-config';
// ADR-363 Φ1G.5 Slice 2i: BIM wall face-line snap (face-to-face magnetism)
import { WallFaceSnapEngine } from '../engines/WallFaceSnapEngine';
// ADR-408 Φ9: MEP connector attach-point snap (segment endpoints / fixture / panel)
import { MepConnectorSnapEngine } from '../engines/MepConnectorSnapEngine';
// ADR-378 Phase 3: Text snap engine (TEXT/MTEXT 8-point snap — completes ADR-344 Phase 6.C)
import { TextSnapEngine } from '../engines/TextSnapEngine';
// ADR-397: rotation snap engines (pivot ⊙ + rotating entity grips — contextual, read RotationSnapStore)
import { RotationPivotSnapEngine, RotationGripSnapEngine } from '../engines/RotationPointSnapEngine';
// ADR-580: selected objects' grips snap (contextual — reads AllGripsStore; precedence over underlying entities)
import { SelectedGripSnapEngine } from '../engines/SelectedGripSnapEngine';

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
    this.engines.set(ExtendedSnapType.ORTHO_TRACK, new OrthoTrackSnapEngine());
    this.engines.set(ExtendedSnapType.GRID, new GridSnapEngine());
    // ADR-189: Construction guide snap
    this.engines.set(ExtendedSnapType.GUIDE, new GuideSnapEngine());
    // ADR-189 §3.7-3.16: Construction snap points
    this.engines.set(ExtendedSnapType.CONSTRUCTION_POINT, new ConstructionPointSnapEngine());
    // ADR-362 I1: Dimension snap — def points + dim line
    this.engines.set(ExtendedSnapType.DIM_DEF_POINT, new DimDefPointSnapEngine());
    this.engines.set(ExtendedSnapType.DIM_LINE, new DimLineSnapEngine());
    // ADR-370: ONE generic BIM structural-corner snap (priority -2 — highest structural
    // precision) for ALL BIM entities, sourced from the bim-characteristic-points SSoT.
    this.engines.set(
      ExtendedSnapType.BIM_CORNER,
      new BimCharacteristicSnapEngine(ExtendedSnapType.BIM_CORNER, 'corner', SNAP_ENGINE_PRIORITIES.BIM_CORNER),
    );
    // ADR-370: generic BIM edge/axis midpoint + centroid snaps (same engine, other categories).
    this.engines.set(
      ExtendedSnapType.BIM_MIDPOINT,
      new BimCharacteristicSnapEngine(ExtendedSnapType.BIM_MIDPOINT, 'midpoint', SNAP_ENGINE_PRIORITIES.BIM_MIDPOINT),
    );
    this.engines.set(
      ExtendedSnapType.BIM_CENTER,
      new BimCharacteristicSnapEngine(ExtendedSnapType.BIM_CENTER, 'center', SNAP_ENGINE_PRIORITIES.BIM_CENTER),
    );
    // ADR-363 Φ1G.5 Slice 2i: wall FACE line snap (face-to-face magnetism, priority -1.8)
    this.engines.set(ExtendedSnapType.BIM_WALL_FACE,      new WallFaceSnapEngine());
    // ADR-408 Φ9: MEP connector attach point (priority -1.5 — above endpoint/column centre)
    this.engines.set(ExtendedSnapType.BIM_MEP_CONNECTOR, new MepConnectorSnapEngine());
    // ADR-378 Phase 3: TEXT/MTEXT 8-point snap (insertion + corners + center + edges)
    this.engines.set(ExtendedSnapType.TEXT, new TextSnapEngine());
    // ADR-397: rotation snap — pivot ⊙ (priority -2.5) + rotating entity grips (priority 0).
    // Contextual: both read RotationSnapStore, which is empty outside a rotation op.
    this.engines.set(ExtendedSnapType.ROTATION_PIVOT, new RotationPivotSnapEngine());
    this.engines.set(ExtendedSnapType.ROTATION_GRIP, new RotationGripSnapEngine());
    // ADR-580: selected objects' grips (priority -3 — precedence over underlying entities).
    // Contextual: reads AllGripsStore, empty when nothing selected → zero cost.
    this.engines.set(ExtendedSnapType.SELECTED_GRIP, new SelectedGripSnapEngine());
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