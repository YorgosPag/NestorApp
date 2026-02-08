/**
 * DXF GEO-TRANSFORMATION TESTS
 * Enterprise testing για Phase 2 transformation functionality
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DxfGeoTransformService } from '../services/geo-transform/DxfGeoTransform';
import { ControlPointManager } from '../services/geo-transform/ControlPointManager';
import { calculateAccuracyMetrics, generateValidationReport } from '../utils/AccuracyValidator';
import type { GeoControlPoint, DxfCoordinate, GeoCoordinate } from '../types';

describe('DxfGeoTransformService', () => {
  let transformService: DxfGeoTransformService;

  beforeEach(() => {
    transformService = new DxfGeoTransformService();
  });

  describe('Calibration', () => {
    it('should calibrate transformation with minimum 3 control points', async () => {
      const controlPoints: GeoControlPoint[] = [
        {
          id: 'CP1',
          dxfPoint: { x: 0, y: 0 },
          geoPoint: { lng: 23.0, lat: 37.0 },
          accuracy: 1.0
        },
        {
          id: 'CP2',
          dxfPoint: { x: 100, y: 0 },
          geoPoint: { lng: 23.001, lat: 37.0 },
          accuracy: 1.0
        },
        {
          id: 'CP3',
          dxfPoint: { x: 0, y: 100 },
          geoPoint: { lng: 23.0, lat: 37.001 },
          accuracy: 1.0
        }
      ];

      const georef = await transformService.calibrateTransformation(controlPoints, 'affine');

      expect(georef).toBeDefined();
      expect(georef.method).toBe('affine');
      expect(georef.accuracy).toBeGreaterThanOrEqual(0);
      expect(georef.transformMatrix).toBeDefined();
    });

    it('should reject calibration with insufficient control points', async () => {
      const controlPoints: GeoControlPoint[] = [
        {
          id: 'CP1',
          dxfPoint: { x: 0, y: 0 },
          geoPoint: { lng: 23.0, lat: 37.0 },
          accuracy: 1.0
        },
        {
          id: 'CP2',
          dxfPoint: { x: 100, y: 0 },
          geoPoint: { lng: 23.001, lat: 37.0 },
          accuracy: 1.0
        }
      ];

      await expect(
        transformService.calibrateTransformation(controlPoints, 'affine')
      ).rejects.toThrow('Χρειάζονται τουλάχιστον 3 control points');
    });
  });

  describe('Coordinate Transformation', () => {
    beforeEach(async () => {
      // Setup calibrated transformation
      const controlPoints: GeoControlPoint[] = [
        { id: 'CP1', dxfPoint: { x: 0, y: 0 }, geoPoint: { lng: 23.0, lat: 37.0 }, accuracy: 1.0 },
        { id: 'CP2', dxfPoint: { x: 1000, y: 0 }, geoPoint: { lng: 23.01, lat: 37.0 }, accuracy: 1.0 },
        { id: 'CP3', dxfPoint: { x: 0, y: 1000 }, geoPoint: { lng: 23.0, lat: 37.01 }, accuracy: 1.0 },
        { id: 'CP4', dxfPoint: { x: 1000, y: 1000 }, geoPoint: { lng: 23.01, lat: 37.01 }, accuracy: 1.0 }
      ];

      await transformService.calibrateTransformation(controlPoints, 'affine');
    });

    it('should transform DXF coordinates to geographic coordinates', () => {
      const dxfPoint: DxfCoordinate = { x: 500, y: 500 };
      const geoPoint = transformService.transformDxfToGeo(dxfPoint);

      expect(geoPoint).toBeDefined();
      expect(geoPoint.lng).toBeCloseTo(23.005, 6);
      expect(geoPoint.lat).toBeCloseTo(37.005, 6);
    });

    it('should transform geographic coordinates back to DXF', () => {
      const geoPoint: GeoCoordinate = { lng: 23.005, lat: 37.005 };
      const dxfPoint = transformService.transformGeoToDxf(geoPoint);

      expect(dxfPoint).toBeDefined();
      expect(dxfPoint.x).toBeCloseTo(500, 1);
      expect(dxfPoint.y).toBeCloseTo(500, 1);
    });

    it('should handle batch transformation', () => {
      const dxfPoints: DxfCoordinate[] = [
        { x: 0, y: 0 },
        { x: 250, y: 250 },
        { x: 500, y: 500 }
      ];

      const geoPoints = transformService.transformDxfBatch(dxfPoints);

      expect(geoPoints).toHaveLength(3);
      expect(geoPoints[0].lng).toBeCloseTo(23.0, 6);
      expect(geoPoints[1].lng).toBeCloseTo(23.0025, 6);
      expect(geoPoints[2].lng).toBeCloseTo(23.005, 6);
    });

    it('should throw error when transformation not calibrated', () => {
      const uncalibratedService = new DxfGeoTransformService();
      const dxfPoint: DxfCoordinate = { x: 100, y: 100 };

      expect(() => {
        uncalibratedService.transformDxfToGeo(dxfPoint);
      }).toThrow('Transformation not calibrated');
    });
  });

  describe('Status and Validation', () => {
    it('should report correct transformation status', () => {
      const status = transformService.getTransformationStatus();

      expect(status.isCalibrated).toBe(false);
      expect(status.controlPointCount).toBe(0);
    });

    it('should validate accuracy within threshold', async () => {
      const controlPoints: GeoControlPoint[] = [
        { id: 'CP1', dxfPoint: { x: 0, y: 0 }, geoPoint: { lng: 23.0, lat: 37.0 }, accuracy: 0.5 },
        { id: 'CP2', dxfPoint: { x: 100, y: 0 }, geoPoint: { lng: 23.001, lat: 37.0 }, accuracy: 0.5 },
        { id: 'CP3', dxfPoint: { x: 0, y: 100 }, geoPoint: { lng: 23.0, lat: 37.001 }, accuracy: 0.5 }
      ];

      await transformService.calibrateTransformation(controlPoints, 'affine');

      const isValid = transformService.validateAccuracy(2.0); // 2m threshold
      expect(isValid).toBe(true);
    });
  });
});

describe('ControlPointManager', () => {
  let manager: ControlPointManager;

  beforeEach(() => {
    manager = new ControlPointManager();
  });

  describe('Point Management', () => {
    it('should add control point successfully', () => {
      const dxfPoint: DxfCoordinate = { x: 100, y: 200 };
      const geoPoint: GeoCoordinate = { lng: 23.123, lat: 37.456 };

      const controlPoint = manager.addControlPoint(dxfPoint, geoPoint, {
        accuracy: 1.5,
        description: 'Test point'
      });

      expect(controlPoint.id).toBeDefined();
      expect(controlPoint.dxfPoint).toEqual(dxfPoint);
      expect(controlPoint.geoPoint).toEqual(geoPoint);
      expect(controlPoint.accuracy).toBe(1.5);
      expect(controlPoint.description).toBe('Test point');
    });

    it('should update control point', () => {
      const controlPoint = manager.addControlPoint(
        { x: 100, y: 200 },
        { lng: 23.123, lat: 37.456 }
      );

      const updated = manager.updateControlPoint(controlPoint.id, {
        accuracy: 2.0,
        description: 'Updated description'
      });

      expect(updated.accuracy).toBe(2.0);
      expect(updated.description).toBe('Updated description');
    });

    it('should remove control point', () => {
      const controlPoint = manager.addControlPoint(
        { x: 100, y: 200 },
        { lng: 23.123, lat: 37.456 }
      );

      const removed = manager.removeControlPoint(controlPoint.id);
      expect(removed).toBe(true);
      expect(manager.getCount()).toBe(0);
    });

    it('should clear all control points', () => {
      manager.addControlPoint({ x: 0, y: 0 }, { lng: 23.0, lat: 37.0 });
      manager.addControlPoint({ x: 100, y: 100 }, { lng: 23.1, lat: 37.1 });

      expect(manager.getCount()).toBe(2);

      manager.clearControlPoints();
      expect(manager.getCount()).toBe(0);
    });
  });

  describe('Validation', () => {
    it('should validate insufficient control points', () => {
      manager.addControlPoint({ x: 0, y: 0 }, { lng: 23.0, lat: 37.0 });
      manager.addControlPoint({ x: 100, y: 100 }, { lng: 23.1, lat: 37.1 });

      const validation = manager.validateControlPoints();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Χρειάζονται τουλάχιστον 3 control points για transformation');
    });

    it('should validate good spatial distribution', () => {
      // Add points σε corners και center
      manager.addControlPoint({ x: 0, y: 0 }, { lng: 23.0, lat: 37.0 });        // Bottom-left
      manager.addControlPoint({ x: 1000, y: 0 }, { lng: 23.1, lat: 37.0 });     // Bottom-right
      manager.addControlPoint({ x: 1000, y: 1000 }, { lng: 23.1, lat: 37.1 });  // Top-right
      manager.addControlPoint({ x: 0, y: 1000 }, { lng: 23.0, lat: 37.1 });     // Top-left
      manager.addControlPoint({ x: 500, y: 500 }, { lng: 23.05, lat: 37.05 });  // Center

      const validation = manager.validateControlPoints();

      expect(validation.isValid).toBe(true);
      expect(validation.statistics.spatialDistribution).toBe('excellent');
    });

    it('should suggest optimal points', () => {
      // Add some existing points
      manager.addControlPoint({ x: 0, y: 0 }, { lng: 23.0, lat: 37.0 });
      manager.addControlPoint({ x: 500, y: 500 }, { lng: 23.05, lat: 37.05 });

      const suggestions = manager.suggestOptimalPoints(6);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.length).toBeLessThanOrEqual(4); // 6 target - 2 existing
    });
  });

  describe('Persistence', () => {
    it('should export and import control points', () => {
      manager.addControlPoint({ x: 0, y: 0 }, { lng: 23.0, lat: 37.0 });
      manager.addControlPoint({ x: 100, y: 100 }, { lng: 23.1, lat: 37.1 });

      const exported = manager.exportControlPoints();
      expect(exported).toHaveLength(2);

      const newManager = new ControlPointManager();
      newManager.importControlPoints(exported);

      expect(newManager.getCount()).toBe(2);
      expect(newManager.getAllControlPoints()).toEqual(exported);
    });
  });
});

describe('AccuracyValidator', () => {
  describe('Accuracy Metrics', () => {
    it('should calculate basic accuracy metrics', () => {
      // Use 5 points with excellent spatial distribution (4 corners + center)
      // Required for 'excellent' grade as assessSpatialDistribution needs >= 4 points
      const controlPoints: GeoControlPoint[] = [
        { id: 'CP1', dxfPoint: { x: 0, y: 0 }, geoPoint: { lng: 23.0, lat: 37.0 }, accuracy: 1.0 },
        { id: 'CP2', dxfPoint: { x: 100, y: 0 }, geoPoint: { lng: 23.001, lat: 37.0 }, accuracy: 1.0 },
        { id: 'CP3', dxfPoint: { x: 0, y: 100 }, geoPoint: { lng: 23.0, lat: 37.001 }, accuracy: 1.0 },
        { id: 'CP4', dxfPoint: { x: 100, y: 100 }, geoPoint: { lng: 23.001, lat: 37.001 }, accuracy: 1.0 },
        { id: 'CP5', dxfPoint: { x: 50, y: 50 }, geoPoint: { lng: 23.0005, lat: 37.0005 }, accuracy: 1.0 }
      ];

      // Simulate perfect transformation (no errors)
      const transformedPoints: GeoCoordinate[] = [
        { lng: 23.0, lat: 37.0 },
        { lng: 23.001, lat: 37.0 },
        { lng: 23.0, lat: 37.001 },
        { lng: 23.001, lat: 37.001 },
        { lng: 23.0005, lat: 37.0005 }
      ];

      const metrics = calculateAccuracyMetrics(controlPoints, transformedPoints);

      expect(metrics.rmsError).toBeCloseTo(0, 2);
      expect(metrics.meanError).toBeCloseTo(0, 2);
      expect(metrics.maxError).toBeCloseTo(0, 2);
      expect(metrics.overallGrade).toBe('excellent');
    });

    it('should handle transformation with errors', () => {
      const controlPoints: GeoControlPoint[] = [
        { id: 'CP1', dxfPoint: { x: 0, y: 0 }, geoPoint: { lng: 23.0, lat: 37.0 }, accuracy: 1.0 },
        { id: 'CP2', dxfPoint: { x: 100, y: 0 }, geoPoint: { lng: 23.001, lat: 37.0 }, accuracy: 1.0 },
        { id: 'CP3', dxfPoint: { x: 0, y: 100 }, geoPoint: { lng: 23.0, lat: 37.001 }, accuracy: 1.0 }
      ];

      // Add some errors to transformed points
      const transformedPoints: GeoCoordinate[] = [
        { lng: 23.0001, lat: 37.0001 },  // ~15m error
        { lng: 23.0011, lat: 37.0001 },  // ~15m error
        { lng: 23.0001, lat: 37.0011 }   // ~15m error
      ];

      const metrics = calculateAccuracyMetrics(controlPoints, transformedPoints);

      expect(metrics.rmsError).toBeGreaterThan(10); // Should be around 15m
      expect(metrics.rmsError).toBeLessThan(20);
      expect(metrics.overallGrade).not.toBe('excellent');
    });
  });

  describe('Validation Reports', () => {
    it('should generate comprehensive validation report', () => {
      const controlPoints: GeoControlPoint[] = [
        { id: 'CP1', dxfPoint: { x: 0, y: 0 }, geoPoint: { lng: 23.0, lat: 37.0 }, accuracy: 1.0 },
        { id: 'CP2', dxfPoint: { x: 1000, y: 0 }, geoPoint: { lng: 23.01, lat: 37.0 }, accuracy: 1.0 },
        { id: 'CP3', dxfPoint: { x: 0, y: 1000 }, geoPoint: { lng: 23.0, lat: 37.01 }, accuracy: 1.0 },
        { id: 'CP4', dxfPoint: { x: 1000, y: 1000 }, geoPoint: { lng: 23.01, lat: 37.01 }, accuracy: 1.0 }
      ];

      const transformedPoints: GeoCoordinate[] = [
        { lng: 23.0, lat: 37.0 },
        { lng: 23.01, lat: 37.0 },
        { lng: 23.0, lat: 37.01 },
        { lng: 23.01, lat: 37.01 }
      ];

      const report = generateValidationReport(controlPoints, transformedPoints, 'engineering');

      expect(report.summary).toBeDefined();
      expect(report.metrics).toBeDefined();
      expect(report.issues).toBeDefined();
      expect(report.standards).toBeDefined();

      expect(['pass', 'warning', 'fail']).toContain(report.summary.overall);
      expect(['excellent', 'good', 'acceptable', 'poor']).toContain(report.summary.grade);
      expect(report.summary.recommendation).toBeDefined();
    });

    it('should identify issues in poor quality transformations', () => {
      const controlPoints: GeoControlPoint[] = [
        { id: 'CP1', dxfPoint: { x: 0, y: 0 }, geoPoint: { lng: 23.0, lat: 37.0 }, accuracy: 50.0 },
        { id: 'CP2', dxfPoint: { x: 10, y: 10 }, geoPoint: { lng: 23.0001, lat: 37.0001 }, accuracy: 50.0 } // Clustered
      ];

      const transformedPoints: GeoCoordinate[] = [
        { lng: 23.01, lat: 37.01 },   // Large error
        { lng: 23.0002, lat: 37.0002 }
      ];

      const report = generateValidationReport(controlPoints, transformedPoints, 'surveying');

      expect(report.issues.critical.length).toBeGreaterThan(0);
      expect(report.summary.overall).toBe('fail');
      expect(report.summary.grade).toBe('poor');
    });
  });
});

describe('Integration Tests', () => {
  it('should perform complete georeferencing workflow', async () => {
    const manager = new ControlPointManager();
    const transformService = new DxfGeoTransformService();

    // Step 1: Add control points
    manager.addControlPoint({ x: 0, y: 0 }, { lng: 23.0, lat: 37.0 }, { accuracy: 1.0 });
    manager.addControlPoint({ x: 1000, y: 0 }, { lng: 23.01, lat: 37.0 }, { accuracy: 1.0 });
    manager.addControlPoint({ x: 0, y: 1000 }, { lng: 23.0, lat: 37.01 }, { accuracy: 1.0 });
    manager.addControlPoint({ x: 1000, y: 1000 }, { lng: 23.01, lat: 37.01 }, { accuracy: 1.0 });

    // Step 2: Validate control points
    const validation = manager.validateControlPoints();
    expect(validation.isValid).toBe(true);

    // Step 3: Calibrate transformation
    const controlPoints = manager.getAllControlPoints();
    const georef = await transformService.calibrateTransformation(controlPoints, 'affine');
    expect(georef.accuracy).toBeLessThan(1.0); // Should be very accurate

    // Step 4: Test transformation
    const testPoint: DxfCoordinate = { x: 500, y: 500 };
    const transformed = transformService.transformDxfToGeo(testPoint);
    expect(transformed.lng).toBeCloseTo(23.005, 6);
    expect(transformed.lat).toBeCloseTo(37.005, 6);

    // Step 5: Validate accuracy
    const transformedPoints = controlPoints.map(cp => transformService.transformDxfToGeo(cp.dxfPoint));
    const report = generateValidationReport(controlPoints, transformedPoints, 'engineering');
    expect(report.summary.overall).toBe('pass');
  });
});
