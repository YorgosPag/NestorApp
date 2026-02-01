import type { Point2D } from '../rendering/types/Types';
import type { Region, RegionStatus, OverlayLayer } from '../types/overlay';
import { calculateRegionArea, calculateRegionPerimeter } from '../types/overlay';
import { getStatusColors } from '../config/color-mapping';
// 🏢 ADR-134: Centralized Opacity Constants
import { UI_COLORS, OPACITY } from '../config/color-config';
// 🏢 ADR-079: Centralized Geometric Precision Constants
import { GEOMETRY_PRECISION } from '../config/tolerance-config';

// Local interface for layer management (different from the centralized OverlayLayer union type)
interface RegionLayerObject {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  regionIds: string[];
  order: number;
}

/**
 * Utility functions for region geometry and validation
 */
export class RegionGeometry {
  // 🏢 ADR-079: Using centralized region epsilon
  private static readonly EPSILON = GEOMETRY_PRECISION.REGION_EPSILON;

  static nearly(a: number, b: number): boolean {
    return Math.abs(a - b) <= RegionGeometry.EPSILON;
  }

  static round3(n: number): number {
    return Math.round(n * 1000) / 1000;
  }

  static sameVertices(a: Point2D[], b: Point2D[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!RegionGeometry.nearly(a[i].x, b[i].x) || !RegionGeometry.nearly(a[i].y, b[i].y)) {
        return false;
      }
    }
    return true;
  }

  static createFingerprint(vertices: Point2D[]): string {
    // Stable fingerprint (order-preserving) rounded to 3 decimals
    return JSON.stringify(
      vertices.map(v => ({ 
        x: RegionGeometry.round3(v.x), 
        y: RegionGeometry.round3(v.y) 
      }))
    );
  }

  static validateVertices(vertices: Point2D[]): string | null {
    if (vertices.length < 3) {
      return 'Region must have at least 3 vertices';
    }

    // Check for duplicate consecutive vertices
    for (let i = 0; i < vertices.length; i++) {
      const next = (i + 1) % vertices.length;
      if (RegionGeometry.nearly(vertices[i].x, vertices[next].x) && 
          RegionGeometry.nearly(vertices[i].y, vertices[next].y)) {
        return `Duplicate vertices found at positions ${i} and ${next}`;
      }
    }

    return null;
  }

  static isValidRegion(vertices: Point2D[]): boolean {
    return RegionGeometry.validateVertices(vertices) === null;
  }
}

/**
 * Region CRUD operations
 */
export class RegionOperations {
  static generateRegionId(): string {
    // ✅ ENTERPRISE MIGRATION: Using centralized ID generation
    const { generateRandomId } = require('@/lib/obligations/utils');
    return generateRandomId('region', 7); // Same length as original (slice(2, 9) = 7 chars)
  }

  static createDefaultLayer(): RegionLayerObject {
    return {
      id: 'default',
      name: 'Default Layer',
      visible: true,
      locked: false,
      opacity: OPACITY.MEDIUM_LOW,  // 🏢 ADR-134: Centralized opacity (0.7)
      regionIds: [],
      order: 0
    };
  }

  static createRegion(
    vertices: Point2D[],
    levelId: string,
    status: RegionStatus = 'for-sale',
    options: Partial<Region> = {}
  ): Region {
    const validationError = RegionGeometry.validateVertices(vertices);
    if (validationError) {
      throw new Error(`Invalid region: ${validationError}`);
    }

    const id = RegionOperations.generateRegionId();
    const now = new Date().toISOString();

    return {
      id,
      levelId,
      layer: 'base', // Default to 'base' layer (from centralized OverlayLayer type)
      color: getStatusColors(status)?.fill || UI_COLORS.BUTTON_PRIMARY,
      opacity: OPACITY.MEDIUM_LOW,  // 🏢 ADR-134: Centralized opacity (0.7)
      status,
      vertices: vertices.map(v => ({ x: v.x, y: v.y })),
      locked: false,
      visible: true,
      area: calculateRegionArea(vertices),
      perimeter: calculateRegionPerimeter(vertices),
      createdAt: now,
      updatedAt: now,
      ...options
    };
  }

