/**
 * Event utilities for DynamicInput component
 */

import type { Point2D } from '../../../rendering/types/Types';

/**
 * Dispatches a dynamic input coordinate submit event
 */
export function dispatchDynamicSubmit(detail: Point2D & { source: string }): CustomEvent {
  const event = new CustomEvent('dynamic-input-coordinate-submit', { detail });
  window.dispatchEvent(event);

  return event;
}