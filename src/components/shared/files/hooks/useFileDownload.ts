/**
 * =============================================================================
 * useFileDownload — Authenticated backend-proxy file download
 * =============================================================================
 *
 * Enterprise download handler using same-origin backend endpoint.
 * Pattern: Google Drive / Dropbox / OneDrive / SAP
 *
 * The backend endpoint at /api/download:
 * - Uses centralized enterprise API client auth handling
 * - Validates Firebase Storage URL
 * - Streams file with Content-Disposition: attachment
 * - Forces browser download instead of inline viewing
 *
 * Extracted from EntityFilesManager for Google SRP compliance.
 *
 * @module components/shared/files/hooks/useFileDownload
 */

import { useCallback } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import {
  downloadFileByIdWithPolicy,
  downloadFileFromProxyWithPolicy,
} from '@/services/filesystem/file-mutation-gateway';

// ============================================================================
// TYPES
// ============================================================================

interface DownloadableFile {
  /**
   * 🔑 **Το id του `FileRecord`, όταν υπάρχει** — η **προτιμώμενη** διαδρομή προς
   * τα bytes (ADR-862 Φ0 Β8): ο διακομιστής βρίσκει **μόνος του** το αντικείμενο
   * και περνά από τον φρουρό ορατότητας δοχείου.
   *
   * ⚠️ **Προαιρετικό επειδή ΕΙΝΑΙ** — μετρημένο 2026-09-16: από τους επτά καλούντες
   * αυτού του hook, **δύο** δεν έχουν `FileRecord`: οι **εκδόσεις** (ζουν σε
   * υποσυλλογή, χωρίς δικό τους έγγραφο στη `files`) και οι φωτογραφίες **επαφών**.
   * Εκείνοι πέφτουν στο `downloadUrl`, που φυλάει **μισθωτή** αλλά όχι **δοχείο**.
   */
  id?: string;
  storagePath?: string;
  downloadUrl?: string;
  displayName: string;
  originalFilename?: string;
  /** File extension without dot (e.g. "pdf", "jpg") — most reliable source */
  ext?: string;
}

interface UseFileDownloadReturn {
  handleDownload: (file: DownloadableFile) => Promise<void>;
}

// ============================================================================
// MODULE LOGGER
// ============================================================================

const logger = createModuleLogger('FILE_DOWNLOAD');

// ============================================================================
// HELPERS
// ============================================================================

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
};

/**
 * Extract a real file extension from a filename.
 * Returns '' if the suffix after the last dot doesn't look like a known extension.
 * This avoids false positives like "Α.Ε." (Ανώνυμη Εταιρεία) being mistaken for an extension.
 */
function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0) return '';

  const suffix = filename.slice(lastDot).toLowerCase();
  // Real extensions: 2-5 chars after dot, alphanumeric only (e.g. .pdf, .jpg, .docx, .xlsx)
  return /^\.[a-z0-9]{2,5}$/.test(suffix) ? suffix : '';
}

function ensureFileExtension(
  displayName: string,
  ext?: string,
  originalFilename?: string,
  contentType?: string,
): string {
  if (getExtension(displayName)) return displayName;

  // Priority 1: explicit ext field (same source batch ZIP uses — most reliable)
  if (ext) return `${displayName}.${ext.replace(/^\./, '')}`;

  // Priority 2: extract from original filename
  const extFromOriginal = originalFilename ? getExtension(originalFilename) : '';
  if (extFromOriginal) return `${displayName}${extFromOriginal}`;

  // Priority 3: derive from MIME type
  const extFromMime = contentType ? MIME_TO_EXT[contentType] ?? '' : '';
  if (extFromMime) return `${displayName}${extFromMime}`;

  return displayName;
}

// ============================================================================
// HOOK
// ============================================================================

export function useFileDownload(): UseFileDownloadReturn {
  const handleDownload = useCallback(async (file: DownloadableFile) => {
    if (!file.id && !file.downloadUrl) {
      logger.warn('Download requested but neither id nor downloadUrl available', {
        displayName: file.displayName,
      });
      return;
    }

    logger.info('Starting enterprise download', { displayName: file.displayName });

    try {
      // 🔑 **Το id νικά** (ADR-862 Φ0 Β8): είναι η μόνη είσοδος που ο διακομιστής
      //    μπορεί να επαληθεύσει **πλήρως** — μισθωτή **και** ορατότητα δοχείου. Το
      //    `downloadUrl` μένει εφεδρεία για όσους δεν έχουν `FileRecord`.
      const blob = file.id
        ? await downloadFileByIdWithPolicy(file.id)
        : await downloadFileFromProxyWithPolicy(file.downloadUrl as string, file.displayName);
      const objectUrl = URL.createObjectURL(blob);

      const downloadName = ensureFileExtension(file.displayName, file.ext, file.originalFilename, blob.type);

      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();

      // Cleanup browser-only download artifacts after the click has been dispatched.
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
      }, 100);

      logger.info('Download completed successfully', { displayName: file.displayName, size: blob.size });
    } catch (error) {
      logger.error('Download failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        displayName: file.displayName,
      });
    }
  }, []);

  return { handleDownload };
}
