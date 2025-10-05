/**
 * UNIFIED ENTITY SELECTION - LEGACY COMPATIBILITY
 * @deprecated This file provides backward compatibility for existing imports.
 * New code should use ../systems/selection/utils
 * This file will be removed in v2.0.0
 */

'use client';

// Re-export everything from the new selection system
export * from '../systems/selection/utils';

// Import the class for direct export compatibility
import { UnifiedEntitySelection as NewUnifiedEntitySelection } from '../systems/selection/utils';

// Export with the same name for compatibility
export const UnifiedEntitySelection = NewUnifiedEntitySelection;