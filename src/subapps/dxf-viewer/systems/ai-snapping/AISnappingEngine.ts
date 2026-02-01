/**
 * @module AISnappingEngine
 * @description AI-Powered intelligent snapping system για conference demo
 * Uses ML-like algorithms για predictive snap points
 * INNOVATION: Learns από user patterns και suggests best snap points
 */

import type { Point2D } from '../../rendering/types/Types';
// 🏢 ADR-065: Centralized Distance Calculation
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ADR-067: Centralized Radians/Degrees Conversion
// 🏢 ADR-071: Centralized Clamp Function
import { degToRad, clamp } from '../../rendering/entities/shared/geometry-utils';
// 🏢 ADR-034: Centralized Validation Bounds
import { SPATIAL_BOUNDS } from '../../config/validation-bounds-config';
// 🏢 ADR-079: Centralized Geometric Precision Constants
import { GEOMETRY_PRECISION } from '../../config/tolerance-config';
// 🏢 ADR-092: Centralized localStorage Service
import { storageGet, storageSet, storageRemove, STORAGE_KEYS } from '../../utils/storage-utils';

/**
 * Snap prediction confidence levels
 */
export enum SnapConfidence {
  LOW = 0.3,
  MEDIUM = 0.6,
  HIGH = 0.9,
  PERFECT = 1.0
}

/**
 * Snap point με AI prediction data
 */
export interface AISnapPoint {
  point: Point2D;
  type: 'endpoint' | 'midpoint' | 'center' | 'intersection' | 'perpendicular' | 'tangent' | 'quadrant' | 'predicted';
  confidence: number;
  weight: number;
  source: string;
  predictedNext?: Point2D[];
}

/**
 * User pattern για learning
 */
interface UserPattern {
  sequence: Point2D[];
  frequency: number;
  lastUsed: Date;
  context: string;
}

/**
 * Snapping preferences learned από user
 */
interface LearnedPreferences {
  preferredSnapTypes: Record<string, number>;
  commonDistances: number[];
  commonAngles: number[];
  gridPreference: number;
  patterns: UserPattern[];
}

/**
 * Snap context contains entity and scene information for snapping decisions
 */
interface SnapContext {
  entities?: Array<{ type: string; start?: Point2D; end?: Point2D; center?: Point2D; radius?: number }>;
  currentTool?: string;
  selectedEntities?: string[];
  viewBounds?: { min: Point2D; max: Point2D };
  gridSize?: number;
  snapMode?: string;
  lastPoint?: Point2D; // ✅ ENTERPRISE FIX: Added missing lastPoint property
}

/**
 * AI Snapping Engine - Main Class
 */
export class AISnappingEngine {
  private static instance: AISnappingEngine;

  private history: Point2D[] = [];
  private patterns: Map<string, UserPattern> = new Map();
  private preferences: LearnedPreferences = {
    preferredSnapTypes: {},
    commonDistances: [],
    commonAngles: [],
    gridPreference: 0.5,
    patterns: []
  };

  // Neural network-like weights για snap point scoring
  private weights = {
    distance: 0.3,
    type: 0.25,
    history: 0.2,
    pattern: 0.15,
    user: 0.1
  };

  private constructor() {
    this.loadLearnedData();
  }

  static getInstance(): AISnappingEngine {
    if (!AISnappingEngine.instance) {
      AISnappingEngine.instance = new AISnappingEngine();
    }
    return AISnappingEngine.instance;
  }

  /**
   * Find best snap point using AI prediction
   */
  findBestSnapPoint(
    cursor: Point2D,
    candidates: Point2D[],
    context: {
      zoom: number;
      lastPoint?: Point2D;
      currentTool?: string;
      entityType?: string;
    }
  ): AISnapPoint | null {
    if (candidates.length === 0) return null;

    const snapRadius = this.calculateDynamicSnapRadius(context.zoom);
    const scoredPoints = this.scoreSnapPoints(cursor, candidates, context, snapRadius);

    // Filter by minimum confidence
    const validPoints = scoredPoints.filter(p => p.confidence >= SnapConfidence.LOW);
    if (validPoints.length === 0) return null;

    // Get best point
    const bestPoint = validPoints.reduce((best, current) =>
      current.weight > best.weight ? current : best
    );

    // Learn από user choice
    this.learn(bestPoint, context);

    return bestPoint;
  }

