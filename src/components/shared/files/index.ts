/**
 * =============================================================================
 * 🏢 ENTERPRISE: Shared Files Components - Public API
 * =============================================================================
 *
 * Centralized exports για enterprise file management components.
 * Use EntityFilesManager as the main entry point for file management.
 *
 * @module components/shared/files
 * @enterprise ADR-031 - Canonical File Storage System
 */

// Main orchestrator component (PRIMARY EXPORT)
export { EntityFilesManager } from './EntityFilesManager';
export type { EntityFilesManagerProps } from './EntityFilesManager';

// Individual components (for advanced usage)
export { FilesList } from './FilesList';
export type { FilesListProps } from './FilesList';

export { FileUploadZone } from './FileUploadZone';
export type { FileUploadZoneProps } from './FileUploadZone';

// Hooks
export { useEntityFiles } from './hooks/useEntityFiles';
export type {
  UseEntityFilesParams,
  UseEntityFilesReturn,
} from './hooks/useEntityFiles';
