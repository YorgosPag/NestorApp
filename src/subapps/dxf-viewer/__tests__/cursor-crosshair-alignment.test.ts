/**
 * 🏢 ENTERPRISE JEST TESTS για cursor↔crosshair alignment
 * Automated testing suite για CI/CD pipeline με comprehensive coverage
 * Βασισμένο στις προτάσεις ChatGPT5 για παγκόσμιας κλάσης testing
 */

import { CoordinateTransforms } from '../rendering/core/CoordinateTransforms';
import type { Point2D, ViewTransform, Viewport } from '../rendering/types/Types';

// Mock canvas setup για testing environment
const createMockCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('data-canvas-type', 'dxf');

  // Mock getBoundingClientRect
  Object.defineProperty(canvas, 'getBoundingClientRect', {
    value: () => ({
      x: 0, y: 0, top: 0, left: 0,
      width: 800, height: 600,
      right: 800, bottom: 600,
      toJSON: () => ({})
    })
  });

  // Mock getContext
  Object.defineProperty(canvas, 'getContext', {
    value: () => ({
      canvas: {},
      save: jest.fn(),
      restore: jest.fn(),
      clearRect: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
      fillRect: jest.fn(),
      translate: jest.fn(),
      scale: jest.fn(),
    })
  });

  document.body.appendChild(canvas);
  return canvas;
};

type TestScenario = {
  name: string;
  description: string;
  viewport: Viewport;
  transform: ViewTransform;
  points: Point2D[];
  tolerancePx: number;
  expectedPassRate: number;
  performanceThresholdMs: number;
};

// Generate test scenarios with fixed dimensions (matches mock canvas 800x600)
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

function generateTestScenarios(): TestScenario[] {
  const center: Point2D = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
  const corners: Point2D[] = [
    { x: 0, y: 0 },
    { x: CANVAS_WIDTH, y: 0 },
    { x: 0, y: CANVAS_HEIGHT },
    { x: CANVAS_WIDTH, y: CANVAS_HEIGHT },
  ];
  const precision: Point2D[] = [
    { x: CANVAS_WIDTH * 0.25, y: CANVAS_HEIGHT * 0.75 },
    { x: CANVAS_WIDTH * 0.9, y: CANVAS_HEIGHT * 0.1 },
    { x: CANVAS_WIDTH * 0.37, y: CANVAS_HEIGHT * 0.63 },
  ];

  const allPoints = [center, ...corners, ...precision];

  return [
    {
      name: 'baseline',
      description: 'Default zoom at center + all critical points',
      viewport: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
      transform: { scale: 1, offsetX: 0, offsetY: 0 },
      points: allPoints,
      tolerancePx: 0.5,
      expectedPassRate: 0.98,
      performanceThresholdMs: 30
    },
    {
      name: 'zoom×2 + pan(50,-30)',
      description: 'Zoomed in x2 with moderate pan',
      viewport: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
      transform: { scale: 2, offsetX: 50, offsetY: -30 },
      points: allPoints,
      tolerancePx: 0.75,
      expectedPassRate: 0.95,
      performanceThresholdMs: 35
    },
    {
      name: 'zoom×0.5 + pan(-100,80)',
      description: 'Zoomed out x0.5 with significant pan',
      viewport: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
      transform: { scale: 0.5, offsetX: -100, offsetY: 80 },
      points: allPoints,
      tolerancePx: 0.75,
      expectedPassRate: 0.95,
      performanceThresholdMs: 35
    },
    {
      name: 'HiDPI scale=1.5',
      description: 'HiDPI scaling simulation',
      viewport: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
      transform: { scale: 1.5, offsetX: 0, offsetY: 0 },
      points: allPoints,
      tolerancePx: 0.75,
      expectedPassRate: 0.95,
      performanceThresholdMs: 35
    },
    {
      name: 'extreme_zoom_in_x10',
      description: 'Extreme zoom in x10 for CAD precision work',
      viewport: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
      transform: { scale: 10, offsetX: 200, offsetY: -150 },
      points: allPoints,
      tolerancePx: 1.0,
      expectedPassRate: 0.90,
      performanceThresholdMs: 40
    },
    {
      name: 'extreme_zoom_out_x0.1',
      description: 'Extreme zoom out x0.1 for overview',
      viewport: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
      transform: { scale: 0.1, offsetX: -500, offsetY: 300 },
      points: allPoints,
      tolerancePx: 1.0,
      expectedPassRate: 0.90,
      performanceThresholdMs: 40
    }
  ];
}

