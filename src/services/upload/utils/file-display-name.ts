/**
 * =============================================================================
 * 🏢 ENTERPRISE FILE DISPLAY NAME BUILDER — PUBLIC BARREL
 * =============================================================================
 *
 * Centralized naming module for generating human-readable file display names.
 * Pure function that generates display names for Firestore FileRecord.
 *
 * IMPORTANT: Storage paths use IDs only - display names belong in Firestore!
 *
 * @module upload/utils/file-display-name
 * @enterprise ADR-031 - Canonical File Storage System
 * @enterprise ADR-314 Phase C.5.7 — SRP split into 5 modules
 *
 * Usage in Step A (createPendingFileRecord):
 * ```typescript
 * const { displayName, normalizedTitle, exportFilename } = buildFileDisplayName({
 *   entityType: 'contact',
 *   entityId: 'contact_123',
 *   domain: 'admin',
 *   category: 'photos',
 *   entityLabel: 'Γιώργος Παπαδόπουλος',
 *   purpose: 'profile',
 *   occurredAt: new Date(),
 * });
 * ```
 */

export type {
  FileDisplayNameInput,
  FileDisplayNameResult,
} from './file-display-name-types';

export {
  ensureFilesNamespaceLoaded,
  getDomainLabel,
  getFileCategoryLabel,
  getEntityTypeLabel,
  getPurposeLabel,
} from './file-display-name-i18n';

export {
  formatDateForFilename,
  sanitizeForFilename,
  normalizeForSearch,
} from './file-display-name-utils';

export { buildFileDisplayName } from './file-display-name-core';

export {
  buildContactPhotoDisplayName,
  buildFloorplanDisplayName,
  buildContractDisplayName,
  buildDisplayNameFromRecord,
} from './file-display-name-builders';
