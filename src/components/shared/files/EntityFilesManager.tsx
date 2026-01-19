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
import { FileText, Upload, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { EntityType, FileDomain, FileCategory } from '@/config/domain-constants';
import { useEntityFiles } from './hooks/useEntityFiles';
import { FilesList } from './FilesList';
import { FileUploadZone } from './FileUploadZone';
import { FileRecordService } from '@/services/file-record.service';
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
  /** Optional: Entity label για display names */
  entityLabel?: string;
  /** Optional: Project ID for project-scoped files */
  projectId?: string;
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
  entityLabel,
  projectId,
  maxFileSize = UPLOAD_LIMITS.MAX_FILE_SIZE, // 🏢 ENTERPRISE: Centralized config
  acceptedTypes = DEFAULT_DOCUMENT_ACCEPT, // 🏢 ENTERPRISE: Built from FILE_TYPE_CONFIG
}: EntityFilesManagerProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('files');

  // =========================================================================
  // STATE
  // =========================================================================

  const [uploading, setUploading] = useState(false);
  const [showUploadZone, setShowUploadZone] = useState(false);

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
      // Upload each file using canonical pipeline
      for (const file of selectedFiles) {
        const ext = getFileExtension(file.name);

        // 🏢 STEP A: Create pending FileRecord
        const { fileId, storagePath, displayName, fileRecord } = await FileRecordService.createPendingFileRecord({
          companyId,
          projectId,
          entityType,
          entityId,
          domain,
          category,
          entityLabel,
          originalFilename: file.name,
          ext,
          contentType: file.type,
          createdBy: currentUserId,
        });

        // 🏢 STEP B: Upload binary to Storage

        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);

        // 🏢 STEP C: Finalize FileRecord
        await FileRecordService.finalizeFileRecord({
          fileId,
          sizeBytes: file.size,
          downloadUrl,
        });
      }

      // Refetch files list
      await refetch();

      // Hide upload zone
      setShowUploadZone(false);
    } catch (error) {
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
    currentUserId,
    refetch,
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
        <nav className="flex items-center justify-between" role="toolbar" aria-label={t('fileManagementTools')}>
          <CardTitle className="flex items-center gap-2">
            <FileText className={iconSizes.md} aria-hidden="true" />
            {t('filesTitle')}
            {files.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({files.length})
              </span>
            )}
          </CardTitle>

          <div className="flex gap-2">
            {/* Upload button */}
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowUploadZone(!showUploadZone)}
              disabled={uploading}
              aria-label={t('addFiles')}
            >
              <Upload className={`${iconSizes.sm} mr-2`} aria-hidden="true" />
              {t('addFiles')}
            </Button>

            {/* Refresh button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={loading || uploading}
              aria-label={t('refresh')}
            >
              <RefreshCw className={`${iconSizes.sm} ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </Button>
          </div>
        </nav>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Upload zone (conditional) */}
        {showUploadZone && (
          <FileUploadZone
            onUpload={handleUpload}
            accept={acceptedTypes}
            maxSize={maxFileSize}
            multiple={true}
            disabled={uploading}
            uploading={uploading}
          />
        )}

        {/* Error display */}
        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive">{t('errorLoading')}: {error.message}</p>
          </div>
        )}

        {/* Files list */}
        <FilesList
          files={files}
          loading={loading}
          onDelete={handleDelete}
          onView={handleView}
          onDownload={handleDownload}
          currentUserId={currentUserId}
        />

        {/* Storage info */}
        {totalStorageBytes > 0 && (
          <footer className="pt-4 border-t text-xs text-muted-foreground">
            {t('totalStorage')}: {(totalStorageBytes / 1024 / 1024).toFixed(2)} MB
          </footer>
        )}
      </CardContent>
    </Card>
  );
}
