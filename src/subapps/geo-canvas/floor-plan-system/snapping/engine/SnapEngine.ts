/**
 * 📍 SNAP ENGINE
 *
 * Main snap engine class - coordinates all snap functionality
 *
 * @module floor-plan-system/snapping/engine/SnapEngine
 *
 * Responsibilities:
 * - Manage snap points collection
 * - Calculate nearest snap point
 * - Handle snap state
 * - Provide snap results
 */

import type { ParserResult } from '../../types';
import { SnapPoint, SnapResult, SnapSettings, SnapPointCollection, SnapMode } from '../types';
import { extractEndpoints, deduplicateSnapPoints } from './endpoint-detector';
import { findNearestSnapPoint } from './snap-distance';
import { DEFAULT_SNAP_SETTINGS } from '../config';

/**
 * SnapEngine Class
 *
 * Main engine για snap functionality
 */
export class SnapEngine {
  // ===================================================================
  // PROPERTIES
  // ===================================================================

  /** Current snap settings */
  private settings: SnapSettings;

  /** Cached snap points από DXF */
  private snapPoints: SnapPoint[] = [];

  /** Current snap result (null if no snap active) */
  private currentSnapResult: SnapResult | null = null;

  /** Is engine initialized? */
  private initialized: boolean = false;

  // ===================================================================
  // CONSTRUCTOR
  // ===================================================================

  constructor(settings?: Partial<SnapSettings>) {
    this.settings = {
      ...DEFAULT_SNAP_SETTINGS,
      ...settings
    };
  }

  // ===================================================================
  // INITIALIZATION
  // ===================================================================

  /**
   * Initialize snap engine with DXF data
   *
   * @param parserResult - DXF parser result
   */
  public initialize(parserResult: ParserResult | null): void {
    console.debug('🔧 SnapEngine: Initializing...');

    if (!parserResult) {
      console.warn('⚠️ SnapEngine: No parser result provided');
      this.snapPoints = [];
      this.initialized = false;
      return;
    }

    // Extract endpoints from DXF
    const endpoints = extractEndpoints(parserResult);
    console.debug(`📍 SnapEngine: Extracted ${endpoints.length} endpoints`);

    // Deduplicate points
    this.snapPoints = deduplicateSnapPoints(endpoints);
    console.debug(`📍 SnapEngine: ${this.snapPoints.length} unique snap points after deduplication`);

    this.initialized = true;
    console.debug('✅ SnapEngine: Initialized successfully');
  }

  // ===================================================================
  // SNAP CALCULATION
  // ===================================================================

  /**
   * Calculate snap for current cursor position
   *
   * @param cursorX - Cursor X coordinate (floor plan space)
   * @param cursorY - Cursor Y coordinate (floor plan space)
   * @returns SnapResult if snap found, null otherwise
   */
  public calculateSnap(cursorX: number, cursorY: number): SnapResult | null {
    if (!this.initialized || !this.settings.enabled) {
      this.currentSnapResult = null;
      return null;
    }

    // Find nearest snap point
    this.currentSnapResult = findNearestSnapPoint(
      cursorX,
      cursorY,
      this.snapPoints,
      this.settings
    );

    return this.currentSnapResult;
  }

  /**
   * Get current snap result
   */
  public getCurrentSnap(): SnapResult | null {
    return this.currentSnapResult;
  }

  /**
   * Clear current snap
   */
  public clearSnap(): void {
    this.currentSnapResult = null;
  }

  // ===================================================================
  // SETTINGS MANAGEMENT
  // ===================================================================

  /**
   * Update snap settings
   *
   * @param settings - Partial settings to update
   */
  public updateSettings(settings: Partial<SnapSettings>): void {
    this.settings = {
      ...this.settings,
      ...settings
    };
    console.debug('⚙️ SnapEngine: Settings updated', this.settings);
  }

  /**
   * Get current settings
   */
  public getSettings(): SnapSettings {
    return { ...this.settings };
  }

  /**
   * Enable/disable snap
   */
  public setEnabled(enabled: boolean): void {
    this.settings.enabled = enabled;
    if (!enabled) {
      this.clearSnap();
    }
  }

  /**
   * Set snap radius
   */
  public setRadius(radius: number): void {
    this.settings.radius = Math.max(3, Math.min(25, radius));
  }

  /**
   * Enable/disable specific snap mode
   */
  public toggleSnapMode(mode: SnapMode, enabled: boolean): void {
    if (enabled && !this.settings.enabledModes.includes(mode)) {
      this.settings.enabledModes.push(mode);
    } else if (!enabled) {
      this.settings.enabledModes = this.settings.enabledModes.filter(m => m !== mode);
    }
  }

  // ===================================================================
  // SNAP POINTS MANAGEMENT
  // ===================================================================

  /**
   * Get all snap points
   */
  public getSnapPoints(): SnapPoint[] {
    return [...this.snapPoints];
  }

  /**
   * Get snap points by mode
   */
  public getSnapPointsByMode(mode: SnapMode): SnapPoint[] {
    return this.snapPoints.filter(point => point.mode === mode);
  }

  /**
   * Get snap points collection (organized by mode and entity)
   */
  public getSnapPointCollection(): SnapPointCollection {
    const byMode: Record<SnapMode, SnapPoint[]> = {
      [SnapMode.ENDPOINT]: [],
      [SnapMode.MIDPOINT]: [],
      [SnapMode.CENTER]: [],
      [SnapMode.INTERSECTION]: [],
      [SnapMode.NEAREST]: [],
      [SnapMode.PERPENDICULAR]: []
    };

    const byEntity: Record<string, SnapPoint[]> = {};

    // Group points
    for (const point of this.snapPoints) {
      // By mode
      byMode[point.mode].push(point);

      // By entity
      if (point.entityId) {
        if (!byEntity[point.entityId]) {
          byEntity[point.entityId] = [];
        }
        byEntity[point.entityId].push(point);
      }
    }

    return {
      points: this.snapPoints,
      byMode,
      byEntity
    };
  }

  // ===================================================================
  // UTILITY
  // ===================================================================

  /**
   * Is engine initialized?
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Is snap enabled?
   */
  public isEnabled(): boolean {
    return this.settings.enabled;
  }

  /**
   * Get snap points count
   */
  public getSnapPointsCount(): number {
    return this.snapPoints.length;
  }

  /**
   * Reset engine
   */
  public reset(): void {
    this.snapPoints = [];
    this.currentSnapResult = null;
    this.initialized = false;
    console.debug('🔄 SnapEngine: Reset');
  }
}

/**
 * Create snap engine instance
 */
export function createSnapEngine(settings?: Partial<SnapSettings>): SnapEngine {
  return new SnapEngine(settings);
}
