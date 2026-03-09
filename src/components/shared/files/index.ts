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

export { FilePathTree } from './FilePathTree';
export type { FilePathTreeProps } from './FilePathTree';

export { AddCaptureMenu } from './AddCaptureMenu';
export type { AddCaptureMenuProps } from './AddCaptureMenu';

// Thumbnail component (ADR-191: Document Intelligence)
export { FileThumbnail } from './FileThumbnail';

// Version history (ADR-191 Phase 2.3)
export { VersionHistory } from './VersionHistory';

// Audit log (ADR-191 Phase 3.1)
export { AuditLogPanel } from './AuditLogPanel';

// Share dialog (ADR-191 Phase 4.2)
export { ShareDialog } from './ShareDialog';

// Comments panel (ADR-191 Phase 4.3)
export { CommentsPanel } from './CommentsPanel';

// Folder manager (ADR-191 Phase 4.4)
export { FolderManager } from './FolderManager';

// Approval panel (ADR-191 Phase 3.3)
export { ApprovalPanel } from './ApprovalPanel';

// Document templates (ADR-191 Phase 4.1)
export { DocumentTemplatePanel } from './DocumentTemplatePanel';

// Hooks
export { useEntityFiles } from './hooks/useEntityFiles';
export type {
  UseEntityFilesParams,
  UseEntityFilesReturn,
} from './hooks/useEntityFiles';

export { usePdfThumbnail } from './hooks/usePdfThumbnail';
export { useFileClassification, isAIClassifiable } from './hooks/useFileClassification';

// Utilities
export {
  getFileIconInfo,
  getCategoryIconInfo,
  isImageFile,
  isPdfFile,
  isVideoFile,
} from './utils/file-icons';
