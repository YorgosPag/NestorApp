/**
 * Feedback message utilities
 * Consolidates duplicate feedback message patterns
 */

/**
 * Create feedback message with consistent formatting
 */
export function createFeedbackMessage(
  action: string,
  detail?: string,
  additionalInfo?: string
): string {
  let message = action;
  
  if (detail) {
    message += `: ${detail}`;
  }
  
  if (additionalInfo) {
    message += ` (${additionalInfo})`;
  }
  
  return message;
}

/**
 * Create feedback message for coordinate operations
 */
export function createCoordinateFeedback(
  operation: string,
  x: number,
  y: number,
  unit?: string
): string {
  const coords = unit ? `${x.toFixed(2)}${unit}, ${y.toFixed(2)}${unit}` : `${x.toFixed(2)}, ${y.toFixed(2)}`;
  return createFeedbackMessage(operation, coords);
}

/**
 * Create feedback message for distance operations
 */
export function createDistanceFeedback(
  operation: string,
  distance: number,
  unit?: string
): string {
  const distanceText = unit ? `${distance.toFixed(2)}${unit}` : distance.toFixed(2);
  return createFeedbackMessage(operation, distanceText);
}

/**
 * Create feedback message for entity operations
 */
export function createEntityFeedback(
  operation: string,
  entityType: string,
  entityName?: string
): string {
  const target = entityName || entityType;
  return createFeedbackMessage(operation, target);
}