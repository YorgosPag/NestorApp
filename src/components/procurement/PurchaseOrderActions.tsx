/* eslint-disable design-system/prefer-design-system-imports */
'use client';

/**
 * PO Action Buttons — PDF Export, Email Send, Share Link
 *
 * Renders action toolbar for PO detail view.
 * Each action calls the corresponding API endpoint.
 *
 * @module components/procurement/PurchaseOrderActions
 * @enterprise ADR-267 Phase B
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDown, Mail, Link2, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PurchaseOrder } from '@/types/procurement';
import { API_ROUTES } from '@/config/domain-constants';
import { triggerExportDownload } from '@/lib/exports/trigger-export-download';
import {
  createPurchaseOrderShareWithPolicy,
  sendPurchaseOrderEmailWithPolicy,
} from '@/services/procurement/procurement-mutation-gateway';

// ============================================================================
// TYPES
// ============================================================================

interface PurchaseOrderActionsProps {
  po: PurchaseOrder;
}

type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

// ============================================================================
// PDF DOWNLOAD
// ============================================================================

function usePdfDownload(poId: string) {
  const [status, setStatus] = useState<ActionStatus>('idle');

  const download = useCallback(async (lang: 'el' | 'en' = 'el') => {
    setStatus('loading');
    try {
      const pdfUrl = new URL(API_ROUTES.PROCUREMENT.PDF(poId), window.location.origin);
      pdfUrl.searchParams.set('lang', lang);
      const res = await fetch(pdfUrl.toString());
      if (!res.ok) throw new Error(res.statusText);

      const blob = await res.blob();
      triggerExportDownload({ blob, filename: [poId, 'pdf'].join('.') });
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  }, [poId]);

  return { download, status };
}

// ============================================================================
// SHARE LINK
// ============================================================================

function useShareLink(poId: string) {
  const [status, setStatus] = useState<ActionStatus>('idle');
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const createShare = useCallback(async () => {
    setStatus('loading');
    try {
      const result = await createPurchaseOrderShareWithPolicy(poId);
      const url = result.url;
      setShareUrl(url);

      await navigator.clipboard.writeText(url);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  }, [poId]);

  return { createShare, status, shareUrl };
}

// ============================================================================
// EMAIL DIALOG
// ============================================================================

interface EmailDialogProps {
  open: boolean;
  onClose: () => void;
  poId: string;
  poNumber: string;
}

function EmailSendDialog({ open, onClose, poId, poNumber }: EmailDialogProps) {
  const { t } = useTranslation('procurement');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [lang, setLang] = useState<'el' | 'en'>('el');
  const [status, setStatus] = useState<ActionStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSend = useCallback(async () => {
    if (!email || !name) return;
    setStatus('loading');
    setErrorMsg('');

    try {
      await sendPurchaseOrderEmailWithPolicy(poId, {
        recipientEmail: email,
        recipientName: name,
        language: lang,
      });

      setStatus('success');
      setTimeout(() => {
        onClose();
        setStatus('idle');
        setEmail('');
        setName('');
      }, 2000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }, [email, name, lang, poId, onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('email.sendButton')} — {poNumber}
          </DialogTitle>
        </DialogHeader>

        <fieldset className="space-y-4" disabled={status === 'loading'}>
          <div className="space-y-2">
            <Label htmlFor="po-email-to">{t('email.recipientLabel')}</Label>
            <Input
              id="po-email-to"
              type="email"
              placeholder={t('email.recipientPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="po-email-name">{t('email.recipientName')}</Label>
            <Input
              id="po-email-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="po-email-lang">{t('email.language')}</Label>
            <select
              id="po-email-lang"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={lang}
              onChange={(e) => setLang(e.target.value as 'el' | 'en')}
            >
              <option value="el">{t('pdf.exportButton')} (EL)</option>
              <option value="en">{t('pdf.exportButton')} (EN)</option>
            </select>
          </div>

          {status === 'error' && errorMsg && (
            <p className="text-sm text-destructive">{errorMsg}</p>
          )}

          <Button
            className="w-full"
            onClick={handleSend}
            disabled={!email || !name || status === 'loading'}
          >
            {status === 'loading' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {status === 'success' && <Check className="mr-2 h-4 w-4" />}
            {status === 'success' ? t('email.success') : t('email.sendButton')}
          </Button>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function PurchaseOrderActions({ po }: PurchaseOrderActionsProps) {
  const { t } = useTranslation('procurement');
  const [emailOpen, setEmailOpen] = useState(false);
  const { download, status: pdfStatus } = usePdfDownload(po.id);
  const { createShare, status: shareStatus } = useShareLink(po.id);

  return (
    <>
      <nav className="flex flex-wrap gap-2" aria-label="PO actions">
        {/* PDF Export */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => download('el')}
          disabled={pdfStatus === 'loading'}
        >
          {pdfStatus === 'loading'
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <FileDown className="mr-2 h-4 w-4" />
          }
          {t('pdf.exportButton')}
        </Button>

        {/* Email */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEmailOpen(true)}
        >
          <Mail className="mr-2 h-4 w-4" />
          {t('email.sendButton')}
        </Button>

        {/* Share Link */}
        <Button
          variant="outline"
          size="sm"
          onClick={createShare}
          disabled={shareStatus === 'loading'}
        >
          {shareStatus === 'loading'
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : shareStatus === 'success'
              ? <Check className="mr-2 h-4 w-4" />
              : <Link2 className="mr-2 h-4 w-4" />
          }
          {shareStatus === 'success' ? t('share.copied') : t('share.createLink')}
        </Button>
      </nav>

      <EmailSendDialog
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        poId={po.id}
        poNumber={po.poNumber}
      />
    </>
  );
}
