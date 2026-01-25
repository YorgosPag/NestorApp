/**
 * ENTITY CREATION SYSTEM UTILITIES
 *
 * 🏢 ENTERPRISE (2026-01-25): Cleaned up dead code
 * - Removed duplicate entity types (use types/entities.ts or types/scene.ts)
 * - Removed unused functions: createEntityFromPoints, createPreviewEntity, validateEntityPoints
 * - Removed unused utilities: calculateEntityBounds, formatCoordinates, etc.
 * - Single Source of Truth: useUnifiedDrawing.tsx contains all entity creation logic
 *
 * This file now contains ONLY:
 * - generateEntityId() - Re-exported from enterprise-id.service
 */

import { generateEntityId as generateEnterpriseEntityId } from '@/services/enterprise-id.service';

/**
 * Generate unique entity ID
 * 🏢 ENTERPRISE: Using centralized ID generation (crypto-secure)
 *
 * @returns Unique entity ID string
 *
 * @example
 * const id = generateEntityId();
 * // Returns: "ent_a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 */
export function generateEntityId(): string {
  return generateEnterpriseEntityId();
}
