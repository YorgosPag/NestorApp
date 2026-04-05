/**
 * =============================================================================
 * Public Share Page — View/download shared files
 * =============================================================================
 *
 * Public page accessible without authentication.
 * Validates share token, handles password protection, and serves file.
 *
 * @module app/shared/[token]
 * @enterprise ADR-191 - Enterprise Document Management System (Phase 4.2)
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Download,
  Lock,
  Clock,
  FileText,
  AlertTriangle,
  Shield,
} from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { FileShareService, type FileShareRecord } from '@/services/file-share.service';
import { formatFileSize } from '@/utils/file-validation';
import '@/lib/design-system';

// ============================================================================
// TYPES
// ============================================================================

interface FileInfo {
  displayName: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  downloadUrl: string;
  ext: string;
}

type PageState = 'loading' | 'password' | 'ready' | 'error' | 'expired';

// ============================================================================
// COMPONENT
// ============================================================================

export default function SharedFilePage() {
  const params = useParams();
  const token = params.token as string;
  const colors = useSemanticColors();
  const { t } = useTranslation('files-media');

  const [state, setState] = useState<PageState>('loading');
  const [share, setShare] = useState<FileShareRecord | null>(null);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Validate share token
  useEffect(() => {
    async function validate() {
      try {
        const validation = await FileShareService.validateShare(token);

        if (!validation.valid || !validation.share) {
          setState(validation.reason?.includes('expired') ? 'expired' : 'error');
          setErrorMessage(validation.reason ?? 'Invalid share link');
          return;
        }

        setShare(validation.share);

        // If password required, show password form
        if (validation.share.requiresPassword) {
          setState('password');
          return;
        }

        // Load file info
        await loadFileInfo(validation.share.fileId);
      } catch (err) {
        setState('error');
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load');
      }
    }

    validate();
  }, [token]);

  // Load file metadata from Firestore
  const loadFileInfo = useCallback(async (fileId: string) => {
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('@/lib/firebase');
    const { COLLECTIONS } = await import('@/config/firestore-collections');

    const fileDoc = await getDoc(doc(db, COLLECTIONS.FILES, fileId));
    if (!fileDoc.exists()) {
      setState('error');
      setErrorMessage('File not found');
      return;
    }

    const data = fileDoc.data();
    setFileInfo({
      displayName: data.displayName ?? data.originalFilename ?? 'File',
      originalFilename: data.originalFilename ?? 'file',
      contentType: data.contentType ?? '',
      sizeBytes: data.sizeBytes ?? 0,
      downloadUrl: data.downloadUrl ?? '',
      ext: data.ext ?? '',
    });
    setState('ready');
  }, []);

  // Handle password submit
  const handlePasswordSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!share) return;

    const valid = await FileShareService.verifyPassword(share, password);
    if (!valid) {
      setPasswordError(true);
      return;
    }

    setPasswordError(false);
    await loadFileInfo(share.fileId);
  }, [share, password, loadFileInfo]);

  // Handle download
  const handleDownload = useCallback(async () => {
    if (!fileInfo?.downloadUrl || !share) return;

    setDownloading(true);
    try {
      // Increment download count
      await FileShareService.incrementDownloadCount(share.id);

      // Open download
      window.open(fileInfo.downloadUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloading(false);
    }
  }, [fileInfo, share]);

  // Format expiration
  const expiresLabel = share?.expiresAt
    ? new Date(share.expiresAt).toLocaleDateString('el-GR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <main className="min-h-screen bg-gradient-to-b from-muted/50 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          {/* Loading */}
          {state === 'loading' && (
            <section className="text-center py-8">
              <Spinner size="large" className="mx-auto mb-4" />
              <p className={cn("text-sm", colors.text.muted)}>{t('share.loading')}</p>
            </section>
          )}

          {/* Error */}
          {state === 'error' && (
            <section className="text-center py-8">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <h2 className="text-lg font-semibold mb-2">{t('share.invalidLink')}</h2>
              <p className={cn("text-sm", colors.text.muted)}>{errorMessage}</p>
            </section>
          )}

          {/* Expired */}
          {state === 'expired' && (
            <section className="text-center py-8">
              <Clock className="h-12 w-12 mx-auto mb-4 text-amber-500" />
              <h2 className="text-lg font-semibold mb-2">{t('share.expired')}</h2>
              <p className={cn("text-sm", colors.text.muted)}>
                {t('share.requestNew')}
              </p>
            </section>
          )}

          {/* Password required */}
          {state === 'password' && (
            <section className="py-4">
              <figure className="flex items-center justify-center mb-6">
                <Lock className="h-12 w-12 text-amber-500" />
              </figure>
              <h2 className="text-lg font-semibold text-center mb-2">
                {t('share.protected')}
              </h2>
              <p className={cn("text-sm text-center mb-6", colors.text.muted)}>
                {t('share.passwordRequired')}
              </p>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium">{t('share.password')}</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setPasswordError(false); }}
                    className={cn(
                      'w-full mt-1 px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring',
                      passwordError && 'border-destructive',
                    )}
                    autoFocus
                    required
                  />
                  {passwordError && (
                    <span className="text-xs text-destructive mt-1">{t('share.wrongPassword')}</span>
                  )}
                </label>
                <Button type="submit" className="w-full">
                  <Shield className="h-4 w-4 mr-2" />
                  {t('share.access')}
                </Button>
              </form>
            </section>
          )}

          {/* Ready — show file info and download */}
          {state === 'ready' && fileInfo && (
            <section className="py-4">
              <figure className="flex items-center justify-center mb-6">
                <FileText className="h-12 w-12 text-primary" />
              </figure>

              <h2 className="text-lg font-semibold text-center mb-1 truncate">
                {fileInfo.displayName}
              </h2>

              <div className={cn("flex items-center justify-center gap-3 text-xs mb-6", colors.text.muted)}>
                <span>.{fileInfo.ext}</span>
                <span>{formatFileSize(fileInfo.sizeBytes)}</span>
                <span>{fileInfo.contentType}</span>
              </div>

              {/* Share note */}
              {share?.note && (
                <p className={cn("text-sm bg-muted/50 rounded-md p-3 mb-4 italic", colors.text.muted)}>
                  {share.note}
                </p>
              )}

              {/* Download button */}
              <Button
                onClick={handleDownload}
                disabled={downloading || !fileInfo.downloadUrl}
                className="w-full mb-4"
                size="lg"
              >
                {downloading ? (
                  <Spinner size="small" color="inherit" className="mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {t('share.download')}
              </Button>

              {/* Preview for images */}
              {fileInfo.contentType.startsWith('image/') && fileInfo.downloadUrl && (
                <figure className="border rounded-md overflow-hidden mb-4">
                  <img
                    src={fileInfo.downloadUrl}
                    alt={fileInfo.displayName}
                    className="w-full max-h-[300px] object-contain bg-muted/20"
                    loading="lazy"
                  />
                </figure>
              )}

              {/* Expiration info */}
              <footer className={cn("flex items-center justify-center gap-2 text-xs", colors.text.muted)}>
                <Clock className="h-3 w-3" />
                <span>{t('share.expires')} {expiresLabel}</span>
                {share && share.maxDownloads > 0 && (
                  <>
                    <span>·</span>
                    <span>{share.downloadCount}/{share.maxDownloads} {t('share.downloads')}</span>
                  </>
                )}
              </footer>
            </section>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
