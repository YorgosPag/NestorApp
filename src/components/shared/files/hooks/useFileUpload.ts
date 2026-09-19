/**
 * =============================================================================
 * useFileUpload — Canonical 3-step upload pipeline (ADR-031)
 * =============================================================================
 *
 * Enterprise upload handler implementing:
 * - Centralized auth preflight
 * - Step A: Create pending FileRecord
 * - Step B: Upload binary to Firebase Storage
 * - Step C: Finalize FileRecord with downloadUrl
 * - Persistent thumbnail generation (ADR-191 Phase 2.1)
 * - AI auto-classify fire-and-forget (ADR-191 Phase 2.2)
 * - Toast notifications for upload results
 * - Capture passthrough for Quick Capture (Procore/BIM360 pattern)
 *
 * Extracted from EntityFilesManager for Google SRP compliance.
 *
 * @module components/shared/files/hooks/useFileUpload
 */

import { useCallback, useState } from 'react';
import app from '@/lib/firebase';
import { createModuleLogger } from '@/lib/telemetry';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFilesNotifications } from '@/hooks/notifications/useFilesNotifications';
import {
  classifyFileWithPolicy,
  validateCustodyUploadAuth,
} from '@/services/filesystem/file-mutation-gateway';
import { uploadEntityFile } from '@/services/filesystem/upload-entity-file';
import type { FileCustody } from '@/lib/files/file-custody';
import type { EntityType, FileDomain, FileCategory } from '@/config/domain-constants';
import type { UploadEntryPoint, CaptureMetadata } from '@/config/upload-entry-points';
import { isAIClassifiable } from './useFileClassification';
import { resolveUploadScope, type PurposeAuthority } from '../utils/upload-scope';
import { RealtimeService } from '@/services/realtime';
import { useAuth } from '@/auth/hooks/useAuth';

const CLASSIFY_POLL_DELAYS_MS = [3000, 5000, 8000];

