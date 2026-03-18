/**
 * =============================================================================
 * 🏢 ENTERPRISE: EntityFilesManager Component
 * =============================================================================
 *
 * Enterprise orchestrator component για file management σε entities.
 * Combines useEntityFiles hook, FilesList, και FileUploadZone.
 *
 * @module components/shared/files/EntityFilesManager
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * @example
 * ```tsx
 * <EntityFilesManager
 *   entityType="contact"
 *   entityId="contact_123"
 *   companyId="company_xyz"
 *   domain="admin"
 *   category="photos"
 *   currentUserId="user_abc"
 * />
 * ```
 */

'use client';

import React, { useCallback, useState, useMemo } from 'react';
import { normalizeForSearch } from '@/utils/greek-text';
import { FileText, RefreshCw, List, Network, Eye, Code, ArrowUp, Trash2, Grid3X3, Image as ImageIcon, X as XIcon, Maximize2, Minimize2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useFullscreen } from '@/hooks/useFullscreen';
import { FullscreenContainer } from '@/core/containers/FullscreenContainer';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { useWorkspace } from '@/contexts/WorkspaceContext'; // 🏢 ENTERPRISE: Workspace context για multi-tenancy
import type { EntityType, FileDomain, FileCategory } from '@/config/domain-constants';
import { useEntityFiles } from './hooks/useEntityFiles';
import { FilesList } from './FilesList';
import { GroupedFilesList } from './GroupedFilesList';
import { FileUploadZone } from './FileUploadZone';
import { FilePathTree } from './FilePathTree';
import { UploadEntryPointSelector } from './UploadEntryPointSelector';
import { HierarchicalEntryPointSelector } from './HierarchicalEntryPointSelector';
import { TrashView } from './TrashView'; // 🗑️ ENTERPRISE: Trash System (ADR-032)
import { SearchInput } from '@/components/ui/search'; // 🔍 ENTERPRISE: Centralized Search System
import { useNotifications } from '@/providers/NotificationProvider'; // 🏢 ENTERPRISE: Centralized Toast System
import { FileRecordService } from '@/services/file-record.service';
import type { FileRecord } from '@/types/file-record';
import type { ContactType } from '@/types/contacts';
import type { PersonaType } from '@/types/contacts/personas';
import type { UploadEntryPoint, CaptureMetadata, FloorInfo } from '@/config/upload-entry-points';
import { getAvailableGroups } from '@/config/upload-entry-points';
import { AddCaptureMenu } from './AddCaptureMenu';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '@/lib/firebase';
import app from '@/lib/firebase'; // 🏢 ENTERPRISE: For diagnostic logging
import { getFileExtension } from '@/services/upload';
import { UPLOAD_LIMITS, DEFAULT_DOCUMENT_ACCEPT } from '@/config/file-upload-config';
import { createModuleLogger } from '@/lib/telemetry';
import { generateUploadThumbnail, buildThumbnailPath } from './utils/generate-upload-thumbnail';
import { isAIClassifiable } from './hooks/useFileClassification';
import { MediaGallery } from './media'; // 🏢 ENTERPRISE: Media Gallery for photos/videos (Procore/BIM360 pattern)
import { FloorplanGallery } from './media/FloorplanGallery'; // 🏢 ENTERPRISE: Full-width floorplan viewer (Bentley/Autodesk pattern)
import { LinkToBuildingModal } from './LinkToBuildingModal'; // 🔗 ENTERPRISE: File → Building linking
import { FileThumbnail } from './FileThumbnail'; // 🏢 ENTERPRISE: Gallery card thumbnails
import { formatFileSize } from '@/utils/file-validation'; // 🏢 ENTERPRISE: File size display

// 🏢 ENTERPRISE: Split-panel preview + Batch operations (reuse central File Manager components)
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { FilePreviewPanel } from '@/components/file-manager/FilePreviewPanel';
import { BatchActionsBar } from '@/components/file-manager/BatchActionsBar';
import { useBatchFileOperations } from './hooks/useBatchFileOperations';

// ============================================================================
// MODULE LOGGER
// ============================================================================

const logger = createModuleLogger('ENTITY_FILES_MANAGER');

// ============================================================================
// TYPES
// ============================================================================

