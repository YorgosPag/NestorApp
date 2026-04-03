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
import { downloadFileFromProxyWithPolicy } from '@/services/filesystem/file-mutation-gateway';

// ============================================================================
// TYPES
// ============================================================================

interface DownloadableFile {
  storagePath?: string;
  downloadUrl?: string;
  displayName: string;
}

interface UseFileDownloadReturn {
  handleDownload: (file: DownloadableFile) => Promise<void>;
}

// ============================================================================
// MODULE LOGGER
// ============================================================================

const logger = createModuleLogger('FILE_DOWNLOAD');

// ============================================================================
// HOOK
// ============================================================================

export function useFileDownload(): UseFileDownloadReturn {
  const handleDownload = useCallback(async (file: DownloadableFile) => {
    if (!file.downloadUrl) {
      logger.warn('Download requested but no downloadUrl available', { displayName: file.displayName });
      return;
    }

    logger.info('Starting enterprise download', { displayName: file.displayName });

    try {
      const blob = await downloadFileFromProxyWithPolicy(file.downloadUrl, file.displayName);
      const objectUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = file.displayName;
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
