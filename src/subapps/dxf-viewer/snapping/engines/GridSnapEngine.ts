/**
 * 🔲 GRID SNAP ENGINE
 * Υπεύθυνο για snap σε σημεία πλέγματος (grid points)
 *
 * ⚠️ ENTERPRISE PATTERN:
 * - Δεν χρειάζεται entities - υπολογίζει δυναμικά τα grid points
 * - Υποστηρίζει όλα τα grid styles: dots, lines, crosses
 * - Grid points = σημεία διασταύρωσης του grid
 *
 * @example
 * // Για gridStep = 10:
 * // Grid points: (0,0), (10,0), (20,0), (0,10), (10,10), ...
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
import { BaseSnapEngine, SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { calculateDistance, pointsEqual } from '../../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ADR-079: Centralized Axis Detection Constants
import { AXIS_DETECTION, SNAP_ENGINE_PRIORITIES } from '../../config/tolerance-config';

/**
 * 🏢 ENTERPRISE GRID SNAP ENGINE
 * Snap σε σημεία πλέγματος - works independently of entities
 */
export class GridSnapEngine extends BaseSnapEngine {
  private gridStep: number = 10; // Default grid step in world units
  private majorGridInterval: number = 5; // Every 5th line is major

  constructor() {
    super(ExtendedSnapType.GRID);
  }

  /**
   * Set grid step (world units)
   * Called when grid settings change
   */
  setGridStep(step: number): void {
    this.gridStep = step;
  }

  /**
   * Set major grid interval
   * e.g., 5 means every 5th grid line is major
   */
  setMajorInterval(interval: number): void {
    this.majorGridInterval = interval;
  }

  /**
   * Initialize - Grid engine doesn't need entities
   * Just stores gridStep from settings for later use
   */
  initialize(_entities: EntityModel[]): void {
    // Grid snap δεν χρειάζεται entities
    // Τα grid points υπολογίζονται δυναμικά
  }

  /**
   * 🎯 CORE SNAP LOGIC
   * Finds nearest grid point to cursor
   */
  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    const candidates: SnapCandidate[] = [];

    // Get snap radius in world units
    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.GRID);

    // Calculate nearest grid point
    const nearestGridPoint = this.findNearestGridPoint(cursorPoint);

    // Calculate distance to nearest grid point
    const distance = calculateDistance(cursorPoint, nearestGridPoint);

    // Only add candidate if within snap radius
    if (distance <= radius) {
      // Check if it's a major or minor grid point
      const isMajor = this.isMajorGridPoint(nearestGridPoint);

      candidates.push(this.createCandidate(
        nearestGridPoint,
        isMajor ? 'Grid (Major)' : 'Grid',
        distance,
        isMajor ? SNAP_ENGINE_PRIORITIES.GRID_MAJOR : SNAP_ENGINE_PRIORITIES.GRID_MINOR,
        undefined // No entity ID for grid points
      ));

      // Also check adjacent grid points (they might be closer)
      const adjacentPoints = this.getAdjacentGridPoints(cursorPoint);
      for (const point of adjacentPoints) {
        if (pointsEqual(point, nearestGridPoint)) continue;

        const adjDistance = calculateDistance(cursorPoint, point);
        if (adjDistance <= radius && adjDistance < distance) {
          const adjIsMajor = this.isMajorGridPoint(point);
          candidates.push(this.createCandidate(
            point,
            adjIsMajor ? 'Grid (Major)' : 'Grid',
            adjDistance,
            adjIsMajor ? 5 : 10,
            undefined
          ));
        }
      }
    }

    return { candidates };
  }

  /**
   * 🔲 Find nearest grid point to cursor
   * Uses simple rounding to grid step
   */
  private findNearestGridPoint(cursor: Point2D): Point2D {
    const gridX = Math.round(cursor.x / this.gridStep) * this.gridStep;
    const gridY = Math.round(cursor.y / this.gridStep) * this.gridStep;

    return { x: gridX, y: gridY };
  }

  /**
   * 🔲 Get 4 adjacent grid points around cursor
   * (floor/floor, ceil/floor, floor/ceil, ceil/ceil)
   */
  private getAdjacentGridPoints(cursor: Point2D): Point2D[] {
    const floorX = Math.floor(cursor.x / this.gridStep) * this.gridStep;
    const ceilX = Math.ceil(cursor.x / this.gridStep) * this.gridStep;
    const floorY = Math.floor(cursor.y / this.gridStep) * this.gridStep;
    const ceilY = Math.ceil(cursor.y / this.gridStep) * this.gridStep;

    return [
      { x: floorX, y: floorY },
      { x: ceilX, y: floorY },
      { x: floorX, y: ceilY },
      { x: ceilX, y: ceilY }
    ];
  }

  /**
   * 🔲 Check if a grid point is on a major grid line
   * Major = multiple of (gridStep * majorGridInterval)
   */
  /**
   * 🔲 Check if a grid point is on a major grid line
   * Major = multiple of (gridStep * majorGridInterval)
   * 🏢 ADR-079: Uses centralized grid major threshold
   */
  private isMajorGridPoint(point: Point2D): boolean {
    const majorStep = this.gridStep * this.majorGridInterval;
    const isXMajor = Math.abs(point.x % majorStep) < AXIS_DETECTION.GRID_MAJOR_THRESHOLD;
    const isYMajor = Math.abs(point.y % majorStep) < AXIS_DETECTION.GRID_MAJOR_THRESHOLD;

    return isXMajor && isYMajor;
  }

  /**
   * Cleanup - nothing to dispose for grid engine
   */
  dispose(): void {
    // No resources to clean up
  }

  /**
   * Get stats for debugging
   */
  getStats(): {
    gridStep: number;
    majorInterval: number;
  } {
    return {
      gridStep: this.gridStep,
      majorInterval: this.majorGridInterval
    };
  }
}