async function pollClassifyAndDispatch(
  fileId: string,
  entityType: string,
  entityId: string,
): Promise<void> {
  for (const delay of CLASSIFY_POLL_DELAYS_MS) {
    await new Promise<void>((resolve) => setTimeout(resolve, delay));
    try {
      const poll = await classifyFileWithPolicy(fileId);
      if (!poll.success) return;
      if (poll.status === 'already_classified') {
        // Trigger refetch in useEntityFiles via FILE_CREATED handler
        RealtimeService.dispatch('FILE_CREATED', {
          fileId,
          file: { displayName: '', category: 'documents', entityType, entityId, status: 'ready' },
          timestamp: Date.now(),
        });
        return;
      }
    } catch {
      return;
    }
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface UseFileUploadParams {
  /**
   * **Ποιος κατέχει** τα αρχεία που ανεβαίνουν (ADR-866 §5.2) — σταθερή ταυτότητα (`useStableFileCustody`).
   * `undefined` ⇒ κανένας έγκυρος κάτοχος ⇒ το ανέβασμα **αρνείται** πριν αγγίξει οτιδήποτε.
   */
  custody: FileCustody | undefined;
  projectId?: string;
  entityType: EntityType;
  entityId: string;
  domain: FileDomain;
  category: FileCategory;
  entityLabel?: string;
  purpose?: string;
  /** ADR-866 §2.10 Β1 — ποιος ορίζει τον σκοπό (`upload-scope.ts`)· παράλειψη ⇒ ο ιστορικός κανόνας. */
  purposeAuthority?: PurposeAuthority;
  /** ADR-236 Phase 3: Tag uploaded file with multi-level floor ID */
  levelFloorId?: string;
  currentUserId: string;
  selectedEntryPoint: UploadEntryPoint | null;
  customTitle: string;
  refetch: () => Promise<void> | void;
  recordFileActivity: (
    action: 'created',
    field: string,
    oldValue: string | null,
    newValue: string | null,
    label: string,
  ) => void;
  /** Callback after successful upload to reset UI state */
  onUploadComplete?: () => void;
}

interface UseFileUploadReturn {
  handleUpload: (files: File[]) => Promise<void>;
  handleCapture: (file: File, metadata: CaptureMetadata) => Promise<void>;
  uploading: boolean;
}

// ============================================================================
// MODULE LOGGER
// ============================================================================

const logger = createModuleLogger('FILE_UPLOAD');

// ============================================================================
// HOOK
// ============================================================================

export function useFileUpload({
  custody,
  projectId,
  entityType,
  entityId,
  domain,
  category,
  entityLabel,
  purpose,
  purposeAuthority,
  levelFloorId,
  currentUserId,
  selectedEntryPoint,
  customTitle,
  refetch,
  recordFileActivity,
  onUploadComplete,
}: UseFileUploadParams): UseFileUploadReturn {
  const [uploading, setUploading] = useState(false);
  const { t } = useTranslation(['files', 'files-media']);
  const fileNotifications = useFilesNotifications();
  const { user } = useAuth();
  const currentUserName = user?.displayName || user?.email || undefined;

  const handleUpload = useCallback(async (selectedFiles: File[]) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    // =========================================================================
    // AUTH GATE — Canonical upload auth per owner (ADR-292 · ADR-866 §2.6.8 Β3)
    // =========================================================================
    let authContext: Awaited<ReturnType<typeof validateCustodyUploadAuth>>;

    if (!custody) {
      logger.error('AUTH_PRECHECK_FAILED', { error: 'UPLOAD_AUTH_CUSTODY_MISSING' });
      fileNotifications.upload.authFailed();
      return;
    }

    try {
      authContext = await validateCustodyUploadAuth(custody);
      logger.info('AUTH_VERIFIED', { uid: authContext.uid, custody: authContext.custody });
    } catch (authError) {
      logger.error('AUTH_PRECHECK_FAILED', { error: String(authError) });
      const errorMessage = authError instanceof Error ? authError.message : '';
      if (errorMessage.includes('AUTH_REQUIRED')) {
        fileNotifications.upload.notAuthenticated();
      } else {
        fileNotifications.upload.authFailed();
      }
      return;
    }

    // Diagnostic logging
    logger.info('UPLOAD_DIAGNOSTIC', {
      projectId: app.options.projectId,
      storageBucket: app.options.storageBucket,
      authUid: authContext.uid,
      custody: authContext.custody,
      entityType,
      entityId,
      domain,
      category,
    });

    setUploading(true);

    try {
      // Entry point overrides for correct tree folder structure — ο ΕΝΑΣ επιλυτής (ADR-866 §2.10 Β1), τον
      // ίδιο που ρωτά η καρτέλα για το τι διαβάζει: ό,τι γράφεται εδώ είναι κατασκευαστικά ορατό εκεί.
      // Σκοπός: της καρτέλας, εκτός αν είναι μετα-σκοπός φωτογραφίας (photo, building-photo, …) ή η καρτέλα
      // δηλώνει `purposeAuthority: 'entry'` — αλλιώς το γενικό 'floorplan' θα εμφανιζόταν σε κάθε *-floorplan.
      const {
        domain: uploadDomain,
        category: uploadCategory,
        purpose: uploadPurpose,
      } = resolveUploadScope(selectedEntryPoint, { domain, category, purpose, purposeAuthority });

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];

        try {
          // ADR-054/191/292 — ο **ένας** αγωγός (βήματα Α-Γ), κοινός με το έντυπο κλειστής διάθεσης (ADR-864 §18.4 Δ1).
          const { fileId, displayName } = await uploadEntityFile(
            {
              custody,
              projectId,
              entityType,
              entityId,
              domain: uploadDomain,
              category: uploadCategory,
              entityLabel,
              purpose: uploadPurpose,
              levelFloorId,
              createdBy: currentUserId,
              uploaderName: currentUserName,
              customTitle: selectedEntryPoint?.requiresCustomTitle
                ? customTitle
                : selectedEntryPoint?.label?.el,
            },
            file,
          );

          // ADR-191 Phase 2.2: AI auto-classify — starts background job, polls until done.
          // 🔒 ADR-866 §2.6.8 Β6 — ταξινόμηση ΓΡΑΦΕΙΟΥ πάνω στη συλλογή `files`: όχι για προσωπικό κάτοχο.
          if (authContext.custody === 'company' && isAIClassifiable(file.type, file.name)) {
            classifyFileWithPolicy(fileId)
              .then(() => pollClassifyAndDispatch(fileId, entityType, entityId))
              .catch(() => { /* non-blocking */ });
          }

          successCount++;
          recordFileActivity('created', 'file_upload', null, displayName ?? file.name, t('audit.fileUpload'));

          // Delay between uploads to avoid rate limiting
          if (i < selectedFiles.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        } catch (fileError) {
          failCount++;
          logger.error(`Failed to upload file ${file.name}:`, { error: fileError });
        }
      }

      // Error notifications (success toast handled centrally by GlobalFileUploadToast)
      if (failCount > 0 && successCount > 0) {
        fileNotifications.upload.partialSuccess({ success: successCount, fail: failCount, total: selectedFiles.length });
      } else if (failCount > 0) {
        fileNotifications.upload.allFailed(failCount);
      }

      await refetch();
      onUploadComplete?.();
    } catch (error) {
      logger.error('Upload failed:', { error });
      fileNotifications.upload.generic();
    } finally {
      setUploading(false);
    }
  }, [
    custody, projectId, entityType, entityId, domain, category, entityLabel, purpose, purposeAuthority, levelFloorId,
    currentUserId, currentUserName, selectedEntryPoint, customTitle, refetch, recordFileActivity,
    onUploadComplete, fileNotifications, t,
  ]);

  const handleCapture = useCallback(async (file: File, metadata: CaptureMetadata) => {
    logger.info('CAPTURE_RECEIVED', {
      source: metadata.source,
      captureMode: metadata.captureMode,
      mimeType: metadata.mimeType,
      filename: file.name,
      size: file.size,
    });
    await handleUpload([file]);
  }, [handleUpload]);

  return { handleUpload, handleCapture, uploading };
}
