/**
 * =============================================================================
 * 🏢 ENTERPRISE: Share Dialog
 * =============================================================================
 *
 * Modal dialog for creating shareable file links.
 * Supports expiration, password protection, max downloads, and notes.
 *
 * @module components/shared/files/ShareDialog
 * @enterprise ADR-191 - Enterprise Document Management System (Phase 4.2)
 */

'use client';

import React, { useState, useCallback } from 'react';
import {
  Share2,
  Copy,
  Check,
  Clock,
  Lock,
  Download,
  MessageSquare,
} from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { FileShareService } from '@/services/file-share.service';

// ============================================================================
// TYPES
// ============================================================================

interface ShareDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Close handler */
  onOpenChange: (open: boolean) => void;
  /** File ID to share */
  fileId: string;
  /** File display name (for UI) */
  fileName: string;
  /** Current user ID */
  userId: string;
  /** Company ID */
  companyId?: string;
}

// ============================================================================
// EXPIRATION OPTIONS
// ============================================================================

const EXPIRATION_OPTIONS = [
  { value: '1', label: '1 ώρα' },
  { value: '24', label: '24 ώρες' },
  { value: '72', label: '3 ημέρες' },
  { value: '168', label: '1 εβδομάδα' },
  { value: '720', label: '30 ημέρες' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function ShareDialog({
  open,
  onOpenChange,
  fileId,
  fileName,
  userId,
  companyId,
}: ShareDialogProps) {
  const { t } = useTranslation('files');

  const [expiresInHours, setExpiresInHours] = useState('72');
  const [password, setPassword] = useState('');
  const [maxDownloads, setMaxDownloads] = useState('0');
  const [note, setNote] = useState('');
  const [creating, setCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const { copy, copied } = useCopyToClipboard();

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      const token = await FileShareService.createShare({
        fileId,
        createdBy: userId,
        expiresInHours: parseInt(expiresInHours, 10),
        password: password.trim() || undefined,
        maxDownloads: parseInt(maxDownloads, 10),
        note: note.trim() || undefined,
        companyId,
      });

      const url = `${window.location.origin}/shared/${token}`;
      setShareUrl(url);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to create share link', err);
    } finally {
      setCreating(false);
    }
  }, [fileId, userId, expiresInHours, password, maxDownloads, note, companyId]);

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return;
    await copy(shareUrl);
  }, [shareUrl, copy]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    // Reset state after close animation
    setTimeout(() => {
      setShareUrl(null);
      setPassword('');
      setNote('');
      setMaxDownloads('0');
    }, 200);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            {t('share.title', 'Κοινοποίηση αρχείου')}
          </DialogTitle>
          <DialogDescription className="truncate">
            {fileName}
          </DialogDescription>
        </DialogHeader>

        {!shareUrl ? (
          /* Create share form */
          <form
            onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
            className="space-y-4 py-2"
          >
            {/* Expiration */}
            <fieldset className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {t('share.expiration', 'Λήξη')}
              </label>
              <Select value={expiresInHours} onValueChange={setExpiresInHours}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </fieldset>

            {/* Password (optional) */}
            <fieldset className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                {t('share.password', 'Κωδικός')}
                <span className="text-xs text-muted-foreground font-normal">
                  ({t('share.optional', 'προαιρετικό')})
                </span>
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('share.passwordPlaceholder', 'Εισάγετε κωδικό...')}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </fieldset>

            {/* Max downloads */}
            <fieldset className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Download className="h-3.5 w-3.5 text-muted-foreground" />
                {t('share.maxDownloads', 'Μέγιστες λήψεις')}
              </label>
              <Select value={maxDownloads} onValueChange={setMaxDownloads}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{t('share.unlimited', 'Χωρίς όριο')}</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </fieldset>

            {/* Note */}
            <fieldset className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                {t('share.note', 'Σημείωση')}
                <span className="text-xs text-muted-foreground font-normal">
                  ({t('share.optional', 'προαιρετικό')})
                </span>
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('share.notePlaceholder', 'Μήνυμα για τον παραλήπτη...')}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </fieldset>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                {t('common.cancel', 'Ακύρωση')}
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? (
                  <Spinner size="small" color="inherit" className="mr-2" />
                ) : (
                  <Share2 className="h-4 w-4 mr-2" />
                )}
                {t('share.create', 'Δημιουργία συνδέσμου')}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          /* Share URL created */
          <section className="space-y-4 py-2">
            <p className="text-sm text-green-600 font-medium text-center">
              {t('share.created', 'Ο σύνδεσμος δημιουργήθηκε!')}
            </p>

            {/* URL display + copy */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-3 py-2 text-xs border rounded-md bg-muted truncate"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className={cn('flex-shrink-0', copied && 'text-green-600')}
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Info */}
            <footer className="text-xs text-muted-foreground space-y-1">
              <p className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Λήγει σε {EXPIRATION_OPTIONS.find(o => o.value === expiresInHours)?.label}
              </p>
              {password && (
                <p className="flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Προστατεύεται με κωδικό
                </p>
              )}
              {parseInt(maxDownloads, 10) > 0 && (
                <p className="flex items-center gap-1">
                  <Download className="h-3 w-3" />
                  Μέγιστες λήψεις: {maxDownloads}
                </p>
              )}
            </footer>

            <DialogFooter>
              <Button onClick={handleClose}>
                {t('common.close', 'Κλείσιμο')}
              </Button>
            </DialogFooter>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
