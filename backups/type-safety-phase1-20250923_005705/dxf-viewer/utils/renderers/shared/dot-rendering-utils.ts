/**
 * Dot Rendering Utilities
 * Shared utilities for rendering dots/markers on entities
 */

import type { Point2D } from '../../../systems/rulers-grid/config';
import { gripStyleStore } from '../../../stores/GripStyleStore';

/**
 * Render a single dot at given point
 * Only renders if grips are enabled in settings
 */
export function renderDotAtPoint(
  ctx: CanvasRenderingContext2D,
  worldToScreen: (point: Point2D) => Point2D,
  point: Point2D,
  radius = 4
): void {
  // 🎯 ΣΥΝΔΕΣΗ ΜΕ GRIP SETTINGS: Ελέγχουμε αν τα grips είναι ενεργοποιημένα
  const gripSettings = gripStyleStore.get();
  if (!gripSettings.enabled || !gripSettings.showGrips) {
    return; // Δεν σχεδιάζουμε dots αν τα grips είναι απενεργοποιημένα
  }

  try {
    const screenPoint = worldToScreen(point);
    ctx.beginPath();
    ctx.arc(screenPoint.x, screenPoint.y, radius, 0, Math.PI * 2);
    ctx.fill();
  } catch (error) {
    // Αθόρυβη διαχείριση σφαλμάτων
    console.warn('renderDotAtPoint failed:', error);
  }
}

/**
 * Render multiple dots at given points
 * Only renders if grips are enabled in settings
 */
export function renderDotsAtPoints(
  ctx: CanvasRenderingContext2D,
  worldToScreen: (point: Point2D) => Point2D,
  points: Point2D[],
  radius = 4
): void {
  // 🎯 ΣΥΝΔΕΣΗ ΜΕ GRIP SETTINGS: Ελέγχουμε αν τα grips είναι ενεργοποιημένα
  const gripSettings = gripStyleStore.get();
  if (!gripSettings.enabled || !gripSettings.showGrips) {
    return; // Δεν σχεδιάζουμε dots αν τα grips είναι απενεργοποιημένα
  }

  points.forEach(point => {
    renderDotAtPoint(ctx, worldToScreen, point, radius);
  });
}