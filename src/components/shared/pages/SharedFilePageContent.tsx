/**
 * =============================================================================
 * Public Share Page Content — `/shared/[token]`
 * =============================================================================
 *
 * Public page accessible without authentication. The server resolves the link
 * (ADR-884 Φ0.12, `POST /api/shares/resolve`); this component only renders the
 * named outcome: a password gate, a named refusal, or the shared entity.
 *
 * File preview goes through the SSoT FilePreviewRenderer (same component as the
 * authenticated file manager), fed a **short-lived signed URL** — never the
 * file's permanent `downloadUrl`.
 *
 * @module components/shared/pages/SharedFilePageContent
 * @enterprise ADR-191 — Enterprise Document Management System (Phase 4.3)
 */

'use client';

import React from 'react';
import { AlertTriangle, Clock, Download, FileText, Lock, Shield } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { SharedContactPageContent } from '@/components/shared/pages/SharedContactPageContent';
import { SharedTourPageContent } from '@/components/shared/pages/SharedTourPageContent';
import { SharedShowcasePageContent } from '@/components/shared/pages/SharedShowcasePageContent';
import { SharedProjectShowcasePageContent } from '@/components/shared/pages/SharedProjectShowcasePageContent';
import { SharedBuildingShowcasePageContent } from '@/components/shared/pages/SharedBuildingShowcasePageContent';
import { SharedStorageShowcasePageContent } from '@/components/shared/pages/SharedStorageShowcasePageContent';
import { SharedParkingShowcasePageContent } from '@/components/shared/pages/SharedParkingShowcasePageContent';
import { formatFileSize } from '@/utils/file-validation';
import { FilePreviewRenderer } from '@/components/shared/files/preview/FilePreviewRenderer';
import { getFileCategory, getFileCategoryI18nKey } from '@/lib/file-types/preview-registry';
import type { FileShareResolvedData } from '@/services/sharing/resolvers';
import type { ResolvedSharePayload } from '@/services/sharing/share-resolve-contract';
import '@/lib/design-system';
import { useSharedFilePageState, type SharedFilePageState, type SharedPageView } from './useSharedFilePageState';

type RefusedView = Extract<SharedPageView, { kind: 'refused' }>;

