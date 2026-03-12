/**
 * @file Clone Utilities - Re-export from canonical location
 * @module utils/clone-utils
 *
 * 🏢 ADR-101 → ADR-212: Hoisted to `@/lib/clone-utils` (Phase 9)
 *
 * Re-exported here for backward compatibility with dxf-viewer imports.
 *
 * @see docs/centralized-systems/reference/adr-index.md#adr-212
 */

export { deepClone } from '@/lib/clone-utils';
