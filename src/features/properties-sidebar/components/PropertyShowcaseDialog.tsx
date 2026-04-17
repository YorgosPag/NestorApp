'use client';

/**
 * Property Showcase Dialog (ADR-312)
 *
 * Triggered by the "Επίδειξη Ακινήτου" header action. Provides three
 * operations: generate a share (via POST /api/properties/[id]/showcase/generate),
 * copy the rich-page link to clipboard, download the branded PDF, revoke any
 * active showcase share (via DELETE on the same endpoint).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Download, Share2, Trash2, Check, Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/providers/NotificationProvider';

interface PropertyShowcaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  propertyName: string;
}

interface GeneratedShare {
  token: string;
  pdfUrl: string;
  richUrl: string;
  expiresAt: string;
}

type DialogState =
  | { kind: 'idle' }
  | { kind: 'generating' }
  | { kind: 'ready'; share: GeneratedShare; copied: boolean }
  | { kind: 'revoking' }
  | { kind: 'error'; message: string };

export function PropertyShowcaseDialog({
  open,
  onOpenChange,
  propertyId,
  propertyName,
}: PropertyShowcaseDialogProps) {
  const { t } = useTranslation(['properties-detail', 'common']);
  const { success: notifySuccess, error: notifyError } = useNotifications();
  const [state, setState] = useState<DialogState>({ kind: 'idle' });

  useEffect(() => {
    if (!open) setState({ kind: 'idle' });
  }, [open]);

  const handleGenerate = useCallback(async () => {
    setState({ kind: 'generating' });
    try {
      const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/showcase/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: 'el' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const body = await res.json();
      const payload = (body?.data ?? body) as GeneratedShare;
      setState({ kind: 'ready', share: payload, copied: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      notifyError(message);
      setState({ kind: 'error', message });
    }
  }, [propertyId, notifyError]);

  const handleCopy = useCallback(async () => {
    if (state.kind !== 'ready') return;
    try {
      await navigator.clipboard.writeText(state.share.richUrl);
      setState({ ...state, copied: true });
      notifySuccess(t('properties-detail:showcase.copied'));
    } catch {
      notifyError(t('properties-detail:showcase.copyFailed'));
    }
  }, [state, notifySuccess, notifyError, t]);

  const handleRevoke = useCallback(async () => {
    setState({ kind: 'revoking' });
    try {
      const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/showcase/generate`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      notifySuccess(t('properties-detail:showcase.revoked'));
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      notifyError(message);
      setState({ kind: 'error', message });
    }
  }, [propertyId, notifySuccess, notifyError, t, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-violet-600" aria-hidden="true" />
            {t('properties-detail:showcase.title')}
          </DialogTitle>
          <DialogDescription>
            {t('properties-detail:showcase.subtitle', { defaultValue: '' })}
            {propertyName ? ` — ${propertyName}` : ''}
          </DialogDescription>
        </DialogHeader>

        <ShowcaseDialogBody
          state={state}
          onGenerate={handleGenerate}
          onCopy={handleCopy}
          onRevoke={handleRevoke}
          t={t}
        />
      </DialogContent>
    </Dialog>
  );
}

interface ShowcaseDialogBodyProps {
  state: DialogState;
  onGenerate: () => void;
  onCopy: () => void;
  onRevoke: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function ShowcaseDialogBody({ state, onGenerate, onCopy, onRevoke, t }: ShowcaseDialogBodyProps) {
  if (state.kind === 'idle' || state.kind === 'error') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          {t('properties-detail:showcase.introText')}
        </p>
        <Button
          onClick={onGenerate}
          className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:from-violet-600 hover:to-fuchsia-700 text-white"
        >
          <Share2 className="h-4 w-4 mr-2" />
          {t('properties-detail:showcase.generate')}
        </Button>
        {state.kind === 'error' && (
          <p className="text-sm text-red-600" role="alert">{state.message}</p>
        )}
      </div>
    );
  }

  if (state.kind === 'generating') {
    return (
      <div className="flex items-center gap-3 py-6 text-gray-600">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span>{t('properties-detail:showcase.generating')}</span>
      </div>
    );
  }

  if (state.kind === 'revoking') {
    return (
      <div className="flex items-center gap-3 py-6 text-gray-600">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span>{t('properties-detail:showcase.revoking')}</span>
      </div>
    );
  }

  const expiresAtDate = new Date(state.share.expiresAt);
  return (
    <div className="space-y-3">
      <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
        <label className="text-xs text-violet-900 font-semibold">
          {t('properties-detail:showcase.richLinkLabel')}
        </label>
        <p className="text-sm text-violet-800 break-all">{state.share.richUrl}</p>
      </div>
      <p className="text-xs text-gray-500">
        {t('properties-detail:showcase.expiresOn')}: {expiresAtDate.toLocaleDateString()}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Button onClick={onCopy} variant="secondary">
          {state.copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
          {state.copied ? t('properties-detail:showcase.copied') : t('properties-detail:showcase.copyLink')}
        </Button>
        <Button asChild variant="secondary">
          <a href={state.share.pdfUrl} target="_blank" rel="noopener noreferrer">
            <Download className="h-4 w-4 mr-2" />
            {t('properties-detail:showcase.downloadPdf')}
          </a>
        </Button>
      </div>
      <Button onClick={onRevoke} variant="ghost" className="w-full text-red-600 hover:bg-red-50">
        <Trash2 className="h-4 w-4 mr-2" />
        {t('properties-detail:showcase.revoke')}
      </Button>
    </div>
  );
}