/** Refusal → i18n keys (`files-media:share.*`). Revoked and never-existed look the same on purpose. */
const REFUSAL_COPY: Record<RefusedView['reason'], { title: string; body: string }> = {
  'not-found': { title: 'share.invalidLink', body: 'share.invalidLinkDescription' },
  expired: { title: 'share.expired', body: 'share.requestNew' },
  exhausted: { title: 'share.exhausted', body: 'share.exhaustedDescription' },
  locked: { title: 'share.locked', body: 'share.lockedDescription' },
  unavailable: { title: 'share.unavailable', body: 'share.unavailableDescription' },
};

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString('el-GR', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function RefusalSection({ reason }: { reason: RefusedView['reason'] }) {
  const { t } = useTranslation('files-media');
  const colors = useSemanticColors();
  const copy = REFUSAL_COPY[reason];
  const Icon = reason === 'expired' || reason === 'locked' ? Clock : AlertTriangle;
  return (
    <section className="text-center py-8">
      <Icon className="h-12 w-12 mx-auto mb-4 text-destructive" />
      <h2 className="text-lg font-semibold mb-2">{t(copy.title)}</h2>
      <p className={cn('text-sm', colors.text.muted)}>{t(copy.body)}</p>
    </section>
  );
}

function PasswordGate({ state, wrongPassword }: { state: SharedFilePageState; wrongPassword: boolean }) {
  const { t } = useTranslation('files-media');
  const colors = useSemanticColors();
  return (
    <section className="py-4">
      <figure className="flex items-center justify-center mb-6">
        <Lock className="h-12 w-12 text-[hsl(var(--text-warning))]" />
      </figure>
      <h2 className="text-lg font-semibold text-center mb-2">{t('share.protected')}</h2>
      <p className={cn('text-sm text-center mb-6', colors.text.muted)}>{t('share.passwordRequired')}</p>
      <form onSubmit={state.handlePasswordSubmit} className="space-y-4 max-w-sm mx-auto">
        <label className="block">
          <span className="text-sm font-medium">{t('share.password')}</span>
          <input
            type="password"
            value={state.password}
            onChange={(e) => state.setPassword(e.target.value)}
            className={cn(
              'w-full mt-1 px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring',
              wrongPassword && 'border-destructive',
            )}
            autoFocus
            required
          />
          {wrongPassword && <span className="text-xs text-destructive mt-1">{t('share.wrongPassword')}</span>}
        </label>
        <Button type="submit" className="w-full" disabled={state.submitting}>
          {state.submitting ? <Spinner size="small" color="inherit" className="mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
          {t('share.access')}
        </Button>
      </form>
    </section>
  );
}

function FileSection({ file, expiresAt, state }: { file: FileShareResolvedData; expiresAt: string; state: SharedFilePageState }) {
  const { t } = useTranslation('files-media');
  const colors = useSemanticColors();
  const contentType = file.contentType ?? '';
  const fileTypeLabel = t(getFileCategoryI18nKey(getFileCategory(contentType, file.originalFilename)));
  return (
    <section className="py-4">
      <header className="text-center mb-6">
        <figure className="flex items-center justify-center mb-3">
          <FileText className="h-10 w-10 text-primary" />
        </figure>
        <h2 className="text-lg font-semibold mb-1 truncate">{file.displayName}</h2>
        <p className={cn('flex items-center justify-center gap-3 text-xs', colors.text.muted)}>
          {file.ext && <span>.{file.ext}</span>}
          <span aria-hidden="true">·</span>
          <span>{formatFileSize(file.sizeBytes ?? 0)}</span>
          <span aria-hidden="true">·</span>
          <span>{fileTypeLabel}</span>
        </p>
      </header>
      {file.note && (
        <p className={cn('text-sm bg-muted/50 rounded-md p-3 mb-4 italic text-center', colors.text.muted)}>{file.note}</p>
      )}
      <Button onClick={state.handleDownload} disabled={state.downloading} className="w-full mb-4" size="lg">
        {state.downloading ? <Spinner size="small" color="inherit" className="mr-2" /> : <Download className="h-4 w-4 mr-2" />}
        {t('share.download')}
      </Button>
      {file.previewUrl && (
        <figure className="border rounded-md overflow-hidden mb-4 flex flex-col min-h-[500px] max-h-[70vh]">
          <FilePreviewRenderer
            url={file.previewUrl}
            contentType={contentType}
            fileName={file.originalFilename}
            displayName={file.displayName}
            sizeBytes={file.sizeBytes ?? 0}
            onDownload={state.handleDownload}
          />
        </figure>
      )}
      <footer className={cn('flex items-center justify-center gap-2 text-xs', colors.text.muted)}>
        <Clock className="h-3 w-3" />
        <span>{t('share.expires')} {formatExpiry(expiresAt)}</span>
      </footer>
    </section>
  );
}

/** The non-file kinds own their whole page — they bypass the file-centric chrome. */
function renderEntityPage(share: ResolvedSharePayload, expiresAt: string, token: string): React.ReactElement | null {
  switch (share.kind) {
    case 'contact': return <SharedContactPageContent data={share.data} expiresAt={expiresAt} />;
    case 'property_showcase': return <SharedShowcasePageContent token={token} />;
    case 'project_showcase': return <SharedProjectShowcasePageContent token={token} />;
    case 'building_showcase': return <SharedBuildingShowcasePageContent token={token} />;
    case 'storage_showcase': return <SharedStorageShowcasePageContent token={token} />;
    case 'parking_showcase': return <SharedParkingShowcasePageContent token={token} />;
    case 'spatial_tour': return <SharedTourPageContent data={share.data} />;
    case 'file': return null;
  }
}

export function SharedFilePageContent() {
  const state = useSharedFilePageState();
  const { view, token } = state;
  const { t } = useTranslation('files-media');
  const colors = useSemanticColors();

  if (view.kind === 'resolved') {
    const entityPage = renderEntityPage(view.share, view.expiresAt, token);
    if (entityPage !== null) return entityPage;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-muted/50 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl">
        <CardContent className="pt-6">
          {view.kind === 'loading' && (
            <section className="text-center py-8">
              <Spinner size="large" className="mx-auto mb-4" />
              <p className={cn('text-sm', colors.text.muted)}>{t('share.loading')}</p>
            </section>
          )}
          {view.kind === 'refused' && <RefusalSection reason={view.reason} />}
          {view.kind === 'password' && <PasswordGate state={state} wrongPassword={view.wrongPassword} />}
          {view.kind === 'resolved' && view.share.kind === 'file' && (
            <FileSection file={view.share.data} expiresAt={view.expiresAt} state={state} />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
