/**
 * ENTITY CREATION SYSTEM UTILITIES
 *
 * 🏢 ENTERPRISE (2026-01-25): Cleaned up dead code
 * - Removed duplicate entity types (use types/entities.ts or types/scene.ts)
 * - Removed unused functions: createEntityFromPoints, createPreviewEntity, validateEntityPoints
 * - Removed unused utilities: calculateEntityBounds, formatCoordinates, etc.
 * - Single Source of Truth: useUnifiedDrawing.tsx contains all entity creation logic
 *
 * ADR-314 C.5.28: trivial wrapper collapsed to pure re-export — delegates
 * directly to SSoT `@/services/enterprise-id.service` (enterprise-id-convenience rule).
 */

export { generateEntityId } from '@/services/enterprise-id.service';
