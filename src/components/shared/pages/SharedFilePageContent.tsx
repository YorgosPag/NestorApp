/**
 * =============================================================================
 * Public Share Page Content — View/download shared files
 * =============================================================================
 *
 * Public page accessible without authentication.
 * Validates share token, handles password protection, and serves file.
 *
 * Preview rendering is delegated to the SSoT FilePreviewRenderer, which is
 * the same component the authenticated file manager uses — ensuring every
 * supported file type (PDF, images, video, audio, DOCX) previews identically
 * in both contexts.
 *
 * SRP split — state/IO flow lives in ./useSharedFilePageState.
 *
 * @module components/shared/pages/SharedFilePageContent
 * @enterprise ADR-191 — Enterprise Document Management System (Phase 4.3)
 */

'use client';

import React from 'react';
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
import { SharedContactPageContent } from '@/components/shared/pages/SharedContactPageContent';
import { SharedShowcasePageContent } from '@/components/shared/pages/SharedShowcasePageContent';
import { SharedProjectShowcasePageContent } from '@/components/shared/pages/SharedProjectShowcasePageContent';
import { SharedBuildingShowcasePageContent } from '@/components/shared/pages/SharedBuildingShowcasePageContent';
import { SharedStorageShowcasePageContent } from '@/components/shared/pages/SharedStorageShowcasePageContent';
import { SharedParkingShowcasePageContent } from '@/components/shared/pages/SharedParkingShowcasePageContent';
import { formatFileSize } from '@/utils/file-validation';
import { FilePreviewRenderer } from '@/components/shared/files/preview/FilePreviewRenderer';
import { getFileCategory, getFileCategoryI18nKey } from '@/lib/file-types/preview-registry';
import '@/lib/design-system';
import { useSharedFilePageState } from './useSharedFilePageState';