  static updateRegion(region: Region, updates: Partial<Region>): Region {
    const updated: Region = { 
      ...region, 
      ...updates, 
      updatedAt: new Date().toISOString() 
    };

    // Recalculate geometry if vertices changed
    if (updates.vertices) {
      const validationError = RegionGeometry.validateVertices(updates.vertices);
      if (validationError) {
        throw new Error(`Invalid region update: ${validationError}`);
      }
      
      updated.area = calculateRegionArea(updates.vertices);
      updated.perimeter = calculateRegionPerimeter(updates.vertices);
    }

    return updated;
  }

  static addRegionToLayer(
    layers: Record<string, RegionLayerObject>,
    layerId: string,
    regionId: string
  ): Record<string, RegionLayerObject> {
    const layer = layers[layerId] || RegionOperations.createDefaultLayer();
    
    return {
      ...layers,
      [layerId]: {
        ...layer,
        regionIds: layer.regionIds.includes(regionId) 
          ? layer.regionIds 
          : [...layer.regionIds, regionId]
      }
    };
  }

  static removeRegionFromLayers(
    layers: Record<string, RegionLayerObject>,
    regionId: string
  ): Record<string, RegionLayerObject> {
    const updatedLayers = { ...layers };
    
    Object.keys(updatedLayers).forEach(layerId => {
      updatedLayers[layerId] = {
        ...updatedLayers[layerId],
        regionIds: updatedLayers[layerId].regionIds.filter(id => id !== regionId)
      };
    });

    return updatedLayers;
  }

  static findRegionDuplicate(
    regions: Record<string, Region>,
    vertices: Point2D[],
    levelId: string,
    status: RegionStatus
  ): Region | null {
    return Object.values(regions).find(r =>
      r.levelId === levelId &&
      r.status === status &&
      RegionGeometry.sameVertices(r.vertices, vertices)
    ) || null;
  }

  static getRegionsForLevel(
    regions: Record<string, Region>,
    levelId: string
  ): Region[] {
    return Object.values(regions).filter(r => r.levelId === levelId);
  }

  static getVisibleRegions(
    regions: Record<string, Region>,
    levelId: string,
    visibleStatuses: Set<RegionStatus>,
    visibleUnitTypes?: Set<string>
  ): Region[] {
    return Object.values(regions).filter(r =>
      r.levelId === levelId &&
      r.visible &&
      visibleStatuses.has(r.status) &&
      (!r.unitType || !visibleUnitTypes || visibleUnitTypes.has(r.unitType))
    );
  }
}

/**
 * Duplicate prevention system
 */
export class DuplicationGuard {
  private static instance: DuplicationGuard;
  private guard: { sig: string; ts: number; id: string } | null = null;
  private readonly timeWindow = 800; // ms

  static getInstance(): DuplicationGuard {
    if (!DuplicationGuard.instance) {
      DuplicationGuard.instance = new DuplicationGuard();
    }
    return DuplicationGuard.instance;
  }

  checkDuplication(vertices: Point2D[]): { isDuplicate: boolean; existingId?: string } {
    const sig = RegionGeometry.createFingerprint(vertices);
    
    if (this.guard && this.guard.sig === sig) {
      const elapsed = Date.now() - this.guard.ts;
      if (elapsed < this.timeWindow) {
        console.warn('🛡️ Duplicate creation blocked (time window). Returning existing id:', this.guard.id);
        return { isDuplicate: true, existingId: this.guard.id };
      }
    }

    return { isDuplicate: false };
  }

  registerCreation(vertices: Point2D[], regionId: string): void {
    const sig = RegionGeometry.createFingerprint(vertices);
    this.guard = { sig, ts: Date.now(), id: regionId };
  }

  clear(): void {
    this.guard = null;
  }
}
