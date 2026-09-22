'use client';

/**
 * Email composer for quote renewal requests.
 * Pre-fills subject + body from ADR-328 §5.BB.6 template.
 * Caller provides onSend(to, subject, body) — actual transport is outside scope.
 */

import { useId, useState } from 'react';
import { EmailMessageFields } from './EmailMessageFields';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface QuoteRenewalRequestDialogProps {
  open: boolean;
  vendorEmail: string;
  vendorName: string;
  rfqTitle: string;
  quoteNumber: string;
  validUntilDate: string;
  total: string;
  senderName: string;
  onSend: (to: string, subject: string, body: string) => Promise<void>;
  onCancel: () => void;
}

export function QuoteRenewalRequestDialog({
  open,
  vendorEmail,
  vendorName,
  rfqTitle,
  quoteNumber,
  validUntilDate,
  total,
  senderName,
  onSend,
  onCancel,
}: QuoteRenewalRequestDialogProps) {
  const { t } = useTranslation('quotes');
  const idBase = useId(); // `${idBase}-<πεδίο>`: η <Label> ονομάζει το πεδίο (ADR-598 G11)

  const defaultSubject = t('rfqs.expiry.renewal.subjectDefault', { rfqTitle });
  const defaultBody = t('rfqs.expiry.renewal.bodyDefault', {
    vendorName,
    quoteNumber,
    originalValidUntil: validUntilDate,
    total,
    senderName,
  });

  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      await onSend(vendorEmail, subject, body);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('rfqs.expiry.renewal.dialogTitle')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor={`${idBase}-to`} className="text-xs text-muted-foreground">{t('rfqs.expiry.renewal.toLabel')}</Label>
            <Input id={`${idBase}-to`} value={vendorEmail} readOnly className="bg-muted text-muted-foreground" />
          </div>
          <EmailMessageFields
            subjectLabel={t('rfqs.expiry.renewal.subjectLabel')}
            bodyLabel={t('rfqs.expiry.renewal.bodyLabel')}
            subject={subject}
            body={body}
            onSubjectChange={setSubject}
            onBodyChange={setBody}
            bodyRows={9}
            disabled={sending}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={sending}>
            {t('rfqs.expiry.renewal.cancelButton')}
          </Button>
          <Button onClick={handleSend} disabled={sending || !subject.trim() || !body.trim()}>
            {sending
              ? t('rfqs.expiry.renewal.sendingButton')
              : t('rfqs.expiry.renewal.sendButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