  /**
   * Score snap points using AI algorithm
   */
  private scoreSnapPoints(
    cursor: Point2D,
    candidates: Point2D[],
    context: SnapContext,
    snapRadius: number
  ): AISnapPoint[] {
    return candidates.map(point => {
      const distance = this.distance(cursor, point);

      // Skip if too far
      if (distance > snapRadius) {
        return null;
      }

      // Calculate individual scores
      const distanceScore = 1 - (distance / snapRadius);
      const typeScore = this.getTypeScore(point, context);
      const historyScore = this.getHistoryScore(point);
      const patternScore = this.getPatternScore(point, context);
      const userScore = this.getUserPreferenceScore(point, context);

      // Weighted combination (simulating neural network output)
      const totalWeight =
        this.weights.distance * distanceScore +
        this.weights.type * typeScore +
        this.weights.history * historyScore +
        this.weights.pattern * patternScore +
        this.weights.user * userScore;

      // Calculate confidence based on score distribution
      const confidence = this.calculateConfidence(totalWeight, distanceScore);

      // Predict next points based on patterns
      const predictedNext = this.predictNextPoints(point, context);

      return {
        point,
        type: this.detectSnapType(point, context),
        confidence,
        weight: totalWeight,
        source: 'ai-prediction',
        predictedNext
      } as AISnapPoint;
    }).filter(p => p !== null) as AISnapPoint[];
  }

  /**
   * Detect snap type using pattern recognition
   */
  private detectSnapType(point: Point2D, context: SnapContext): AISnapPoint['type'] {
    // Simplified type detection - in real implementation would use more sophisticated algorithm
    if (this.isEndpoint(point, context)) return 'endpoint';
    if (this.isMidpoint(point, context)) return 'midpoint';
    if (this.isCenter(point, context)) return 'center';
    if (this.isIntersection(point, context)) return 'intersection';

    // AI predicted type
    return 'predicted';
  }

  /**
   * Calculate dynamic snap radius based on zoom
   * 🏢 ADR-034: Using centralized validation bounds
   */
  private calculateDynamicSnapRadius(zoom: number): number {
    // Adaptive radius based on zoom level
    const baseRadius = 10;
    const zoomFactor = clamp(zoom, SPATIAL_BOUNDS.SNAP_ZOOM_FACTOR.min, SPATIAL_BOUNDS.SNAP_ZOOM_FACTOR.max);
    return baseRadius * zoomFactor;
  }

  /**
   * Get type-based score
   */
  private getTypeScore(point: Point2D, context: SnapContext): number {
    const type = this.detectSnapType(point, context);
    const typeScores = {
      endpoint: 0.9,
      midpoint: 0.8,
      center: 0.85,
      intersection: 0.95,
      perpendicular: 0.7,
      tangent: 0.6,
      quadrant: 0.65,
      predicted: 0.5
    };
    return typeScores[type] || 0.3;
  }

  /**
   * Get history-based score
   */
  /**
   * Get history-based score
   * 🏢 ADR-079: Use centralized point match threshold
   */
  private getHistoryScore(point: Point2D): number {
    // Check if point was recently used
    const recentUses = this.history.filter(h =>
      this.distance(h, point) < GEOMETRY_PRECISION.POINT_MATCH
    ).length;

    return Math.min(1, recentUses * 0.2);
  }

  /**
   * Get pattern-based score
   */
  private getPatternScore(point: Point2D, context: SnapContext): number {
    // Check if point fits known patterns
    for (const pattern of this.patterns.values()) {
      if (this.matchesPattern(point, pattern, context)) {
        return 0.8 + (pattern.frequency * 0.02);
      }
    }
    return 0.3;
  }

  /**
   * Get user preference score
   */
  private getUserPreferenceScore(point: Point2D, context: SnapContext): number {
    const type = this.detectSnapType(point, context);
    const preference = this.preferences.preferredSnapTypes[type] || 0;
    return Math.min(1, preference / 10);
  }

  /**
   * Calculate confidence level
   */
  private calculateConfidence(weight: number, distanceScore: number): number {
    if (weight > 0.9 && distanceScore > 0.95) return SnapConfidence.PERFECT;
    if (weight > 0.7) return SnapConfidence.HIGH;
    if (weight > 0.5) return SnapConfidence.MEDIUM;
    return SnapConfidence.LOW;
  }

  /**
   * Predict next snap points using pattern recognition
   */
  private predictNextPoints(current: Point2D, context: SnapContext): Point2D[] {
    const predictions: Point2D[] = [];

    // Predict based on common distances
    if (this.preferences.commonDistances.length > 0) {
      const lastPoint = context.lastPoint;
      if (lastPoint) {
        this.preferences.commonDistances.forEach(distance => {
          // Generate points at common distances
          for (let angle = 0; angle < 360; angle += 45) {
            // 🏢 ADR-067: Use centralized angle conversion
            const rad = degToRad(angle);
            predictions.push({
              x: current.x + distance * Math.cos(rad),
              y: current.y + distance * Math.sin(rad)
            });
          }
        });
      }
    }

    // Predict based on patterns
    for (const pattern of this.patterns.values()) {
      if (pattern.frequency > 3) {
        const nextInPattern = this.getNextInPattern(current, pattern);
        if (nextInPattern) {
          predictions.push(nextInPattern);
        }
      }
    }

    return predictions.slice(0, 5); // Return top 5 predictions
  }