export interface EntityFilesManagerProps {
  /** Entity type (contact, building, unit, project) */
  entityType: EntityType;
  /** Entity ID */
  entityId: string;
  /** Company ID for multi-tenant isolation */
  companyId: string;
  /** Business domain (admin, construction, sales, etc.) */
  domain: FileDomain;
  /** Content category (photos, documents, contracts, etc.) */
  category: FileCategory;
  /** Current user ID (για authorization) */
  currentUserId: string;
  /** Optional: Company name για user-friendly tree display */
  companyName?: string;
  /** Optional: Entity label για display names */
  entityLabel?: string;
  /** Optional: Project ID for project-scoped files */
  projectId?: string;
  /** Optional: Purpose/descriptor για διαφορετικά entry points (e.g., "profile", "id", "signed") */
  purpose?: string;
  /** Optional: Max file size (default: 50MB) */
  maxFileSize?: number;
  /** Optional: Accepted file types */
  acceptedTypes?: string;
  /** 🏢 ENTERPRISE: Filter entry points to show only specific category (e.g., 'photos' for PhotosTab) */
  entryPointCategoryFilter?: FileCategory;
  /** 🏢 ENTERPRISE: Exclude entry points with specific categories (e.g., ['photos', 'videos'] for DocumentsTab) */
  entryPointExcludeCategories?: FileCategory[];
  /** 🏢 ENTERPRISE: Whitelist specific entry point IDs — shows ONLY these (e.g., brokerage tab) */
  allowedEntryPointIds?: string[];
  /**
   * 🏢 ENTERPRISE: Display style for files (Procore/BIM360/Autodesk pattern)
   * - 'standard': Traditional list/tree view (default)
   * - 'media-gallery': Thumbnail grid for photos/videos with lightbox preview
   * - 'floorplan-gallery': Full-width DXF/PDF viewer with navigation (Bentley/Autodesk pattern)
   */
  displayStyle?: 'standard' | 'media-gallery' | 'floorplan-gallery';
  /** 🏢 ENTERPRISE: Contact type for persona-aware entry point filtering */
  contactType?: ContactType;
  /** 🎭 ENTERPRISE: Active personas for individual contacts (ADR-121) */
  activePersonas?: PersonaType[];
  /** 🏢 ADR-191: Floor data for per-floor entry point expansion (building entity) */
  floors?: FloorInfo[];
  /** 🔗 ENTERPRISE: Enable linking files to project buildings */
  enableBuildingLink?: boolean;
  /** Navigate to the Floors tab (for "create floors first" warning link) */
  onNavigateToFloors?: () => void;
  /** Override the link text for the navigate-to-floors action (e.g. "Go to Buildings" at project level) */
  navigateToFloorsLabel?: string;
  /** 🏢 ENTERPRISE: Fetch ALL files regardless of domain/category (for Documents tab that shows all file types) */
  fetchAllDomains?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * 🏢 ENTERPRISE: Entity Files Manager
 *
 * Complete file management solution για entities:
 * - File listing (από FileRecordService)
 * - Upload με canonical pipeline (ADR-031)
 * - Delete με soft-delete
 * - Download support
 * - Real-time refetch
 */
export function EntityFilesManager({
  entityType,
  entityId,
  companyId,
  domain,
  category,
  currentUserId,
  companyName,
  entityLabel,
  projectId,
  purpose,
  maxFileSize = UPLOAD_LIMITS.MAX_FILE_SIZE, // 🏢 ENTERPRISE: Centralized config
  acceptedTypes = DEFAULT_DOCUMENT_ACCEPT, // 🏢 ENTERPRISE: Built from FILE_TYPE_CONFIG
  entryPointCategoryFilter,
  entryPointExcludeCategories,
  allowedEntryPointIds,
  displayStyle = 'standard', // 🏢 ENTERPRISE: Default to standard list/tree view
  contactType,
  activePersonas,
  floors,
  enableBuildingLink = false,
  onNavigateToFloors,
  navigateToFloorsLabel,
  fetchAllDomains,
}: EntityFilesManagerProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('files');
  const { activeWorkspace } = useWorkspace(); // 🏢 ENTERPRISE: Active workspace για multi-tenant display
  const { success, error: showError, warning } = useNotifications(); // 🏢 ENTERPRISE: Centralized Toast System

  // =========================================================================
  // STATE
  // =========================================================================

  const [uploading, setUploading] = useState(false);
  const [showUploadZone, setShowUploadZone] = useState(false);
  // 🏢 ENTERPRISE: View mode with Gallery support (Procore/BIM360/Google Drive pattern)
  // Default to 'gallery' for media files and floorplans, 'list' for documents
  const [viewMode, setViewMode] = useState<'list' | 'tree' | 'gallery'>(
    displayStyle === 'media-gallery' || displayStyle === 'floorplan-gallery' ? 'gallery' : 'list'
  );
  const [activeTab, setActiveTab] = useState<'files' | 'trash'>('files'); // 🗑️ ENTERPRISE: Procore/BIM360 pattern
  const [treeViewMode, setTreeViewMode] = useState<'business' | 'technical'>('business'); // 🏢 ENTERPRISE: Business View (default) vs Technical View
  const [selectedEntryPoint, setSelectedEntryPoint] = useState<UploadEntryPoint | null>(null);
  const [customTitle, setCustomTitle] = useState(''); // 🏢 ENTERPRISE: Custom title για "Άλλο Έγγραφο" (ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ)
  const [searchTerm, setSearchTerm] = useState(''); // 🔍 ENTERPRISE: File search (Google Drive/Dropbox pattern)
  const [linkModalFile, setLinkModalFile] = useState<FileRecord | null>(null); // 🔗 ENTERPRISE: File to link to buildings
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null); // 🏢 ENTERPRISE: Inline preview (split-panel)
  const fullscreen = useFullscreen(); // 🏢 ENTERPRISE: Centralized fullscreen (ADR-241)

  // 🏢 ENTERPRISE: Reset custom title when entry point changes
  React.useEffect(() => {
    setCustomTitle('');
  }, [selectedEntryPoint?.id]);

  // 🗑️ ENTERPRISE: Close upload zone when switching to trash tab
  React.useEffect(() => {
    if (activeTab === 'trash') {
      setShowUploadZone(false);
    }
  }, [activeTab]);

  // =========================================================================
  // DATA FETCHING (uses FileRecordService)
  // =========================================================================

  const {
    files,
    loading,
    error,
    refetch,
    deleteFile,
    renameFile,
    updateDescription,
    totalStorageBytes,
  } = useEntityFiles({
    entityType,
    entityId,
    companyId, // 🏢 ENTERPRISE: Required for Firestore Rules query authorization
    domain: fetchAllDomains ? undefined : domain,
    category: fetchAllDomains ? undefined : category,
    purpose: fetchAllDomains ? undefined : purpose, // 🏢 ENTERPRISE: Skip purpose filter when fetching all domains (Documents tab)
    autoFetch: true,
    // 🏢 ADR-240: Real-time Firestore listener for floorplan-gallery.
    // Server-side writes (processedData from /api/floorplans/process) propagate
    // automatically — no manual refetch needed.
    realtime: displayStyle === 'floorplan-gallery',
  });

  // =========================================================================
  // 🔍 FILE FILTERING (Enterprise Search - Google Drive/Dropbox pattern)
  // =========================================================================

  /**
   * Filter files based on search term
   * Searches in: displayName, originalFilename, category, domain
   */
  const filteredFiles = useMemo(() => {
    if (!searchTerm.trim()) {
      return files;
    }

    const norm = (s?: string | null) => s ? normalizeForSearch(s) : '';
    const query = norm(searchTerm.trim());

    return files.filter((file) => {
      const searchableFields = [
        file.displayName,
        file.originalFilename,
        file.category,
        file.domain,
        file.purpose,
        file.description,
      ].filter(Boolean);

      return searchableFields.some((field) => norm(field).includes(query));
    });
  }, [files, searchTerm]);

