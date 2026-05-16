/**
 * Event utilities for DynamicInput component
 */

import type { Point2D } from '../../../rendering/types/Types';

/**
 * 🏗️ ENTERPRISE: Enhanced DynamicSubmit interface
 * Supports all CAD tool operations with proper TypeScript typing
 */
export interface DynamicSubmitDetail {
  /** Legacy coordinate access */
  x?: number;
  y?: number;

  /** Source identifier for backward compatibility */
  source?: string;

  /** Active CAD tool identifier */
  tool?: string;

  /** Primary coordinates (replaces Point2D x, y for clarity) */
  coordinates?: Point2D;

  /** CAD action type */
  action?: string;

  /** Angle value for polar operations */
  angle?: number;

  /** Length/radius value for distance operations */
  length?: number;

  /** Secondary point for two-point operations */
  secondPoint?: Point2D;

  /** Input mode context */
  inputMode?: string;

  /** Last processed point for constraint operations */
  lastPoint?: Point2D;

  /**
   * ADR-358 Phase 7b2b-β Stream E — stair tool inline param overrides.
   * Carried by `action: 'commit-stair'` so `useStairTool` can call
   * `setParamOverrides({ rise, tread, width })` before `confirm()`.
   */
  rise?: number;
  tread?: number;
  width?: number;
}

/**
 * ✅ ENTERPRISE: Enhanced dynamic input coordinate submit event
 * Backward compatible with legacy Point2D & { source: string }
 */
export function dispatchDynamicSubmit(detail: DynamicSubmitDetail): CustomEvent {
  const event = new CustomEvent('dynamic-input-coordinate-submit', { detail });
  window.dispatchEvent(event);

  return event;
}