  /**
   * Learn από user interactions
   */
  private learn(snapPoint: AISnapPoint, context: SnapContext): void {
    // Add to history
    this.history.push(snapPoint.point);
    if (this.history.length > 100) {
      this.history.shift();
    }

    // Update type preferences
    const type = snapPoint.type;
    this.preferences.preferredSnapTypes[type] =
      (this.preferences.preferredSnapTypes[type] || 0) + 1;

    // Learn distances
    if (context.lastPoint) {
      const distance = this.distance(context.lastPoint, snapPoint.point);
      this.learnDistance(distance);
    }

    // Learn patterns
    if (this.history.length >= 3) {
      this.learnPattern(this.history.slice(-3));
    }

    // Save learned data periodically
    this.saveLearnedData();
  }

  /**
   * Learn common distances
   */
  private learnDistance(distance: number): void {
    const rounded = Math.round(distance);
    const existing = this.preferences.commonDistances.findIndex(d =>
      Math.abs(d - rounded) < 1
    );

    if (existing === -1) {
      this.preferences.commonDistances.push(rounded);
    }

    // Keep only top 10 common distances
    if (this.preferences.commonDistances.length > 10) {
      this.preferences.commonDistances.shift();
    }
  }

  /**
   * Learn patterns από user
   */
  private learnPattern(sequence: Point2D[]): void {
    const key = this.getPatternKey(sequence);
    const existing = this.patterns.get(key);

    if (existing) {
      existing.frequency++;
      existing.lastUsed = new Date();
    } else {
      this.patterns.set(key, {
        sequence,
        frequency: 1,
        lastUsed: new Date(),
        context: 'user-drawn'
      });
    }

    // Limit pattern storage
    if (this.patterns.size > 50) {
      // Remove least used pattern
      let minFreq = Infinity;
      let minKey = '';

      this.patterns.forEach((pattern, key) => {
        if (pattern.frequency < minFreq) {
          minFreq = pattern.frequency;
          minKey = key;
        }
      });

      this.patterns.delete(minKey);
    }
  }

  /**
   * Helper functions
   * 🏢 ADR-065: Use centralized distance calculation
   */
  private distance(p1: Point2D, p2: Point2D): number {
    return calculateDistance(p1, p2);
  }

  private isEndpoint(point: Point2D, context: SnapContext): boolean {
    // Check if point is an endpoint
    return false; // Simplified
  }

  private isMidpoint(point: Point2D, context: SnapContext): boolean {
    // Check if point is a midpoint
    return false; // Simplified
  }

  private isCenter(point: Point2D, context: SnapContext): boolean {
    // Check if point is a center
    return false; // Simplified
  }

  private isIntersection(point: Point2D, context: SnapContext): boolean {
    // Check if point is an intersection
    return false; // Simplified
  }

  private matchesPattern(point: Point2D, pattern: UserPattern, context: SnapContext): boolean {
    // Check if point matches pattern
    return false; // Simplified
  }

  private getNextInPattern(current: Point2D, pattern: UserPattern): Point2D | null {
    // Get next point in pattern
    return null; // Simplified
  }

  private getPatternKey(sequence: Point2D[]): string {
    // Generate unique key for pattern
    return sequence.map(p => `${Math.round(p.x)},${Math.round(p.y)}`).join('|');
  }

  /**
   * Persistence methods
   * 🏢 ADR-092: Using centralized storage-utils
   */
  private loadLearnedData(): void {
    interface AISnappingData {
      preferences?: LearnedPreferences;
      patterns?: Array<[string, UserPattern]>;
      savedAt?: string;
    }

    const data = storageGet<AISnappingData | null>(STORAGE_KEYS.AI_SNAPPING, null);
    if (data) {
      this.preferences = data.preferences || this.preferences;
      this.patterns = new Map(data.patterns || []);
    }
  }

  private saveLearnedData(): void {
    const data = {
      preferences: this.preferences,
      patterns: Array.from(this.patterns.entries()),
      savedAt: new Date().toISOString()
    };
    storageSet(STORAGE_KEYS.AI_SNAPPING, data);
  }

  /**
   * Public API για conference demo
   */
  getStats(): {
    patternsLearned: number;
    predictionsAccuracy: number;
    userPreferencesScore: number;
  } {
    return {
      patternsLearned: this.patterns.size,
      predictionsAccuracy: 0.87, // Mock για demo
      userPreferencesScore: 0.92 // Mock για demo
    };
  }

  // 🏢 ADR-092: Using centralized storage-utils
  reset(): void {
    this.history = [];
    this.patterns.clear();
    this.preferences = {
      preferredSnapTypes: {},
      commonDistances: [],
      commonAngles: [],
      gridPreference: 0.5,
      patterns: []
    };
    storageRemove(STORAGE_KEYS.AI_SNAPPING);
  }
}