  // =========================================================================
  // 🏢 ENTERPRISE: AUTO-PROCESSING for floorplan-gallery (ADR-240)
  // Mirrors processUnprocessedFiles() from useFloorplanFiles.
  // Triggered automatically when displayStyle='floorplan-gallery' detects
  // FileRecords with status='ready' but processedData=null (e.g. Wizard uploads).
  // Uses a ref-guard to prevent re-submission on re-renders.
  // =========================================================================

  const _floorplanProcessingSubmitted = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (displayStyle !== 'floorplan-gallery') return;

    const unprocessed = filteredFiles.filter(
      f =>
        !f.processedData &&
        f.downloadUrl &&
        f.status === 'ready' &&
        !_floorplanProcessingSubmitted.current.has(f.id),
    );

    if (unprocessed.length === 0) return;

    const currentUser = auth.currentUser;
    if (!currentUser) return;

    // Mark as submitted immediately — prevents duplicate API calls on re-renders
    unprocessed.forEach(f => _floorplanProcessingSubmitted.current.add(f.id));

    let cancelled = false;

    const processFiles = async () => {
      let idToken: string;
      try {
        idToken = await currentUser.getIdToken();
      } catch {
        // Allow retry on next render
        unprocessed.forEach(f => _floorplanProcessingSubmitted.current.delete(f.id));
        return;
      }

      let anyProcessed = false;

      for (const file of unprocessed) {
        if (cancelled) return;
        try {
          const response = await fetch('/api/floorplans/process', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify({ fileId: file.id, forceReprocess: false }),
          });
          if (response.ok) {
            anyProcessed = true;
            logger.info('[EntityFilesManager] Auto-processed floorplan', { fileId: file.id });
          } else {
            // HTTP error (e.g. 504 Vercel timeout, 500 parse error) — allow retry on next mount
            _floorplanProcessingSubmitted.current.delete(file.id);
            logger.warn('[EntityFilesManager] Auto-process returned HTTP error (non-blocking)', {
              fileId: file.id,
              status: response.status,
            });
          }
        } catch (err) {
          // Network error — allow retry on next render
          _floorplanProcessingSubmitted.current.delete(file.id);
          logger.warn('[EntityFilesManager] Auto-process failed (non-blocking)', {
            fileId: file.id,
            error: String(err),
          });
        }
      }

