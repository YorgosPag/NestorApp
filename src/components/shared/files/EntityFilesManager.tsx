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
import { FileText, Upload, RefreshCw, List, Network, Eye, Code, ArrowUp, Trash2, Grid3X3, Image as ImageIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/contexts/WorkspaceContext'; // 🏢 ENTERPRISE: Workspace context για multi-tenancy
import type { EntityType, FileDomain, FileCategory } from '@/config/domain-constants';
import { useEntityFiles } from './hooks/useEntityFiles';
import { FilesList } from './FilesList';
import { FileUploadZone } from './FileUploadZone';
import { FilePathTree } from './FilePathTree';
import { UploadEntryPointSelector } from './UploadEntryPointSelector';
import { TrashView } from './TrashView'; // 🗑️ ENTERPRISE: Trash System (ADR-032)
import { SearchInput } from '@/components/ui/search'; // 🔍 ENTERPRISE: Centralized Search System
import { useNotifications } from '@/providers/NotificationProvider'; // 🏢 ENTERPRISE: Centralized Toast System
import { FileRecordService } from '@/services/file-record.service';
import type { UploadEntryPoint } from '@/config/upload-entry-points';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '@/lib/firebase';
import app from '@/lib/firebase'; // 🏢 ENTERPRISE: For diagnostic logging
import { buildStoragePath, generateFileId, getFileExtension } from '@/services/upload';
import { UPLOAD_LIMITS, DEFAULT_DOCUMENT_ACCEPT } from '@/config/file-upload-config';
import { createModuleLogger } from '@/lib/telemetry';
import { MediaGallery } from './media'; // 🏢 ENTERPRISE: Media Gallery for photos/videos (Procore/BIM360 pattern)
import { FloorplanGallery } from './media/FloorplanGallery'; // 🏢 ENTERPRISE: Full-width floorplan viewer (Bentley/Autodesk pattern)

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
  /**
   * 🏢 ENTERPRISE: Display style for files (Procore/BIM360/Autodesk pattern)
   * - 'standard': Traditional list/tree view (default)
   * - 'media-gallery': Thumbnail grid for photos/videos with lightbox preview
   * - 'floorplan-gallery': Full-width DXF/PDF viewer with navigation (Bentley/Autodesk pattern)
   */
  displayStyle?: 'standard' | 'media-gallery' | 'floorplan-gallery';
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
  displayStyle = 'standard', // 🏢 ENTERPRISE: Default to standard list/tree view
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
    totalStorageBytes,
  } = useEntityFiles({
    entityType,
    entityId,
    companyId, // 🏢 ENTERPRISE: Required for Firestore Rules query authorization
    domain,
    category,
    purpose, // 🏢 ENTERPRISE: Filter by purpose for separate tabs (project-floorplan vs parking-floorplan)
    autoFetch: true,
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

    const lowerSearch = searchTerm.toLowerCase().trim();

    return files.filter((file) => {
      const searchableFields = [
        file.displayName,
        file.originalFilename,
        file.category,
        file.domain,
        file.purpose,
      ].filter(Boolean);

      return searchableFields.some((field) =>
        field?.toLowerCase().includes(lowerSearch)
      );
    });
  }, [files, searchTerm]);

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
    console.log('[EntityFilesManager] 🔍 DIAGNOSTIC:', JSON.stringify(diagnosticInfo, null, 2));

    setUploading(true);

    try {
      // 🏢 ENTERPRISE: Use entry point purpose for naming, but KEEP same domain/category
      // CRITICAL: Domain/category must match props, otherwise refetch() won't find uploaded files!
      const uploadDomain = domain; // Always use props domain (NOT entry point)
      const uploadCategory = category; // Always use props category (NOT entry point)
      const uploadPurpose = purpose || selectedEntryPoint?.purpose; // 🏢 ENTERPRISE: Tab purpose has priority over entry point (for Floorplan tab separation)

      console.log(`[EntityFilesManager] Starting upload of ${selectedFiles.length} files`);

      // Upload each file using canonical pipeline
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        console.log(`[EntityFilesManager] Processing file ${i + 1}/${selectedFiles.length}: ${file.name}`);

        try {
          const ext = getFileExtension(file.name);

          // 🏢 STEP A: Create pending FileRecord
          console.log(`[EntityFilesManager] STEP A: Creating pending FileRecord for ${file.name}`);
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
            customTitle: selectedEntryPoint?.requiresCustomTitle ? customTitle : undefined, // 🏢 ENTERPRISE: Custom title για "Άλλο Έγγραφο" (ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ)
          });
          console.log(`[EntityFilesManager] ✅ Created FileRecord: ${fileId}`);

          // 🏢 ENTERPRISE: Wait for Firestore propagation before Storage upload
          // Storage Rules validate against Firestore - need time for document to be readable
          // Pattern: Google Cloud / AWS eventually consistent systems
          // NOTE: 300ms is baseline - may need tuning for high-latency environments
          console.log(`[EntityFilesManager] ⏱️ Waiting for Firestore propagation (300ms)...`);
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
          console.log(`[EntityFilesManager] STEP B: Uploading to Storage:`, JSON.stringify(uploadDiagnostic, null, 2));

          const storageRef = ref(storage, storagePath);
          await uploadBytes(storageRef, file);
          console.log(`[EntityFilesManager] ✅ Uploaded to Storage`);

          const downloadUrl = await getDownloadURL(storageRef);
          console.log(`[EntityFilesManager] ✅ Got download URL: ${downloadUrl.substring(0, 50)}...`);

          // 🏢 STEP C: Finalize FileRecord
          console.log(`[EntityFilesManager] STEP C: Finalizing FileRecord`);
          await FileRecordService.finalizeFileRecord({
            fileId,
            sizeBytes: file.size,
            downloadUrl,
          });
          console.log(`[EntityFilesManager] ✅ Finalized FileRecord: ${fileId}`);

          successCount++;

          // 🏢 ENTERPRISE: Add delay between uploads to avoid rate limiting
          // Storage Rules do Firestore validation (2-3 reads per upload)
          // Wait 300ms between uploads to stay under quota limits
          if (i < selectedFiles.length - 1) {
            console.log(`[EntityFilesManager] ⏱️ Waiting 300ms before next upload...`);
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        } catch (fileError) {
          failCount++;
          console.error(`[EntityFilesManager] ❌ Failed to upload file ${file.name}:`, fileError);
          // Continue με το επόμενο file (don't stop entire upload)
        }
      }

      console.log(`[EntityFilesManager] Upload complete: ${successCount} succeeded, ${failCount} failed`);

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
      console.error('[EntityFilesManager] Upload failed:', error);
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
  ]);

  // =========================================================================
  // DELETE HANDLER
  // =========================================================================

  const handleDelete = useCallback(async (fileId: string) => {
    await deleteFile(fileId, currentUserId);
  }, [deleteFile, currentUserId]);

  // =========================================================================
  // VIEW/DOWNLOAD HANDLERS
  // =========================================================================

  const handleView = useCallback((file: { downloadUrl?: string }) => {
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
  // RENDER
  // =========================================================================

  return (
    <Card>
      <CardHeader>
        <nav className="flex items-center justify-between" role="toolbar" aria-label={t('manager.fileManagementTools')}>
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

          <div className="flex gap-2">
            {/* 🗑️ ENTERPRISE: Tab switcher (Procore/BIM360 pattern) */}
            <div className="flex gap-1 border rounded-md p-1" role="tablist" aria-label={t('manager.filesTitle')}>
              <Button
                variant={activeTab === 'files' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('files')}
                role="tab"
                aria-selected={activeTab === 'files'}
                aria-controls="files-panel"
                className={cn('px-3', activeTab === 'files' && 'bg-primary text-primary-foreground')}
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
                className={cn('px-3', activeTab === 'trash' && 'bg-red-500 text-white hover:bg-red-600')}
              >
                <Trash2 className={`${iconSizes.sm} mr-1`} aria-hidden="true" />
                {t('trash.title')}
              </Button>
            </div>

            {/* View toggle buttons - Only show when on files tab */}
            {activeTab === 'files' && (
              <>
                <div className="flex gap-1 border rounded-md p-1" role="group" aria-label="View mode">
                  {/* 🏢 ENTERPRISE: Gallery view for media files (Procore/BIM360 pattern) */}
                  {displayStyle === 'media-gallery' && (
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
                          <Grid3X3 className={iconSizes.sm} aria-hidden="true" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('manager.viewGalleryTooltip')}</TooltipContent>
                    </Tooltip>
                  )}
                  {/* 🏢 ENTERPRISE: Full-width floorplan viewer (Bentley/Autodesk pattern) */}
                  {displayStyle === 'floorplan-gallery' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={viewMode === 'gallery' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setViewMode('gallery')}
                          aria-label={t('manager.viewFloorplan')}
                          aria-pressed={viewMode === 'gallery'}
                          className={cn('px-2', viewMode === 'gallery' && 'bg-primary text-primary-foreground')}
                        >
                          <ImageIcon className={iconSizes.sm} aria-hidden="true" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('manager.viewFloorplanTooltip')}</TooltipContent>
                    </Tooltip>
                  )}
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

            {/* Upload button - Only show when on files tab */}
            {activeTab === 'files' && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setShowUploadZone(!showUploadZone)}
                      disabled={uploading}
                      aria-label={t('manager.addFiles')}
                    >
                      <Upload className={`${iconSizes.sm} mr-2`} aria-hidden="true" />
                      {t('manager.addFiles')}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('manager.addFilesTooltip')}</TooltipContent>
                </Tooltip>

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
          </div>
        </nav>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Upload Pipeline (conditional) - Only show on files tab */}
        {activeTab === 'files' && showUploadZone && (
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/20">
            {/* Step 1: Entry Point Selection */}
            <UploadEntryPointSelector
              entityType={entityType}
              selectedEntryPointId={selectedEntryPoint?.id}
              onSelect={setSelectedEntryPoint}
              customTitle={customTitle}
              onCustomTitleChange={setCustomTitle}
              categoryFilter={entryPointCategoryFilter}
              excludeCategories={entryPointExcludeCategories}
            />

            {/* Step 2: File Upload Zone (enabled only when entry point selected AND custom title provided if required) */}
            {selectedEntryPoint && (
              <>
                {/* 🏢 ENTERPRISE: Show FileUploadZone only if custom title is provided (when required) */}
                {(!selectedEntryPoint.requiresCustomTitle || customTitle.trim() !== '') ? (
                  <FileUploadZone
                    onUpload={handleUpload}
                    accept={acceptedTypes}
                    maxSize={maxFileSize}
                    multiple={true}
                    disabled={uploading}
                    uploading={uploading}
                  />
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <ArrowUp className={iconSizes.sm} aria-hidden="true" />
                    {t('manager.enterTitleToContinue')}
                  </div>
                )}
              </>
            )}

            {/* Hint when no entry point selected */}
            {!selectedEntryPoint && (
              <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <ArrowUp className={iconSizes.sm} aria-hidden="true" />
                {t('manager.selectDocumentType')}
              </div>
            )}
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
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
                    showClearButton={true}
                  />
                </div>
                {searchTerm && (
                  <span className="text-sm text-muted-foreground">
                    {t('search.results', { count: filteredFiles.length, total: files.length })}
                  </span>
                )}
              </div>
            )}

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
                  onRefresh={() => refetch()} // 🏢 ENTERPRISE: Refetch after DXF processing completes
                  emptyMessage={t('floorplan.noFloorplans')}
                />
              ) : (
                /* 🏢 ENTERPRISE: Media Gallery View (Procore/BIM360/Autodesk pattern) */
                <MediaGallery
                  files={filteredFiles}
                  initialViewMode="grid"
                  showToolbar={false}
                  enableSelection={true}
                  cardSize="md"
                  onDelete={async (filesToDelete) => {
                    for (const file of filesToDelete) {
                      await handleDelete(file.id);
                    }
                  }}
                  emptyMessage={t('media.noMedia')}
                />
              )
            ) : viewMode === 'list' ? (
              <FilesList
                files={filteredFiles}
                loading={loading}
                onDelete={handleDelete}
                onView={handleView}
                onDownload={handleDownload}
                currentUserId={currentUserId}
              />
            ) : (
              <FilePathTree
                files={filteredFiles}
                onFileSelect={handleView}
                contextLevel="full" // 🏢 ENTERPRISE: Full hierarchy - Show complete path with user-friendly labels
                companyName={companyName}
                viewMode={treeViewMode} // 🏢 ENTERPRISE: Business View (default) vs Technical View toggle
              />
            )}

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
            onRestore={() => {
              // Refetch files when restored
              refetch();
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