export function SharedFilePageContent() {
  const colors = useSemanticColors();
  const { t } = useTranslation('files-media');

  const {
    token,
    state,
    share,
    fileInfo,
    password,
    passwordError,
    downloading,
    contactData,
    contactExpiresAt,
    showcaseData,
    pendingUnifiedShare,
    setPassword,
    setPasswordError,
    handlePasswordSubmit,
    handleDownload,
  } = useSharedFilePageState();

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

  // Friendly file type label via SSoT registry
  const fileTypeLabel = fileInfo
    ? t(getFileCategoryI18nKey(getFileCategory(fileInfo.contentType, fileInfo.originalFilename)))
    : '';

  // ADR-315: Contact public view bypasses the file-centric chrome entirely.
  if (state === 'contact' && contactData) {
    return (
      <SharedContactPageContent
        data={contactData}
        expiresAt={contactExpiresAt}
      />
    );
  }

  // ADR-315: Property Showcase public view — replaces legacy /shared/po redirect.
  if (state === 'showcase' && showcaseData) {
    return <SharedShowcasePageContent token={token} />;
  }

  // ADR-316: Project Showcase public view.
  if (state === 'project_showcase') {
    return <SharedProjectShowcasePageContent token={token} />;
  }

  // ADR-320: Building Showcase public view.
  if (state === 'building_showcase') {
    return <SharedBuildingShowcasePageContent token={token} />;
  }

  // ADR-315: Storage Showcase public view.
  if (state === 'storage_showcase') {
    return <SharedStorageShowcasePageContent token={token} />;
  }

  // ADR-315: Parking Showcase public view.
  if (state === 'parking_showcase') {
    return <SharedParkingShowcasePageContent token={token} />;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-muted/50 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl">
        <CardContent className="pt-6">
          {/* Loading */}
          {state === 'loading' && (
            <section className="text-center py-8">
              <Spinner size="large" className="mx-auto mb-4" />
              <p className={cn('text-sm', colors.text.muted)}>{t('share.loading')}</p>
            </section>
          )}

          {/* Error */}
          {state === 'error' && (
            <section className="text-center py-8">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <h2 className="text-lg font-semibold mb-2">{t('share.invalidLink')}</h2>
              <p className={cn('text-sm', colors.text.muted)}>{t('share.invalidLinkDescription')}</p>
            </section>
          )}

          {/* Expired */}
          {state === 'expired' && (
            <section className="text-center py-8">
              <Clock className="h-12 w-12 mx-auto mb-4 text-amber-500" />
              <h2 className="text-lg font-semibold mb-2">{t('share.expired')}</h2>
              <p className={cn('text-sm', colors.text.muted)}>{t('share.requestNew')}</p>
            </section>
          )}

          {/* Password required */}
          {state === 'password' && (() => {
            const gateNote = pendingUnifiedShare?.note ?? share?.note ?? null;
            const gateExpiresAt = pendingUnifiedShare?.expiresAt ?? share?.expiresAt ?? null;
            const gateMax = pendingUnifiedShare?.maxAccesses ?? share?.maxDownloads ?? 0;
            const gateUsed = pendingUnifiedShare?.accessCount ?? share?.downloadCount ?? 0;
            const gateExpiresLabel = gateExpiresAt
              ? new Date(gateExpiresAt).toLocaleDateString('el-GR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '';
            return (
              <section className="py-4">
                <figure className="flex items-center justify-center mb-6">
                  <Lock className="h-12 w-12 text-amber-500" />
                </figure>
                <h2 className="text-lg font-semibold text-center mb-2">
                  {t('share.protected')}
                </h2>
                <p className={cn('text-sm text-center mb-4', colors.text.muted)}>
                  {t('share.passwordRequired')}
                </p>

                {gateNote && (
                  <p className={cn(
                    'text-sm bg-muted/50 rounded-md p-3 mb-4 italic text-center max-w-sm mx-auto',
                    colors.text.muted,
                  )}>
                    {gateNote}
                  </p>
                )}

                <footer className={cn(
                  'flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs mb-6',
                  colors.text.muted,
                )}>
                  {gateExpiresLabel && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {t('share.expires')} {gateExpiresLabel}
                    </span>
                  )}
                  {gateExpiresLabel && <span aria-hidden="true">·</span>}
                  <span className="flex items-center gap-1">
                    <Download className="h-3 w-3" />
                    {gateMax > 0
                      ? `${gateUsed}/${gateMax} ${t('share.downloads')}`
                      : t('share.unlimitedDownloads')}
                  </span>
                </footer>

                <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-sm mx-auto">
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
            );
          })()}

          {/* Ready — show file info, preview and download */}
          {state === 'ready' && fileInfo && (
            <section className="py-4">
              <header className="text-center mb-6">
                <figure className="flex items-center justify-center mb-3">
                  <FileText className="h-10 w-10 text-primary" />
                </figure>
                <h2 className="text-lg font-semibold mb-1 truncate">
                  {fileInfo.displayName}
                </h2>
                <div className={cn('flex items-center justify-center gap-3 text-xs', colors.text.muted)}>
                  {fileInfo.ext && <span>.{fileInfo.ext}</span>}
                  <span>·</span>
                  <span>{formatFileSize(fileInfo.sizeBytes)}</span>
                  <span>·</span>
                  <span>{fileTypeLabel}</span>
                </div>
              </header>

              {/* Share note */}
              {share?.note && (
                <p className={cn('text-sm bg-muted/50 rounded-md p-3 mb-4 italic text-center', colors.text.muted)}>
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

              {/* SSoT preview — same renderer as authenticated file manager */}
              <div className="border rounded-md overflow-hidden mb-4 flex flex-col min-h-[500px] max-h-[70vh]">
                <FilePreviewRenderer
                  url={fileInfo.downloadUrl}
                  contentType={fileInfo.contentType}
                  fileName={fileInfo.originalFilename}
                  displayName={fileInfo.displayName}
                  sizeBytes={fileInfo.sizeBytes}
                  onDownload={handleDownload}
                />
              </div>

              {/* Expiration info */}
              <footer className={cn('flex items-center justify-center gap-2 text-xs', colors.text.muted)}>
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