      // After API writes processedData to Firestore, refetch to get the updated record
      if (anyProcessed && !cancelled) {
        await refetch();
      }
    };

    processFiles();

    return () => {
      cancelled = true;
    };
  }, [displayStyle, filteredFiles, refetch]);

  // =========================================================================
  // 📋 AUDIT TRAIL — Record file operations (ADR-195)
  // =========================================================================

  /** Map of entity types that support activity recording via API */
  const AUDITABLE_ENTITY_TYPES: ReadonlySet<string> = useMemo(
    () => new Set(['unit']),
    [],
  );

  /**
   * Fire-and-forget audit trail entry for file operations.
   * Only fires for entity types that have an activity API endpoint.
   */
  const recordFileActivity = useCallback(
    (action: 'updated' | 'deleted' | 'created' | 'unlinked', field: string, oldValue: string | null, newValue: string | null, label: string) => {
      if (!AUDITABLE_ENTITY_TYPES.has(entityType)) return;
      apiClient
        .post(`/api/${entityType}s/${entityId}/activity`, {
          action,
          changes: [{ field, oldValue, newValue, label }],
        })
        .catch(() => { /* fire-and-forget — audit failure must never break file ops */ });
    },
    [entityType, entityId, AUDITABLE_ENTITY_TYPES],
  );

  /** Look up a file's display name by ID from the current files array */
  const getFileName = useCallback(
    (fileId: string): string => {
      const file = files.find((f) => f.id === fileId);
      return file?.displayName ?? file?.originalFilename ?? fileId;
    },
    [files],
  );

  // =========================================================================
  // UPLOAD HANDLER (Canonical Pipeline - ADR-031)
  // =========================================================================

  /**
   * Upload files using canonical pipeline:
   * Step A: Create pending FileRecord
   * Step B: Upload binary to Storage
   * Step C: Finalize FileRecord
   */
  const handleUpload = useCallback(async (selectedFiles: File[]) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    // =========================================================================
    // 🔒 ENTERPRISE: AUTH GATE - Deterministic authentication verification
    // =========================================================================
    // Pattern: Google Cloud / AWS / Azure - Never upload without verified auth
    // Root cause prevention: storage/unauthorized errors from race conditions
    // =========================================================================

    const currentUser = auth.currentUser;
    if (!currentUser) {
      logger.error('AUTH_GATE_FAILED', { reason: 'No authenticated user' });
      showError(t('upload.errors.notAuthenticated') || 'Πρέπει να είστε συνδεδεμένος για να ανεβάσετε αρχεία');
      return;
    }

    // 🔒 ENTERPRISE: Force token refresh to ensure valid authentication
    // This ensures Storage Rules receive a valid, non-expired auth token
    try {
      const idToken = await currentUser.getIdToken(true); // force refresh
      logger.info('AUTH_VERIFIED', {
        uid: currentUser.uid,
        tokenLength: idToken.length,
        hasEmail: !!currentUser.email
      });
    } catch (authError) {
      logger.error('AUTH_TOKEN_REFRESH_FAILED', { error: String(authError) });
      showError(t('upload.errors.authFailed') || 'Σφάλμα επαλήθευσης ταυτότητας. Παρακαλώ ξανασυνδεθείτε.');
      return;
    }

    // 🏢 ENTERPRISE: Diagnostic logging - Verify correct project/bucket
    // Critical for debugging: ensures client matches Firebase project
    const diagnosticInfo = {
      projectId: app.options.projectId,
      storageBucket: app.options.storageBucket,
      authUid: currentUser.uid,
      companyId,
      entityType,
      entityId,
      domain,
      category,
    };
    logger.info('UPLOAD_DIAGNOSTIC', diagnosticInfo);
    logger.info('[EntityFilesManager] DIAGNOSTIC:', { data: JSON.stringify(diagnosticInfo, null, 2) });

    setUploading(true);

    try {
      // 🏢 ENTERPRISE: Use entry point's domain/category for correct tree folder structure
      // Entry points define where the file belongs (e.g., admin/permits for "Οικοδομική Άδεια")
      // Fallback to props domain/category when no entry point is selected
      const uploadDomain = selectedEntryPoint?.domain || domain;
      const uploadCategory = selectedEntryPoint?.category || category;
      // 🏢 ENTERPRISE: Entry point purpose takes priority over props purpose
      // Entry point purpose (e.g., "study-application") maps to study group for tree structure
      // Props purpose (e.g., "document") is only a fallback
      const uploadPurpose = selectedEntryPoint?.purpose || purpose;

      logger.info(`[EntityFilesManager] Starting upload of ${selectedFiles.length} files`);

      // Upload each file using canonical pipeline
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        logger.info(`[EntityFilesManager] Processing file ${i + 1}/${selectedFiles.length}: ${file.name}`);

        try {
          const ext = getFileExtension(file.name);

          // 🏢 STEP A: Create pending FileRecord
          logger.info(`[EntityFilesManager] STEP A: Creating pending FileRecord for ${file.name}`);
          const { fileId, storagePath, displayName, fileRecord } = await FileRecordService.createPendingFileRecord({
            companyId,
            projectId,
            entityType,
            entityId,
            domain: uploadDomain, // 🏢 ENTERPRISE: From entry point selection
            category: uploadCategory, // 🏢 ENTERPRISE: From entry point selection
            entityLabel,
            purpose: uploadPurpose, // 🏢 ENTERPRISE: Entry point context για διαφορετικά displayNames
            originalFilename: file.name,
            ext,
            contentType: file.type,
            createdBy: currentUserId,
            customTitle: selectedEntryPoint?.requiresCustomTitle
              ? customTitle
              : selectedEntryPoint?.label?.el, // 🏢 ENTERPRISE: Entry point label as display name (e.g., "Οικοδομική Άδεια")
          });
          logger.info(`[EntityFilesManager] Created FileRecord: ${fileId}`);

          // 🏢 ENTERPRISE: Wait for Firestore propagation before Storage upload
          // Storage Rules validate against Firestore - need time for document to be readable
          // Pattern: Google Cloud / AWS eventually consistent systems
          // NOTE: 300ms is baseline - may need tuning for high-latency environments
          logger.info(`[EntityFilesManager] ⏱Waiting for Firestore propagation (300ms)...`);
          await new Promise(resolve => setTimeout(resolve, 300));

          // 🏢 STEP B: Upload binary to Storage
          // 🔍 ENTERPRISE: Full diagnostic before upload for debugging storage/unauthorized
          const uploadDiagnostic = {
            storagePath,
            bucket: app.options.storageBucket,
            fileSize: file.size,
            contentType: file.type,
            authUid: auth.currentUser?.uid,
            fileRecordId: fileId,
          };
          logger.info('UPLOAD_START', uploadDiagnostic);
          logger.info(`[EntityFilesManager] STEP B: Uploading to Storage:`, { data: JSON.stringify(uploadDiagnostic, null, 2) });

          const storageRef = ref(storage, storagePath);
          await uploadBytes(storageRef, file);
          logger.info(`[EntityFilesManager] Uploaded to Storage`);

          const downloadUrl = await getDownloadURL(storageRef);
          logger.info(`[EntityFilesManager] Got download URL: ${downloadUrl.substring(0, 50)}...`);

          // 🏢 ADR-191 Phase 2.1: Generate persistent thumbnail before finalize
          let thumbnailUrl: string | undefined;
          try {
            const thumbBlob = await generateUploadThumbnail(file, file.type);
            if (thumbBlob) {
              const thumbPath = buildThumbnailPath(storagePath);
              const thumbRef = ref(storage, thumbPath);
              await uploadBytes(thumbRef, thumbBlob, { contentType: 'image/webp' });
              thumbnailUrl = await getDownloadURL(thumbRef);
              logger.info('[EntityFilesManager] Thumbnail generated and uploaded', { fileId, thumbPath });
            }
          } catch (thumbErr) {
            // Non-blocking: thumbnail failure never stops the upload
            logger.warn('[EntityFilesManager] Thumbnail generation failed (non-blocking)', { error: String(thumbErr) });
          }

          // 🏢 STEP C: Finalize FileRecord
          logger.info(`[EntityFilesManager] STEP C: Finalizing FileRecord`);
          await FileRecordService.finalizeFileRecord({
            fileId,
            sizeBytes: file.size,
            downloadUrl,
            thumbnailUrl,
          });
          logger.info(`[EntityFilesManager] Finalized FileRecord: ${fileId}`);

          // 🏢 ADR-191 Phase 2.2: Auto-classify via AI (fire-and-forget)
          if (isAIClassifiable(file.type)) {
            fetch('/api/files/classify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileId }),
            }).then((res) => {
              if (res.ok) {
                logger.info('[EntityFilesManager] AI auto-classify triggered', { fileId });
              }
            }).catch((err) => {
              logger.warn('[EntityFilesManager] AI auto-classify failed (non-blocking)', { error: String(err) });
            });
          }

          successCount++;

          // 📋 AUDIT: Record file upload in entity audit trail
          recordFileActivity('created', 'file_upload', null, displayName ?? file.name, 'Ανέβασμα αρχείου');

          // 🏢 ENTERPRISE: Add delay between uploads to avoid rate limiting
          // Storage Rules do Firestore validation (2-3 reads per upload)
          // Wait 300ms between uploads to stay under quota limits
          if (i < selectedFiles.length - 1) {
            logger.info(`[EntityFilesManager] ⏱Waiting 300ms before next upload...`);
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        } catch (fileError) {
          failCount++;
          logger.error(`[EntityFilesManager] Failed to upload file ${file.name}:`, { error: fileError });
          // Continue με το επόμενο file (don't stop entire upload)
        }
      }

      logger.info(`[EntityFilesManager] Upload complete: ${successCount} succeeded, ${failCount} failed`);

      // 🏢 ENTERPRISE: Show toast notifications for upload results
      if (failCount > 0 && successCount > 0) {
        warning(t('upload.errors.partialSuccess', { success: successCount, fail: failCount, total: selectedFiles.length })
          || `${successCount} επιτυχία, ${failCount} αποτυχία από ${selectedFiles.length} αρχεία`);
      } else if (failCount > 0) {
        showError(t('upload.errors.allFailed', { count: failCount })
          || `Αποτυχία αποστολής ${failCount} αρχείων`);
      } else if (successCount > 0) {
        success(t('upload.success', { count: successCount })
          || `${successCount} αρχεία ανέβηκαν επιτυχώς`);
      }

      // Refetch files list
      await refetch();

      // Hide upload zone and clear entry point selection
      setShowUploadZone(false);
      setSelectedEntryPoint(null); // Reset για επόμενο upload
      setCustomTitle(''); // 🏢 ENTERPRISE: Reset custom title για επόμενο upload
    } catch (error) {
      logger.error('[EntityFilesManager] Upload failed:', { error: error });
      showError(t('upload.errors.generic') || 'Σφάλμα κατά την αποστολή αρχείων');
    } finally {
      setUploading(false);
    }
  }, [
    companyId,
    projectId,
    entityType,
    entityId,
    domain,
    category,
    entityLabel,
    purpose,
    currentUserId,
    refetch,
    selectedEntryPoint, // 🏢 ENTERPRISE: Include entry point in dependencies
    customTitle, // 🏢 ENTERPRISE: Include custom title in dependencies
    success, // 🏢 ENTERPRISE: Toast notification
    showError, // 🏢 ENTERPRISE: Toast notification
    warning, // 🏢 ENTERPRISE: Toast notification
    t, // 🏢 ENTERPRISE: Translation function
    recordFileActivity, // 📋 AUDIT: File upload audit trail
  ]);

  // =========================================================================
  // DELETE HANDLER
  // =========================================================================

  const handleDelete = useCallback(async (fileId: string) => {
    const name = getFileName(fileId);
    await deleteFile(fileId, currentUserId);
    recordFileActivity('deleted', 'file_trash', name, null, 'Μετακίνηση αρχείου στον κάδο');
  }, [deleteFile, currentUserId, getFileName, recordFileActivity]);

  // =========================================================================
  // RENAME HANDLER
  // =========================================================================

  const handleRename = useCallback((fileId: string, newDisplayName: string) => {
    const oldName = getFileName(fileId);
    renameFile(fileId, newDisplayName, currentUserId);
    recordFileActivity('updated', 'file_rename', oldName, newDisplayName, 'Μετονομασία αρχείου');
  }, [renameFile, currentUserId, getFileName, recordFileActivity]);

  const handleDescriptionUpdate = useCallback((fileId: string, description: string) => {
    const name = getFileName(fileId);
    updateDescription(fileId, description);
    recordFileActivity('updated', 'file_description', name, description, 'Ενημέρωση περιγραφής αρχείου');
  }, [updateDescription, getFileName, recordFileActivity]);

  // =========================================================================
  // 🔗 LINK/UNLINK HANDLERS
  // =========================================================================

  const handleLinkClick = useCallback((file: FileRecord) => {
    setLinkModalFile(file);
  }, []);

  const handleUnlink = useCallback(async (fileId: string) => {
    const name = getFileName(fileId);
    await FileRecordService.unlinkFileFromEntity(fileId, entityType, entityId);
    recordFileActivity('unlinked', 'file_unlink', name, null, 'Αποσύνδεση αρχείου');
    await refetch();
  }, [entityType, entityId, refetch, getFileName, recordFileActivity]);

  // =========================================================================
  // 🏢 ENTERPRISE: BATCH OPERATIONS (shared hook - reuse central File Manager logic)
  // =========================================================================

  const {
    selectedIds,
    toggleSelect,
    selectAll,
    clearSelection,
    handleBatchDelete: batchDeleteRaw,
    handleBatchDownload,
    handleBatchClassify,
    handleBatchArchive: batchArchiveRaw,
    handleAIClassify,
    aiClassifying,
  } = useBatchFileOperations({
    files: filteredFiles,
    currentUserId,
    refetch,
  });

  /** Wrap batch delete to record audit for each deleted file */
  const handleBatchDelete = useCallback(async () => {
    const names = Array.from(selectedIds).map(getFileName);
    await batchDeleteRaw();
    for (const name of names) {
      recordFileActivity('deleted', 'file_trash', name, null, 'Μαζική μετακίνηση αρχείου στον κάδο');
    }
  }, [batchDeleteRaw, selectedIds, getFileName, recordFileActivity]);

  /** Wrap batch archive to record audit for each archived file */
  const handleBatchArchive = useCallback(async () => {
    const names = Array.from(selectedIds).map(getFileName);
    await batchArchiveRaw();
    for (const name of names) {
      recordFileActivity('updated', 'file_archive', name, null, 'Αρχειοθέτηση αρχείου');
    }
  }, [batchArchiveRaw, selectedIds, getFileName, recordFileActivity]);

  // =========================================================================
  // VIEW/DOWNLOAD HANDLERS
  // =========================================================================

  /** 🏢 ENTERPRISE: Single-click → inline preview panel (split-panel) */
  const handleView = useCallback((file: FileRecord) => {
    setSelectedFile(file);
  }, []);

  /** 🏢 ENTERPRISE: Double-click → open in new browser tab (legacy behavior) */
  const handleOpenInNewTab = useCallback((file: { downloadUrl?: string }) => {
    if (file.downloadUrl) {
      // 🔒 OWASP: Use noopener,noreferrer to prevent reverse tabnabbing
      const newWindow = window.open(file.downloadUrl, '_blank', 'noopener,noreferrer');
      if (newWindow) newWindow.opener = null; // Extra security for older browsers
    }
  }, []);

  /**
   * 🏢 ENTERPRISE: File Download Handler
   *
   * Pattern: Google Drive / Dropbox / OneDrive / SAP
   *
   * Solution: Same-origin backend endpoint that:
   * - Verifies Firebase ID token via Authorization header
   * - Validates Firebase Storage URL
   * - Streams file with Content-Disposition: attachment
   * - Forces browser download instead of inline viewing
   *
   * This is the industry-standard approach used by Fortune 500 applications.
   * The backend endpoint at /api/download handles the Firebase proxy properly.
   */
  const handleDownload = useCallback(async (file: { storagePath?: string; downloadUrl?: string; displayName: string }) => {
    if (!file.downloadUrl) {
      logger.warn('Download requested but no downloadUrl available', { displayName: file.displayName });
      return;
    }

    logger.info('Starting enterprise download', { displayName: file.displayName });

    try {
      // 🔐 SECURITY: Get current user's ID token for authenticated download
      const user = auth.currentUser;
      if (!user) {
        logger.error('Download failed: User not authenticated');
        return;
      }

      const idToken = await user.getIdToken();

      // 🏢 ENTERPRISE: Same-origin backend endpoint with Authorization header
      // This bypasses CORS issues and enforces server-side access control
      const downloadEndpoint = `/api/download?url=${encodeURIComponent(file.downloadUrl)}&filename=${encodeURIComponent(file.displayName)}`;

      const response = await fetch(downloadEndpoint, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Download API returned error', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        return;
      }

      // 📦 Get blob and trigger browser download
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = file.displayName;
      document.body.appendChild(link);
      link.click();

      // 🧹 Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
      }, 100);

      logger.info('Download completed successfully', { displayName: file.displayName, size: blob.size });

    } catch (error) {
      logger.error('Download failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        displayName: file.displayName
      });
    }
  }, []);

  // =========================================================================
  // CAPTURE HANDLER (Quick Capture - ADR-031 Extension)
  // =========================================================================

  /**
   * 🏢 ENTERPRISE: Handle captured media (photo/video/audio/text)
   * All captures flow through the canonical upload pipeline
   *
   * Pattern: Procore Quick Capture / BIM 360 Field
   */
  const handleCapture = useCallback(async (file: File, metadata: CaptureMetadata) => {
    logger.info('CAPTURE_RECEIVED', {
      source: metadata.source,
      captureMode: metadata.captureMode,
      mimeType: metadata.mimeType,
      filename: file.name,
      size: file.size,
    });

    // Pass captured file through canonical upload pipeline
    await handleUpload([file]);

    logger.info('CAPTURE_UPLOADED', {
      source: metadata.source,
      captureMode: metadata.captureMode,
      filename: file.name,
    });
  }, [handleUpload]);

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <FullscreenContainer
      isFullscreen={fullscreen.isFullscreen}
      onToggle={fullscreen.toggle}
      mode="overlay"
      togglePosition="none"
      fullscreenClassName="rounded-none"
      ariaLabel={t('manager.filesTitle')}
    >
    <Card className={cn('w-full', fullscreen.isFullscreen && 'h-full flex flex-col rounded-none border-0')}>
      <CardHeader>
        <nav className="flex flex-wrap items-center justify-between gap-2" role="toolbar" aria-label={t('manager.fileManagementTools')}>
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2">
              <FileText className={iconSizes.md} aria-hidden="true" />
              {t('manager.filesTitle')}
              {files.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({files.length})
                </span>
              )}
            </CardTitle>

            {/* 🏢 ENTERPRISE: Workspace info display (ADR-032) */}
            {activeWorkspace && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{t('manager.belongsTo')}:</span>
                <span className="font-medium text-foreground">{activeWorkspace.displayName}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {/* 🗑️ ENTERPRISE: Tab switcher (Procore/BIM360 pattern) */}
            <div className="flex gap-1 border rounded-md p-1" role="tablist" aria-label={t('manager.filesTitle')}>
              <Button
                variant={activeTab === 'files' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('files')}
                role="tab"
                aria-selected={activeTab === 'files'}
                aria-controls="files-panel"
                className={cn('px-2', activeTab === 'files' && 'bg-primary text-primary-foreground')}
              >
                <FileText className={`${iconSizes.sm} mr-1`} aria-hidden="true" />
                {t('manager.filesTitle')}
              </Button>
              <Button
                variant={activeTab === 'trash' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('trash')}
                role="tab"
                aria-selected={activeTab === 'trash'}
                aria-controls="trash-panel"
                className={cn('px-2', activeTab === 'trash' && 'bg-red-500 text-white hover:bg-red-600')}
              >
                <Trash2 className={`${iconSizes.sm} mr-1`} aria-hidden="true" />
                {t('trash.title')}
              </Button>
            </div>

            {/* View toggle buttons - Only show when on files tab */}
            {activeTab === 'files' && (
              <>
                <div className="flex gap-1 border rounded-md p-1" role="group" aria-label="View mode">
                  {/* 🏢 ENTERPRISE: Gallery view — available for ALL display styles (Google Drive/Procore pattern) */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={viewMode === 'gallery' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('gallery')}
                        aria-label={t('manager.viewGallery')}
                        aria-pressed={viewMode === 'gallery'}
                        className={cn('px-2', viewMode === 'gallery' && 'bg-primary text-primary-foreground')}
                      >
                        {displayStyle === 'floorplan-gallery'
                          ? <ImageIcon className={iconSizes.sm} aria-hidden="true" />
                          : <Grid3X3 className={iconSizes.sm} aria-hidden="true" />
                        }
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('manager.viewGalleryTooltip')}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={viewMode === 'list' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('list')}
                        aria-label={t('manager.viewList')}
                        aria-pressed={viewMode === 'list'}
                        className={cn('px-2', viewMode === 'list' && 'bg-primary text-primary-foreground')}
                      >
                        <List className={iconSizes.sm} aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('manager.viewList')}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={viewMode === 'tree' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('tree')}
                        aria-label={t('manager.viewTree')}
                        aria-pressed={viewMode === 'tree'}
                        className={cn('px-2', viewMode === 'tree' && 'bg-primary text-primary-foreground')}
                      >
                        <Network className={iconSizes.sm} aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('manager.viewTree')}</TooltipContent>
                  </Tooltip>
                </div>

            {/* Tree view mode toggle (Business vs Technical) - Only visible when viewMode === 'tree' */}
            {viewMode === 'tree' && (
              <div className="flex gap-1 border rounded-md p-1" role="group" aria-label="Tree view mode">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={treeViewMode === 'business' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setTreeViewMode('business')}
                      aria-label={t('manager.businessView')}
                      aria-pressed={treeViewMode === 'business'}
                      className={cn('px-2', treeViewMode === 'business' && 'bg-primary text-primary-foreground')}
                    >
                      <Eye className={iconSizes.sm} aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('manager.businessViewTooltip')}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={treeViewMode === 'technical' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setTreeViewMode('technical')}
                      aria-label={t('manager.technicalView')}
                      aria-pressed={treeViewMode === 'technical'}
                      className={cn('px-2', treeViewMode === 'technical' && 'bg-primary text-primary-foreground')}
                    >
                      <Code className={iconSizes.sm} aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('manager.technicalViewTooltip')}</TooltipContent>
                </Tooltip>
              </div>
            )}
            </>
            )}

            {/* 🏢 ENTERPRISE: Add/Capture Menu - Quick capture + file upload (Procore/BIM360 pattern) */}
            {activeTab === 'files' && (
              <>
                <AddCaptureMenu
                  category={category}
                  onUploadClick={() => setShowUploadZone(!showUploadZone)}
                  onCapture={handleCapture}
                  disabled={uploading}
                  loading={uploading}
                />

                {/* Refresh button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetch()}
                      disabled={loading || uploading}
                      aria-label={t('manager.refresh')}
                    >
                      <RefreshCw className={`${iconSizes.sm} ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('manager.refreshTooltip')}</TooltipContent>
                </Tooltip>
              </>
            )}

            {/* 🏢 ENTERPRISE: Fullscreen toggle (ADR-241 centralized) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fullscreen.toggle}
                  aria-label={fullscreen.isFullscreen ? t('manager.exitFullscreen') : t('manager.fullscreen')}
                  aria-pressed={fullscreen.isFullscreen}
                >
                  {fullscreen.isFullscreen
                    ? <Minimize2 className={iconSizes.sm} aria-hidden="true" />
                    : <Maximize2 className={iconSizes.sm} aria-hidden="true" />
                  }
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {fullscreen.isFullscreen ? t('manager.exitFullscreenTooltip') : t('manager.fullscreenTooltip')}
              </TooltipContent>
            </Tooltip>
          </div>
        </nav>
      </CardHeader>

      {/* 🏢 ENTERPRISE: Batch Actions Bar (appears when files are selected) */}
      {selectedIds.size > 0 && activeTab === 'files' && (
        <div className="px-6 pb-2">
          <BatchActionsBar
            selectedCount={selectedIds.size}
            totalCount={filteredFiles.length}
            onSelectAll={selectAll}
            onClearSelection={clearSelection}
            onBatchDelete={handleBatchDelete}
            onBatchDownload={handleBatchDownload}
            onBatchClassify={handleBatchClassify}
            onAIClassify={handleAIClassify}
            aiClassifying={aiClassifying}
            onBatchArchive={handleBatchArchive}
          />
        </div>
      )}

      <CardContent className={cn('space-y-2', fullscreen.isFullscreen && 'flex-1 min-h-0 overflow-auto')}>
        {/* Upload Pipeline (conditional) - Only show on files tab */}
        {activeTab === 'files' && showUploadZone && (
          <div className="relative space-y-2 p-2 bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/20">
            {/* Close button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowUploadZone(false); setSelectedEntryPoint(null); }}
              className="absolute top-1 right-1 h-7 w-7 p-0"
              aria-label={t('common.close')}
            >
              <XIcon className={iconSizes.sm} />
            </Button>
            {/* Step 1: Entry Point Selection — flat (contacts) vs hierarchical (projects/buildings) */}
            {getAvailableGroups(entityType).length > 0 ? (
              <HierarchicalEntryPointSelector
                entityType={entityType}
                selectedEntryPointId={selectedEntryPoint?.id}
                onSelect={setSelectedEntryPoint}
                customTitle={customTitle}
                onCustomTitleChange={setCustomTitle}
                categoryFilter={entryPointCategoryFilter}
                excludeCategories={entryPointExcludeCategories}
                allowedEntryPointIds={allowedEntryPointIds}
                floors={floors}
                onNavigateToFloors={onNavigateToFloors}
                navigateToFloorsLabel={navigateToFloorsLabel}
              />
            ) : (
              <UploadEntryPointSelector
                entityType={entityType}
                selectedEntryPointId={selectedEntryPoint?.id}
                onSelect={setSelectedEntryPoint}
                customTitle={customTitle}
                onCustomTitleChange={setCustomTitle}
                categoryFilter={entryPointCategoryFilter}
                excludeCategories={entryPointExcludeCategories}
                allowedEntryPointIds={allowedEntryPointIds}
                contactType={contactType}
                activePersonas={activePersonas}
              />
            )}

            {/* Step 2: File Upload Zone (enabled only when entry point selected AND custom title provided if required) */}
            {selectedEntryPoint && (
              <>
                {/* 🏢 ENTERPRISE: Show FileUploadZone only if custom title is provided (when required) */}
                {(!selectedEntryPoint.requiresCustomTitle || customTitle.trim() !== '') ? (
                  <FileUploadZone
                    onUpload={handleUpload}
                    accept={acceptedTypes}
                    maxSize={maxFileSize}
                    multiple
                    disabled={uploading}
                    uploading={uploading}
                  />
                ) : (
                  <div className="p-2 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <ArrowUp className={iconSizes.sm} aria-hidden="true" />
                    {t('manager.enterTitleToContinue')}
                  </div>
                )}
              </>
            )}

            {/* Hint when no entry point selected */}
            {!selectedEntryPoint && (
              <div className="p-2 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <ArrowUp className={iconSizes.sm} aria-hidden="true" />
                {t('manager.selectDocumentType')}
              </div>
            )}
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive">{t('manager.errorLoading')}: {error.message}</p>
          </div>
        )}

        {/* 🗑️ ENTERPRISE: Tab content - Files or Trash (Procore/BIM360 pattern) */}
        {activeTab === 'files' ? (
          <>
            {/* 🔍 ENTERPRISE: File Search (Google Drive/Dropbox/OneDrive pattern) */}
            {files.length > 0 && (
              <div className="flex items-center gap-4">
                <div className="flex-1 max-w-md">
                  <SearchInput
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder={t('search.placeholder')}
                    debounceMs={300}
                    showClearButton
                  />
                </div>
                {searchTerm && (
                  <span className="text-sm text-muted-foreground">
                    {t('search.results', { count: filteredFiles.length, total: files.length })}
                  </span>
                )}
              </div>
            )}

            {/* 🏢 ENTERPRISE: Split-panel layout — file list + inline preview (Google Drive/Procore pattern) */}
            <ResizablePanelGroup orientation="horizontal" className="min-h-[400px] rounded-lg">
              <ResizablePanel defaultSize={selectedFile ? 45 : 100} minSize={30}>
                {/* Files display (gallery, list, or tree) - Based on viewMode state */}
                {viewMode === 'gallery' ? (
                  displayStyle === 'floorplan-gallery' ? (
                    /* 🏢 ENTERPRISE: Floorplan Gallery View (Bentley/Autodesk pattern) */
                    <FloorplanGallery
                      files={filteredFiles}
                      onDelete={async (file) => {
                        await handleDelete(file.id);
                      }}
                      onDownload={handleDownload}
                      onRefresh={() => refetch()}
                      emptyMessage={t('floorplan.noFloorplans')}
                    />
                  ) : displayStyle === 'media-gallery' ? (
                    /* 🏢 ENTERPRISE: Media Gallery View (Procore/BIM360/Autodesk pattern) */
                    <MediaGallery
                      files={filteredFiles}
                      initialViewMode="grid"
                      showToolbar={false}
                      enableSelection
                      cardSize="md"
                      onDelete={async (filesToDelete) => {
                        for (const file of filesToDelete) {
                          await handleDelete(file.id);
                        }
                      }}
                      emptyMessage={t('media.noMedia')}
                    />
                  ) : (
                    /* 🏢 ENTERPRISE: Document Card Gallery — same pattern as central File Manager */
                    <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
                      {filteredFiles.map((file) => (
                        <article
                          key={file.id}
                          className="cursor-pointer rounded-lg border bg-card hover:bg-accent/50 transition-colors p-4 flex flex-col items-center text-center gap-3"
                          onClick={() => handleView(file)}
                        >
                          <FileThumbnail
                            ext={file.ext}
                            contentType={file.contentType}
                            thumbnailUrl={file.thumbnailUrl}
                            downloadUrl={file.downloadUrl}
                            displayName={file.displayName || ''}
                            size="md"
                          />
                          <p className="text-sm font-medium truncate w-full">
                            {file.displayName || file.originalFilename}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.sizeBytes || 0)}
                          </p>
                        </article>
                      ))}
                      {filteredFiles.length === 0 && (
                        <p className="col-span-full text-center text-muted-foreground py-8">
                          {t('manager.noFiles')}
                        </p>
                      )}
                    </section>
                  )
                ) : viewMode === 'list' ? (
                  getAvailableGroups(entityType).length > 0 ? (
                    <GroupedFilesList
                      files={filteredFiles}
                      loading={loading}
                      onDelete={handleDelete}
                      onRename={handleRename}
                      onDescriptionUpdate={handleDescriptionUpdate}
                      onView={handleView}
                      onDownload={handleDownload}
                      currentUserId={currentUserId}
                      onLink={enableBuildingLink ? handleLinkClick : undefined}
                      onUnlink={handleUnlink}
                      showLinkAction={enableBuildingLink}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelect}
                    />
                  ) : (
                    <FilesList
                      files={filteredFiles}
                      loading={loading}
                      onDelete={handleDelete}
                      onRename={handleRename}
                      onDescriptionUpdate={handleDescriptionUpdate}
                      onView={handleView}
                      onDownload={handleDownload}
                      currentUserId={currentUserId}
                      onLink={enableBuildingLink ? handleLinkClick : undefined}
                      onUnlink={handleUnlink}
                      showLinkAction={enableBuildingLink}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelect}
                    />
                  )
                ) : (
                  <FilePathTree
                    files={filteredFiles}
                    onFileSelect={handleView}
                    contextLevel="full"
                    companyName={companyName}
                    viewMode={treeViewMode}
                    groupByStudyGroup={fetchAllDomains && treeViewMode === 'business'}
                  />
                )}
              </ResizablePanel>

              {/* 🏢 ENTERPRISE: Inline Preview Panel (split-panel right side) */}
              {selectedFile && (
                <>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={55} minSize={30}>
                    <FilePreviewPanel
                      file={selectedFile}
                      onClose={() => setSelectedFile(null)}
                      currentUserId={currentUserId}
                      onRefresh={refetch}
                    />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>

            {/* Storage info */}
            {totalStorageBytes > 0 && (
              <footer className="pt-4 border-t text-xs text-muted-foreground">
                {t('manager.totalStorage')}: {(totalStorageBytes / 1024 / 1024).toFixed(2)} MB
              </footer>
            )}
          </>
        ) : (
          /* 🗑️ ENTERPRISE: Trash View (ADR-032) */
          <TrashView
            companyId={companyId}
            currentUserId={currentUserId}
            entityType={entityType}
            entityId={entityId}
            onRestore={(fileId: string) => {
              recordFileActivity('updated', 'file_restore', null, fileId, 'Επαναφορά αρχείου από κάδο');
              refetch();
            }}
          />
        )}
      </CardContent>

      {/* 🔗 ENTERPRISE: Link to Building Modal */}
      {enableBuildingLink && linkModalFile && entityId && (
        <LinkToBuildingModal
          open={!!linkModalFile}
          onOpenChange={(open) => { if (!open) setLinkModalFile(null); }}
          file={linkModalFile}
          projectId={entityId}
          onSaved={() => {
            setLinkModalFile(null);
            refetch();
          }}
        />
      )}
    </Card>
    </FullscreenContainer>
  );
}
