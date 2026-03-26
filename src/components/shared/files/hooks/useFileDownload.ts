/**
 * =============================================================================
 * useFileDownload — Authenticated backend-proxy file download
 * =============================================================================
 *
 * Enterprise download handler using same-origin backend endpoint.
 * Pattern: Google Drive / Dropbox / OneDrive / SAP
 *
 * The backend endpoint at /api/download:
 * - Verifies Firebase ID token via Authorization header
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
import { auth } from '@/lib/firebase';
import { API_ROUTES } from '@/config/domain-constants';

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
      const user = auth.currentUser;
      if (!user) {
        logger.error('Download failed: User not authenticated');
        return;
      }

      const idToken = await user.getIdToken();

      const downloadEndpoint = `${API_ROUTES.DOWNLOAD}?url=${encodeURIComponent(file.downloadUrl)}&filename=${encodeURIComponent(file.displayName)}`;

      const response = await fetch(downloadEndpoint, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Download API returned error', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        return;
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = file.displayName;
      document.body.appendChild(link);
      link.click();

      // Cleanup
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
