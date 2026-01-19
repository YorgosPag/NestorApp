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

import React, { useCallback, useState } from 'react';
import { FileText, Upload, RefreshCw, List, Network, Eye, Code } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { FileRecordService } from '@/services/file-record.service';
import type { UploadEntryPoint } from '@/config/upload-entry-points';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { buildStoragePath, generateFileId, getFileExtension } from '@/services/upload';
import { UPLOAD_LIMITS, DEFAULT_DOCUMENT_ACCEPT } from '@/config/file-upload-config';

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
}: EntityFilesManagerProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('files');
  const { activeWorkspace } = useWorkspace(); // 🏢 ENTERPRISE: Active workspace για multi-tenant display

  // =========================================================================
  // STATE
  // =========================================================================

  const [uploading, setUploading] = useState(false);
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');
  const [treeViewMode, setTreeViewMode] = useState<'business' | 'technical'>('business'); // 🏢 ENTERPRISE: Business View (default) vs Technical View
  const [selectedEntryPoint, setSelectedEntryPoint] = useState<UploadEntryPoint | null>(null);
  const [customTitle, setCustomTitle] = useState(''); // 🏢 ENTERPRISE: Custom title για "Άλλο Έγγραφο" (ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ)

  // 🏢 ENTERPRISE: Reset custom title when entry point changes
  React.useEffect(() => {
    setCustomTitle('');
  }, [selectedEntryPoint?.id]);

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
    autoFetch: true,
  });

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

    setUploading(true);

    try {
      // 🏢 ENTERPRISE: Use entry point purpose for naming, but KEEP same domain/category
      // CRITICAL: Domain/category must match props, otherwise refetch() won't find uploaded files!
      const uploadDomain = domain; // Always use props domain (NOT entry point)
      const uploadCategory = category; // Always use props category (NOT entry point)
      const uploadPurpose = selectedEntryPoint?.purpose || purpose; // Use entry point purpose for naming

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

          // 🏢 STEP B: Upload binary to Storage
          console.log(`[EntityFilesManager] STEP B: Uploading to Storage: ${storagePath}`);
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

      if (failCount > 0) {
        alert(`⚠️ ${failCount} από ${selectedFiles.length} αρχεία απέτυχαν. Ελέγξτε το console για λεπτομέρειες.`);
      }

      // Refetch files list
      await refetch();

      // Hide upload zone and clear entry point selection
      setShowUploadZone(false);
      setSelectedEntryPoint(null); // Reset για επόμενο upload
      setCustomTitle(''); // 🏢 ENTERPRISE: Reset custom title για επόμενο upload
    } catch (error) {
      console.error('[EntityFilesManager] Upload failed:', error);
      // TODO: Show error toast
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

  const handleDownload = useCallback((file: { downloadUrl?: string; displayName: string }) => {
    if (file.downloadUrl) {
      // Create temporary link for download με σωστό filename
      const link = document.createElement('a');
      link.href = file.downloadUrl;
      link.download = file.displayName;
      link.target = '_blank';
      link.click();
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
                <span>Ανήκει στο:</span>
                <span className="font-medium text-foreground">{activeWorkspace.displayName}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {/* View toggle buttons */}
            <div className="flex gap-1 border rounded-md p-1" role="group" aria-label="View mode">
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
            </div>

            {/* Tree view mode toggle (Business vs Technical) - Only visible when viewMode === 'tree' */}
            {viewMode === 'tree' && (
              <div className="flex gap-1 border rounded-md p-1" role="group" aria-label="Tree view mode">
                <Button
                  variant={treeViewMode === 'business' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTreeViewMode('business')}
                  aria-label="Business View"
                  aria-pressed={treeViewMode === 'business'}
                  className={cn('px-2', treeViewMode === 'business' && 'bg-primary text-primary-foreground')}
                  title="Business View - User-friendly display"
                >
                  <Eye className={iconSizes.sm} aria-hidden="true" />
                </Button>
                <Button
                  variant={treeViewMode === 'technical' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTreeViewMode('technical')}
                  aria-label="Technical View"
                  aria-pressed={treeViewMode === 'technical'}
                  className={cn('px-2', treeViewMode === 'technical' && 'bg-primary text-primary-foreground')}
                  title="Technical View - Full path with IDs"
                >
                  <Code className={iconSizes.sm} aria-hidden="true" />
                </Button>
              </div>
            )}

            {/* Upload button */}
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

            {/* Refresh button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={loading || uploading}
              aria-label={t('manager.refresh')}
            >
              <RefreshCw className={`${iconSizes.sm} ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </Button>
          </div>
        </nav>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Upload Pipeline (conditional) */}
        {showUploadZone && (
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/20">
            {/* Step 1: Entry Point Selection */}
            <UploadEntryPointSelector
              entityType={entityType}
              selectedEntryPointId={selectedEntryPoint?.id}
              onSelect={setSelectedEntryPoint}
              customTitle={customTitle}
              onCustomTitleChange={setCustomTitle}
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
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    ⬆️ Εισάγετε τίτλο για να συνεχίσετε με το upload
                  </div>
                )}
              </>
            )}

            {/* Hint when no entry point selected */}
            {!selectedEntryPoint && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                ⬆️ Επιλέξτε πρώτα τον τύπο του εγγράφου
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

        {/* Files display (list or tree) */}
        {viewMode === 'list' ? (
          <FilesList
            files={files}
            loading={loading}
            onDelete={handleDelete}
            onView={handleView}
            onDownload={handleDownload}
            currentUserId={currentUserId}
          />
        ) : (
          <FilePathTree
            files={files}
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
      </CardContent>
    </Card>
  );
}
