/**
 * =============================================================================
 * 🏢 ENTERPRISE: File Manager Module Exports
 * =============================================================================
 *
 * Barrel exports για το File Manager module.
 * Χρησιμοποιήστε αυτό το αρχείο για imports από εξωτερικά modules.
 *
 * @module components/file-manager
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * @example
 * ```typescript
 * import {
 *   FileManagerPageContent,
 *   CompanyFileTree,
 *   useAllCompanyFiles,
 * } from '@/components/file-manager';
 * ```
 */

// ============================================================================
// MAIN COMPONENTS
// ============================================================================

export { FileManagerPageContent } from './FileManagerPageContent';
export { CompanyFileTree } from './CompanyFileTree';

// ============================================================================
// HOOKS
// ============================================================================

export {
  useAllCompanyFiles,
  type UseAllCompanyFilesParams,
  type UseAllCompanyFilesReturn,
  type FilesByEntity,
  type FilesByCategory,
  type FileStats,
} from './hooks/useAllCompanyFiles';

// ============================================================================
// TYPES
// ============================================================================

export type { GroupingMode, ViewMode } from './CompanyFileTree';
