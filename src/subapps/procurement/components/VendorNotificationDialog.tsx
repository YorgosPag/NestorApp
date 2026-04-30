'use client';

/**
 * Post-award vendor notification dialog (§5.V).
 * Shows all non-superseded quotes for the RFQ. Per-row: checkbox, template tag,
 * last-sent timestamp, inline subject+body editor, per-row send status.
 * Sends via POST /api/quotes/{id}/notify-vendor.
 *
 * @module subapps/procurement/components/VendorNotificationDialog
 * @see ADR-328 §5.V Phase 12
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import type { Quote } from '@/subapps/procurement/types/quote';
import { formatDate } from '@/lib/intl-formatting';
import type { RFQ } from '@/subapps/procurement/types/rfq';
import {
  buildDefaultTemplate,
  type NotificationTemplate,
} from '@/subapps/procurement/templates/vendorNotificationDefaults';

// ============================================================================
// TYPES
// ============================================================================

type SendStatus = 'idle' | 'sending' | 'sent' | 'failed';

interface VendorRow {
  quote: Quote;
  template: NotificationTemplate;
  email: string;
  vendorName: string;
  subject: string;
  body: string;
  checked: boolean;
  status: SendStatus;
  error: string | null;
  lastSentAt: Date | null;
}

export interface VendorNotificationDialogProps {
  open: boolean;
  rfq: RFQ | null;
  quotes: Quote[];
  senderName: string;
  companyName: string;
  onOpenChange: (open: boolean) => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function detectTemplate(quote: Quote): NotificationTemplate {
  return quote.status === 'accepted' ? 'winner' : 'rejection';
}

function resolveVendorEmail(quote: Quote): string {
  return quote.extractedData?.vendorEmails?.value?.[0] ?? '';
}

function resolveVendorName(quote: Quote): string {
  return quote.extractedData?.vendorName?.value ?? quote.vendorContactId ?? '—';
}

function tsToDate(ts: { seconds?: number; _seconds?: number } | null | undefined): Date | null {
  const secs = ts?.seconds ?? ts?._seconds;
  return secs != null ? new Date(secs * 1000) : null;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function VendorNotificationDialog({
  open,
  rfq,
  quotes,
  senderName,
  companyName,
  onOpenChange,
}: VendorNotificationDialogProps) {
  const { t } = useTranslation('quotes');

  const [rows, setRows] = useState<VendorRow[]>([]);

  useEffect(() => {
    if (!open) return;
    const now = new Date().toLocaleDateString('el-GR');
    const rfqTitle = rfq?.title ?? '';
    const rfqNumber = rfq?.displayNumber ?? '';

    const initial: VendorRow[] = quotes
      .filter((q) => q.status !== 'superseded' && (q.status === 'accepted' || q.status === 'rejected'))
      .map((q) => {
        const tmpl = detectTemplate(q);
        const email = resolveVendorEmail(q);
        const vendorName = resolveVendorName(q);
        const lastSentAt = tsToDate(q.lastNotifiedAt as Parameters<typeof tsToDate>[0]);
        const placeholders = { rfqTitle, rfqNumber, vendorName, quoteNumber: q.displayNumber, senderName, companyName, date: now };
        const content = buildDefaultTemplate(tmpl, placeholders);
        return {
          quote: q,
          template: tmpl,
          email,
          vendorName,
          subject: content.subject,
          body: content.body,
          checked: !lastSentAt,
          status: 'idle' as SendStatus,
          error: null,
          lastSentAt,
        };
      });

    setRows(initial);
  }, [open, quotes, rfq, senderName, companyName]);

  const checkedCount = rows.filter((r) => r.checked && r.status === 'idle').length;
  const anySending = rows.some((r) => r.status === 'sending');

  const updateRow = useCallback((quoteId: string, patch: Partial<VendorRow>) => {
    setRows((prev) => prev.map((r) => (r.quote.id === quoteId ? { ...r, ...patch } : r)));
  }, []);

  const handleSend = useCallback(async () => {
    const toSend = rows.filter((r) => r.checked && r.status === 'idle');
    for (const row of toSend) {
      updateRow(row.quote.id, { status: 'sending' });
      try {
        const res = await fetch(`/api/quotes/${row.quote.id}/notify-vendor`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vendorEmail: row.email,
            template: row.template,
            subject: row.subject,
            body: row.body,
            rfqId: rfq?.id ?? '',
            customized: row.subject !== buildDefaultTemplate(row.template, {}).subject,
          }),
        });
        if (!res.ok) {
          const json = await res.json() as { error?: string };
          updateRow(row.quote.id, { status: 'failed', error: json.error ?? `HTTP ${res.status}` });
        } else {
          updateRow(row.quote.id, { status: 'sent', lastSentAt: new Date() });
        }
      } catch (e) {
        updateRow(row.quote.id, { status: 'failed', error: e instanceof Error ? e.message : 'Error' });
      }
    }
  }, [rows, rfq, updateRow]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('rfqs.notify.dialog.title')}</DialogTitle>
          <DialogDescription>{t('rfqs.notify.dialog.subtitle')}</DialogDescription>
        </DialogHeader>

        <ul className="space-y-2">
          {rows.map((row) => (
            <VendorNotificationRow
              key={row.quote.id}
              row={row}
              onCheckedChange={(checked) => updateRow(row.quote.id, { checked })}
              onSubjectChange={(subject) => updateRow(row.quote.id, { subject })}
              onBodyChange={(body) => updateRow(row.quote.id, { body })}
            />
          ))}
          {rows.length === 0 && (
            <li className="text-sm text-muted-foreground py-4 text-center">
              {t('rfqs.noQuotes')}
            </li>
          )}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={anySending}>
            {t('rfqs.notify.dialog.cancel')}
          </Button>
          <Button onClick={handleSend} disabled={checkedCount === 0 || anySending}>
            {anySending
              ? t('rfqs.notify.send.sending')
              : t('rfqs.notify.send.button', { count: checkedCount })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// ROW SUB-COMPONENT
// ============================================================================

interface VendorNotificationRowProps {
  row: VendorRow;
  onCheckedChange: (checked: boolean) => void;
  onSubjectChange: (s: string) => void;
  onBodyChange: (b: string) => void;
}

function VendorNotificationRow({
  row,
  onCheckedChange,
  onSubjectChange,
  onBodyChange,
}: VendorNotificationRowProps) {
  const { t } = useTranslation('quotes');
  const [editorOpen, setEditorOpen] = useState(false);

  const templateLabel = row.template === 'winner'
    ? t('rfqs.notify.template.winner')
    : t('rfqs.notify.template.rejection');

  const templateVariant = row.template === 'winner' ? 'success' : 'destructive';

  const statusLabel =
    row.status === 'sent' ? t('rfqs.notify.status.sent')
    : row.status === 'sending' ? t('rfqs.notify.status.sending')
    : row.status === 'failed' ? t('rfqs.notify.status.failed')
    : null;

  const lastSentLabel = row.lastSentAt
    ? t('rfqs.notify.lastSent.at', { date: formatDate(row.lastSentAt, { day: '2-digit', month: '2-digit' }) })
    : t('rfqs.notify.lastSent.never');

  return (
    <li className="rounded-md border p-3 space-y-2">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={row.checked}
          onCheckedChange={(v) => onCheckedChange(Boolean(v))}
          disabled={row.status === 'sending' || row.status === 'sent'}
          id={`notify-${row.quote.id}`}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={`notify-${row.quote.id}`} className="text-sm font-medium cursor-pointer">
              {row.vendorName}
            </label>
            <Badge variant={templateVariant}>{templateLabel}</Badge>
            {statusLabel && (
              <Badge variant={row.status === 'sent' ? 'success' : row.status === 'failed' ? 'destructive' : 'secondary'}>
                {statusLabel}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{row.email || '—'}</p>
          <p className="text-xs text-muted-foreground">{lastSentLabel}</p>
          {row.error && <p className="text-xs text-destructive mt-1">{row.error}</p>}
        </div>
        <Collapsible open={editorOpen} onOpenChange={setEditorOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
              {t('rfqs.notify.dialog.editMessage')}
              <ChevronDown className={`ml-1 h-3 w-3 transition-transform ${editorOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">{t('rfqs.notify.subject.label')}</Label>
                <Input
                  value={row.subject}
                  onChange={(e) => onSubjectChange(e.target.value)}
                  disabled={row.status === 'sending' || row.status === 'sent'}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('rfqs.notify.body.label')}</Label>
                <Textarea
                  value={row.body}
                  onChange={(e) => onBodyChange(e.target.value)}
                  rows={6}
                  disabled={row.status === 'sending' || row.status === 'sent'}
                  className="font-mono text-xs resize-none"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </li>
  );
}
