/**
 * Event utilities for DynamicInput component
 */

/**
 * Dispatches a dynamic input coordinate submit event
 */
export function dispatchDynamicSubmit(detail: any): CustomEvent {
  const event = new CustomEvent('dynamic-input-coordinate-submit', { detail });
  window.dispatchEvent(event);
  console.log(`🎯 EVENT DISPATCHED:`, event);
  return event;
}