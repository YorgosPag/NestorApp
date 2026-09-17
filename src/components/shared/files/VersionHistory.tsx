/**
 * =============================================================================
 * 🏢 ENTERPRISE: Version History Panel — η στοίβα εκδόσεων (ADR-862 Φ0)
 * =============================================================================
 *
 * Δείχνει την **αλυσίδα διαδοχής** του αρχείου (κεφαλή πρώτη) και προσφέρει
 * «Ορισμός ως τρέχουσας» σε κάθε παλιά έκδοση — όπως το Autodesk Docs / Box / SharePoint:
 * η επαναφορά γεννά **νέα** έκδοση στην κορυφή, το ιστορικό μένει ακέραιο.
 *
 * 🔴 Μέχρι 2026-09-17 διάβαζε την υποσυλλογή `versions` με client SDK — **νεκρή στην
 * παραγωγή** (deny-all) — και η «επαναφορά» έγραφε επιτόπια, χωρίς συναλλαγή.
 *
 * 🔑 Η κεφαλή που **έδειξε** η οθόνη ταξιδεύει ως προϋπόθεση: αν άλλαξε στο μεταξύ, ο
 * διακομιστής απαντά `head-moved` και η οθόνη ξαναφορτώνει — ποτέ σιωπηλή αντικατάσταση.
 *
 * @module components/shared/files/VersionHistory
 * @enterprise ADR-191 · ADR-862 Φ0
 */

'use client';

import React, { useCallback } from 'react';
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
import { useFileDownload } from '@/components/shared/files/hooks/useFileDownload';
import { useVersionStack } from '@/components/shared/files/hooks/useVersionStack';
import type { FileVersionEntry } from '@/types/file-version-stack';
import '@/lib/design-system';

interface VersionHistoryProps {
  /** Οποιαδήποτε έκδοση της αλυσίδας — η στοίβα βρίσκει μόνη της την κεφαλή. */
  fileId: string;
  /** Ο αιτών — χωρίς ταυτότητα δεν προσφέρεται «Ορισμός ως τρέχουσας». */
  currentUserId?: string;
  /** Μετά από επιτυχή «Ορισμός ως τρέχουσας» (π.χ. ανανέωση λίστας). */
  onPromoted?: () => void;
  className?: string;
}

interface VersionRowProps {
  readonly version: FileVersionEntry;
  readonly number: number;
  readonly restoredFrom: number | null;
  /** Αυτή η γραμμή προωθείται τώρα. */
  readonly promoting: boolean;
  /** Κάποια προώθηση τρέχει — κλείδωμα, όχι εξαφάνιση των κουμπιών. */
  readonly locked: boolean;
  readonly canPromote: boolean;
  readonly onDownload: (version: FileVersionEntry, number: number) => void;
  readonly onPromote: (version: FileVersionEntry) => void;
}

function VersionActions({ version, number, promoting, locked, canPromote, onDownload, onPromote }: VersionRowProps) {
  const { t } = useTranslation(['files', 'files-media']);
  return (
    <nav className="flex items-center gap-1 flex-shrink-0">
      {version.downloadUrl && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDownload(version, number)}>
              <Download className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('versions.download')}</TooltipContent>
        </Tooltip>
      )}
      {canPromote && !version.isCurrent && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onPromote(version)} disabled={locked} aria-label={t('versions.makeCurrent')}>
              {promoting ? <Spinner size="small" color="inherit" /> : <RotateCcw className="h-3.5 w-3.5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('versions.makeCurrentHint')}</TooltipContent>
        </Tooltip>
      )}
    </nav>
  );
}

function VersionRow(props: VersionRowProps) {
  const { version, number, restoredFrom } = props;
  const { t } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();
  return (
    <article className={cn('flex items-center gap-3 p-2', quick.card, version.isCurrent ? 'bg-primary/5 border-primary/30' : 'border')}>
      <span className={cn('flex-shrink-0 w-10 h-6 flex items-center justify-center rounded text-xs font-bold', version.isCurrent ? 'bg-primary/20 text-primary' : cn(colors.bg.muted, colors.text.muted))}>
        v{number}
      </span>
      <section className="flex-1 min-w-0">
        <p className="text-sm truncate">
          {version.isCurrent ? t('versions.current') : version.originalFilename}
        </p>
        <p className={cn('flex items-center gap-2 text-xs', colors.text.muted)}>
          <Clock className="h-3 w-3" />
          {version.createdAt ? formatFlexibleDate(version.createdAt) : null}
          {version.sizeBytes !== null && <span>{formatFileSize(version.sizeBytes)}</span>}
          {restoredFrom !== null && <span className="italic">{t('versions.restoredFrom', { number: restoredFrom })}</span>}
        </p>
      </section>
      <VersionActions {...props} />
    </article>
  );
}

export function VersionHistory({ fileId, currentUserId, onPromoted, className }: VersionHistoryProps) {
  const { t } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const { handleDownload } = useFileDownload();
  const { stack, loading, promotingId, numbers, promote } = useVersionStack(fileId, onPromoted);

  const download = useCallback((version: FileVersionEntry, number: number) => {
    if (!version.downloadUrl) return;
    handleDownload({
      downloadUrl: version.downloadUrl,
      displayName: `v${number}_${version.originalFilename}`,
      originalFilename: version.originalFilename,
      ext: version.ext,
      storagePath: version.storagePath,
    });
  }, [handleDownload]);

  if (loading) return <p role="status" className={cn('flex justify-center p-4', className)}><Spinner /></p>;
  if (!stack) return <p role="alert" className={cn('text-sm text-destructive p-2', className)}>{t('versions.loadFailed')}</p>;
  if (stack.versions.length <= 1) {
    return (
      <section className={cn('p-4 text-center', colors.text.muted, className)}>
        <History className={cn(iconSizes.lg, 'mx-auto mb-2 opacity-50')} />
        <p className="text-sm">{t('versions.noHistory')}</p>
        <p className="text-xs mt-1 opacity-70">{t('versions.currentOnly')}</p>
      </section>
    );
  }

  return (
    <section className={cn('space-y-2', className)} aria-label={t('versions.title')}>
      <header className="flex items-center gap-2 px-2">
        <History className={cn(iconSizes.sm, colors.text.muted)} />
        <h4 className="text-sm font-medium">{t('versions.title')}</h4>
        <span className={cn('text-xs', colors.text.muted)}>({t('versions.previousCount', { count: stack.versions.length - 1 })})</span>
      </header>
      {stack.versions.map(version => (
        <VersionRow
          key={version.id}
          version={version}
          number={numbers.get(version.id) ?? 0}
          restoredFrom={version.promotedFromFileId ? numbers.get(version.promotedFromFileId) ?? null : null}
          promoting={promotingId === version.id}
          locked={promotingId !== null}
          canPromote={Boolean(currentUserId)}
          onDownload={download}
          onPromote={promote}
        />
      ))}
    </section>
  );
}
