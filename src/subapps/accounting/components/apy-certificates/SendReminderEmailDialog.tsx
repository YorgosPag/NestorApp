'use client';

/**
 * @fileoverview Send APY Reminder Email Dialog — Αποστολή Reminder Βεβαίωσης
 * @description Dialog για αποστολή reminder email στον πελάτη με PDF βεβαίωσης.
 *   Ίδιο pattern με SendInvoiceEmailDialog.tsx (ADR-ACC-019).
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-17
 * @see ADR-ACC-020 Βεβαίωση Παρακράτησης Φόρου
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mail, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import type { APYCertificate } from '../../types';
import {
  buildAPYEmailSubject,
  buildAPYEmailContent,
} from '../../services/email/apy-certificate-email-template';
import type { APYEmailLanguage } from '../../services/email/apy-certificate-email-template';

// ============================================================================
// TYPES
// ============================================================================

interface SendReminderEmailDialogProps {
  cert: APYCertificate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful send — use to refetch the certificate */
  onSent: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

type SendStatus = 'idle' | 'sending' | 'success' | 'error';

// ============================================================================
// COMPONENT
// ============================================================================

export function SendReminderEmailDialog({
  cert,
  open,
  onOpenChange,
  onSent,
}: SendReminderEmailDialogProps) {
  const { user } = useAuth();

  const [recipientEmail, setRecipientEmail] = useState('');
  const [language, setLanguage] = useState<APYEmailLanguage>('el');
  const [subject, setSubject] = useState('');
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  // Recompute subject when language changes
  useEffect(() => {
    setSubject(buildAPYEmailSubject(cert, language));
  }, [cert, language]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSendStatus('idle');
      setErrorMessage('');
      // Pre-fill from provider email (Γιώργος often sends to customer)
      setRecipientEmail('');
      setLanguage('el');
    }
  }, [open]);

  // Focus on open
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleSend = useCallback(async () => {
    if (!user) return;

    const trimmedEmail = recipientEmail.trim();
    if (!isValidEmail(trimmedEmail)) {
      setErrorMessage('Μη έγκυρη διεύθυνση email.');
      return;
    }

    setSendStatus('sending');
    setErrorMessage('');

    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/accounting/apy-certificates/${cert.certificateId}/send-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            recipientEmail: trimmedEmail,
            subject,
            language,
          }),
        }
      );

      const json = (await response.json()) as {
        success: boolean;
        error?: string;
      };

      if (!response.ok || !json.success) {
        setSendStatus('error');
        setErrorMessage(json.error ?? 'Αποτυχία αποστολής email.');
        return;
      }

      setSendStatus('success');
      onSent();
      setTimeout(() => onOpenChange(false), 2000);
    } catch (err) {
      setSendStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Αποτυχία αποστολής email.');
    }
  }, [user, recipientEmail, subject, language, cert.certificateId, onSent, onOpenChange]);

  const previewHtml = buildAPYEmailContent(cert, language);
  const emailValid = isValidEmail(recipientEmail.trim());
  const isSending = sendStatus === 'sending';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Αποστολή Reminder — Βεβαίωση {cert.fiscalYear}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Recipient */}
          <div className="space-y-1.5">
            <Label htmlFor="apy-reminder-to">Προς</Label>
            <Input
              id="apy-reminder-to"
              ref={inputRef}
              type="email"
              placeholder="email@example.com"
              value={recipientEmail}
              onChange={(e) => {
                setRecipientEmail(e.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              disabled={isSending}
              aria-invalid={recipientEmail.length > 0 && !emailValid}
            />
            <p className="text-xs text-gray-500">
              Πελάτης: <strong>{cert.customer.name}</strong> ({cert.customer.vatNumber})
            </p>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="apy-reminder-subject">Θέμα</Label>
            <Input
              id="apy-reminder-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isSending}
            />
          </div>

          {/* Language */}
          <div className="space-y-1.5">
            <Label htmlFor="apy-reminder-lang">Γλώσσα</Label>
            <Select
              value={language}
              onValueChange={(v) => setLanguage(v as APYEmailLanguage)}
              disabled={isSending}
            >
              <SelectTrigger id="apy-reminder-lang">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="el">Ελληνικά</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* PDF note */}
          <p className="text-xs text-gray-500">
            📎 Θα επισυναφθεί αυτόματα το PDF της βεβαίωσης.
          </p>

          {/* Preview */}
          <div className="space-y-1.5">
            <Label>Προεπισκόπηση</Label>
            <div
              className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm overflow-auto max-h-48"
              /* biome-ignore lint/security/noDangerouslySetInnerHtml: preview of server-generated HTML */
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>

          {/* Status */}
          {sendStatus === 'success' && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>Το email στάλθηκε στο {recipientEmail.trim()}.</span>
            </div>
          )}
          {sendStatus === 'error' && errorMessage && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Ακύρωση
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || !emailValid || sendStatus === 'success'}
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Αποστολή...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Αποστολή
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
