/**
 * =============================================================================
 * 🏢 ENTERPRISE: Version History Panel
 * =============================================================================
 *
 * Displays file version history with rollback capability.
 * Used in FilePreviewPanel or as standalone in EntityFilesManager.
 *
 * @module components/shared/files/VersionHistory
 * @enterprise ADR-191 - Enterprise Document Management System (Phase 2.3)
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { History, RotateCcw, Download, Clock } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { formatFileSize } from '@/utils/file-validation';
import { formatFlexibleDate } from '@/lib/intl-utils';
import { FileVersionService, type FileVersionSnapshot } from '@/services/file-version.service';
import { useFileDownload } from '@/components/shared/files/hooks/useFileDownload';
import '@/lib/design-system';
import { createStaleCache } from '@/lib/stale-cache';

const fileVersionHistoryCache = createStaleCache<FileVersionSnapshot[]>('file-version-history');

// ============================================================================
// TYPES
// ============================================================================

interface VersionHistoryProps {
  /** File ID to show history for */
  fileId: string;
  /** Current revision number */
  currentRevision?: number;
  /** Current user ID (for rollback) */
  currentUserId?: string;
  /** Callback after rollback */
  onRollback?: () => void;
  /** Additional className */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function VersionHistory({
  fileId,
  currentRevision = 1,
  currentUserId,
  onRollback,
  className,
}: VersionHistoryProps) {
  const { t } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();
  const iconSizes = useIconSizes();

  const [versions, setVersions] = useState<FileVersionSnapshot[]>(fileVersionHistoryCache.get(fileId) ?? []);
  const [loading, setLoading] = useState(!fileVersionHistoryCache.hasLoaded(fileId));
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { handleDownload: downloadVersion } = useFileDownload();

  // Load version history
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!fileVersionHistoryCache.hasLoaded(fileId)) setLoading(true);
      setError(null);
      try {
        const history = await FileVersionService.getVersionHistory(fileId);
        if (!cancelled) {
          fileVersionHistoryCache.set(history, fileId);
          setVersions(history);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load history');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [fileId, currentRevision]);

  // Rollback handler
  const handleRollback = useCallback(async (versionNumber: number) => {
    if (!currentUserId) return;

    setRollingBack(`v${versionNumber}`);
    try {
      await FileVersionService.rollbackToVersion(fileId, versionNumber, currentUserId);
      onRollback?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rollback failed');
    } finally {
      setRollingBack(null);
    }
  }, [fileId, currentUserId, onRollback]);

  // No versions yet
  if (!loading && versions.length === 0) {
    return (
      <section className={cn('p-4 text-center', colors.text.muted, className)}>
        <History className={cn(iconSizes.lg, 'mx-auto mb-2 opacity-50')} />
        <p className="text-sm">{t('versions.noHistory')}</p>
        <p className="text-xs mt-1 opacity-70">
          {t('versions.currentOnly')}
        </p>
      </section>
    );
  }

  return (
    <section className={cn('space-y-2', className)} aria-label={t('versions.title')}>
      {/* Header */}
      <header className="flex items-center gap-2 px-2">
        <History className={cn(iconSizes.sm, colors.text.muted)} />
        <h4 className="text-sm font-medium">
          {t('versions.title')}
        </h4>
        <span className={cn('text-xs', colors.text.muted)}>
          ({t('versions.previousCount', { count: versions.length })})
        </span>
      </header>

      {/* Current version indicator */}
      <article
        className={cn(
          'flex items-center gap-3 p-2 bg-primary/5',
          quick.card,
          'border-primary/30',
        )}
      >
        <span className="flex-shrink-0 w-10 h-6 flex items-center justify-center bg-primary/20 rounded text-xs font-bold text-primary">
          v{currentRevision}
        </span>
        <span className="text-sm font-medium flex-1">
          {t('versions.current')}
        </span>
      </article>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center p-4">
          <Spinner />
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive px-2">{error}</p>
      )}

      {/* Version list (newest first) */}
      {[...versions].reverse().map((version) => (
        <article
          key={version.id}
          className={cn(
            'flex items-center gap-3 p-2',
            quick.card,
            'border',
          )}
        >
          {/* Version badge */}
          <span className={cn(
            'flex-shrink-0 w-10 h-6 flex items-center justify-center rounded text-xs font-medium',
            colors.bg.muted,
            colors.text.muted,
          )}>
            v{version.versionNumber}
          </span>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate">{version.originalFilename}</p>
            <div className={cn('flex items-center gap-2 text-xs', colors.text.muted)}>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatFlexibleDate(version.createdAt)}
              </span>
              <span>{formatFileSize(version.sizeBytes)}</span>
              {version.changeNote && (
                <span className="truncate italic">{version.changeNote}</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <nav className="flex items-center gap-1 flex-shrink-0">
            {/* Download this version */}
            {version.downloadUrl && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => downloadVersion({
                      downloadUrl: version.downloadUrl,
                      displayName: `v${version.versionNumber}_${version.originalFilename}`,
                      originalFilename: version.originalFilename,
                      ext: version.ext,
                      storagePath: version.storagePath,
                    })}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('versions.download')}</TooltipContent>
              </Tooltip>
            )}

            {/* Rollback to this version */}
            {currentUserId && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-amber-600 hover:text-amber-700"
                    onClick={() => handleRollback(version.versionNumber)}
                    disabled={rollingBack !== null}
                  >
                    {rollingBack === `v${version.versionNumber}` ? (
                      <Spinner size="small" color="inherit" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('versions.rollback')}</TooltipContent>
              </Tooltip>
            )}
          </nav>
        </article>
      ))}
    </section>
  );
}
