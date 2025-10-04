/**
 * COORDINATE SYSTEM REVERSIBILITY TEST
 * Επαληθευση οτι screenToWorld(worldToScreen(p)) == p
 */

import { CoordinateTransforms } from './rendering/core/CoordinateTransforms';
import type { Point2D, ViewTransform, Viewport } from './rendering/types/Types';

// Test data
const testPoints: Point2D[] = [
  { x: 0, y: 0 },
  { x: 100, y: 100 },
  { x: -50, y: 200 },
  { x: 1000, y: -500 },
  { x: 0.5, y: 0.1 }
];

const testTransforms: ViewTransform[] = [
  { scale: 1, offsetX: 0, offsetY: 0 },
  { scale: 2, offsetX: 100, offsetY: 50 },
  { scale: 0.5, offsetX: -20, offsetY: -30 },
  { scale: 10, offsetX: 500, offsetY: 300 }
];

const testViewports: Viewport[] = [
  { width: 800, height: 600 },
  { width: 1920, height: 1080 },
  { width: 400, height: 300 }
];

/**
 * Δοκιμη αντιστρεπτιβιλιτας: screenToWorld(worldToScreen(p)) == p
 */
function testReversibility(): boolean {
  const tolerance = 0.0001; // Numeric precision tolerance
  let allPassed = true;

  console.log('🧪 COORDINATE REVERSIBILITY TEST');
  console.log('Testing screenToWorld(worldToScreen(p)) == p');
  console.log('='.repeat(50));

  for (const transform of testTransforms) {
    for (const viewport of testViewports) {
      for (const point of testPoints) {

        // Forward: World → Screen
        const screenPoint = CoordinateTransforms.worldToScreen(point, transform, viewport);

        // Reverse: Screen → World
        const recoveredPoint = CoordinateTransforms.screenToWorld(screenPoint, transform, viewport);

        // Check if we got back the original point
        const deltaX = Math.abs(point.x - recoveredPoint.x);
        const deltaY = Math.abs(point.y - recoveredPoint.y);

        const passed = deltaX < tolerance && deltaY < tolerance;

        if (!passed) {
          allPassed = false;
          console.error(`❌ FAILED:`, {
            original: point,
            screen: screenPoint,
            recovered: recoveredPoint,
            delta: { x: deltaX, y: deltaY },
            transform,
            viewport
          });
        }
      }
    }
  }

  if (allPassed) {
    console.log('✅ ALL TESTS PASSED - Coordinate system is perfectly reversible!');
  } else {
    console.log('❌ SOME TESTS FAILED - Coordinate system has precision issues!');
  }

  return allPassed;
}

/**
 * Export για χρηση σε browser console
 */
if (typeof window !== 'undefined') {
  (window as any).testCoordinateReversibility = testReversibility;
}

export { testReversibility };