// Generate scenarios at module level (before Jest parses test.each)
const scenarios = generateTestScenarios();

describe('🏢 Enterprise Cursor↔Crosshair Alignment', () => {
  let canvas: HTMLCanvasElement;

  beforeAll(() => {
    canvas = createMockCanvas();
  });

  afterAll(() => {
    document.body.removeChild(canvas);
  });

  describe('Coordinate Reversibility Tests', () => {
    test.each(scenarios)('$name: reversibility accuracy', (scenario) => {
      let totalError = 0;
      let maxError = 0;
      let passed = 0;

      for (const point of scenario.points) {
        const world = CoordinateTransforms.screenToWorld(point, scenario.transform, scenario.viewport);
        const recovered = CoordinateTransforms.worldToScreen(world, scenario.transform, scenario.viewport);

        const error = Math.hypot(recovered.x - point.x, recovered.y - point.y);
        totalError += error;
        maxError = Math.max(maxError, error);

        if (error <= scenario.tolerancePx) {
          passed++;
        }
      }

      const avgError = totalError / scenario.points.length;
      const passRate = passed / scenario.points.length;

      // Enterprise-grade assertions
      expect(avgError).toBeLessThanOrEqual(scenario.tolerancePx / 2);
      expect(maxError).toBeLessThanOrEqual(scenario.tolerancePx);
      expect(passRate).toBeGreaterThanOrEqual(scenario.expectedPassRate);

      // Log results για CI reports
      console.log(JSON.stringify({
        scenario: scenario.name,
        avgError: Number(avgError.toFixed(6)),
        maxError: Number(maxError.toFixed(6)),
        passRate: Number((passRate * 100).toFixed(1)),
        description: scenario.description
      }, null, 2));
    });
  });

  describe('Edge Cases & Boundary Testing', () => {
    test('zero coordinates handling', () => {
      const viewport: Viewport = { width: 800, height: 600 };
      const transform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
      const zeroPoint: Point2D = { x: 0, y: 0 };

      const world = CoordinateTransforms.screenToWorld(zeroPoint, transform, viewport);
      const recovered = CoordinateTransforms.worldToScreen(world, transform, viewport);

      const error = Math.hypot(recovered.x - zeroPoint.x, recovered.y - zeroPoint.y);
      expect(error).toBeLessThan(0.001);
    });

    test('negative coordinates handling', () => {
      const viewport: Viewport = { width: 800, height: 600 };
      const transform: ViewTransform = { scale: 1, offsetX: -100, offsetY: -200 };
      const negativePoint: Point2D = { x: -50, y: -75 };

      const world = CoordinateTransforms.screenToWorld(negativePoint, transform, viewport);
      const recovered = CoordinateTransforms.worldToScreen(world, transform, viewport);

      const error = Math.hypot(recovered.x - negativePoint.x, recovered.y - negativePoint.y);
      expect(error).toBeLessThan(0.5);
    });

    test('very large coordinates handling', () => {
      const viewport: Viewport = { width: 800, height: 600 };
      const transform: ViewTransform = { scale: 0.001, offsetX: 0, offsetY: 0 };
      const largePoint: Point2D = { x: 100000, y: 100000 };

      const world = CoordinateTransforms.screenToWorld(largePoint, transform, viewport);
      const recovered = CoordinateTransforms.worldToScreen(world, transform, viewport);

      const error = Math.hypot(recovered.x - largePoint.x, recovered.y - largePoint.y);
      expect(error).toBeLessThan(1.0);
    });

    test('fractional coordinates precision', () => {
      const viewport: Viewport = { width: 800, height: 600 };
      const transform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
      const fractionalPoint: Point2D = { x: 123.456789, y: 987.654321 };

      const world = CoordinateTransforms.screenToWorld(fractionalPoint, transform, viewport);
      const recovered = CoordinateTransforms.worldToScreen(world, transform, viewport);

      const error = Math.hypot(recovered.x - fractionalPoint.x, recovered.y - fractionalPoint.y);
      expect(error).toBeLessThan(0.000001); // Sub-pixel precision
    });
  });

  describe('Cross-Platform Compatibility', () => {
    test('different viewport sizes', () => {
      const viewports = [
        { width: 320, height: 240 },   // Very small
        { width: 800, height: 600 },   // Standard
        { width: 1920, height: 1080 }, // HD
        { width: 3840, height: 2160 }  // 4K
      ];

      for (const viewport of viewports) {
        const transform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
        const centerPoint: Point2D = { x: viewport.width / 2, y: viewport.height / 2 };

        const world = CoordinateTransforms.screenToWorld(centerPoint, transform, viewport);
        const recovered = CoordinateTransforms.worldToScreen(world, transform, viewport);

        const error = Math.hypot(recovered.x - centerPoint.x, recovered.y - centerPoint.y);
        expect(error).toBeLessThan(0.5);
      }
    });

    test('device pixel ratio simulation', () => {
      const dprValues = [1, 1.25, 1.5, 2, 3]; // Common device pixel ratios

      for (const dpr of dprValues) {
        const viewport: Viewport = { width: 800 * dpr, height: 600 * dpr };
        const transform: ViewTransform = { scale: dpr, offsetX: 0, offsetY: 0 };
        const point: Point2D = { x: 400 * dpr, y: 300 * dpr };

        const world = CoordinateTransforms.screenToWorld(point, transform, viewport);
        const recovered = CoordinateTransforms.worldToScreen(world, transform, viewport);

        const error = Math.hypot(recovered.x - point.x, recovered.y - point.y);
        expect(error).toBeLessThan(1.0); // Slightly more tolerance για high DPR
      }
    });
  });

  describe('Stress Testing', () => {
    test('rapid successive transformations', () => {
      const viewport: Viewport = { width: 800, height: 600 };
      const baseTransform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
      const testPoint: Point2D = { x: 400, y: 300 };

      let maxError = 0;
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        // Vary transform slightly each iteration
        const transform: ViewTransform = {
          scale: baseTransform.scale + (Math.random() - 0.5) * 0.1,
          offsetX: baseTransform.offsetX + (Math.random() - 0.5) * 10,
          offsetY: baseTransform.offsetY + (Math.random() - 0.5) * 10
        };

        const world = CoordinateTransforms.screenToWorld(testPoint, transform, viewport);
        const recovered = CoordinateTransforms.worldToScreen(world, transform, viewport);

        const error = Math.hypot(recovered.x - testPoint.x, recovered.y - testPoint.y);
        maxError = Math.max(maxError, error);
      }

      expect(maxError).toBeLessThan(0.5);
    });

    test('memory consistency over time', () => {
      const viewport: Viewport = { width: 800, height: 600 };
      const transform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
      const referencePoint: Point2D = { x: 123.456, y: 789.012 };

      // Get reference world coordinate
      const referenceWorld = CoordinateTransforms.screenToWorld(referencePoint, transform, viewport);

      // Perform many operations που μπορεί να επηρεάσουν memory
      for (let i = 0; i < 10000; i++) {
        const randomPoint: Point2D = { x: Math.random() * 800, y: Math.random() * 600 };
        CoordinateTransforms.screenToWorld(randomPoint, transform, viewport);
        CoordinateTransforms.worldToScreen(randomPoint, transform, viewport);
      }

      // Check αν η reference transformation παραμένει consistent
      const verificationWorld = CoordinateTransforms.screenToWorld(referencePoint, transform, viewport);
      const worldError = Math.hypot(
        verificationWorld.x - referenceWorld.x,
        verificationWorld.y - referenceWorld.y
      );

      expect(worldError).toBeLessThan(0.000001); // Numerical precision
    });
  });
});