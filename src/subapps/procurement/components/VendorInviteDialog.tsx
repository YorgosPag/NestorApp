/**
 * =============================================================================
 * VendorInviteDialog — Multi-select invite flow (§5.Y, Phase 12)
 * =============================================================================
 *
 * Supports:
 *   - Suggested vendors (category-based) + all vendors (checkboxes)
 *   - Ad-hoc email field (one-off invites)
 *   - Deadline quick presets (3/5/7/14d or custom date)
 *   - Single shared message template with inline subject+body edit
 *   - Batch send: createInvite() called sequentially for each checked vendor
 *
 * @module subapps/procurement/components/VendorInviteDialog
 * @see ADR-328 §5.Y Phase 12
 */

'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import type { CreateInviteInput, CreateInviteOutput, VendorContactOption } from '../hooks/useVendorInvites';
import { rankVendors } from '../utils/vendor-suggestions';
import type { RFQ } from '../types/rfq';

// ============================================================================
// TYPES
// ============================================================================

export interface VendorInviteDialogProps {
  rfqId: string;
  rfq: RFQ | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorContacts: VendorContactOption[];
  contactsLoading: boolean;
  alreadyInvitedIds: Set<string>;
  onCreate: (dto: CreateInviteInput) => Promise<CreateInviteOutput>;
  onAfterSend?: () => Promise<void>;
  onViewInvites?: () => void;
}

type DeadlinePreset = '3' | '5' | '7' | '14' | 'custom';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEFAULT_SUBJECT = 'Πρόσκληση για προσφορά: {{rfqTitle}}';
const DEFAULT_BODY = `Αγαπητέ {{vendorName}},\n\nΣας προσκαλούμε να υποβάλετε προσφορά για το αίτημα «{{rfqTitle}}».\n\nΠροθεσμία απάντησης: {{deadline}}.\n\nΜε εκτίμηση,\n{{senderName}}`;

// ============================================================================
// COMPONENT
// ============================================================================

export function VendorInviteDialog({
  rfqId,
  rfq,
  open,
  onOpenChange,
  vendorContacts,
  contactsLoading,
  alreadyInvitedIds,
  onCreate,
  onAfterSend,
  onViewInvites,
}: VendorInviteDialogProps) {
  const { t } = useTranslation('quotes');

  const { suggested, others } = useMemo(
    () => rankVendors(rfq?.category ?? null, vendorContacts, alreadyInvitedIds),
    [rfq, vendorContacts, alreadyInvitedIds],
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [adHocEmail, setAdHocEmail] = useState('');
  const [adHocList, setAdHocList] = useState<string[]>([]);
  const [adHocError, setAdHocError] = useState<string | null>(null);
  const [deadlinePreset, setDeadlinePreset] = useState<DeadlinePreset>('5');
  const [subject, setSubject] = useState(DEFAULT_SUBJECT.replace('{{rfqTitle}}', rfq?.title ?? ''));
  const [body, setBody] = useState(DEFAULT_BODY.replace(/\{\{rfqTitle\}\}/g, rfq?.title ?? ''));
  const [sending, setSending] = useState(false);

  const toggleId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleAddAdHoc = useCallback(() => {
    const email = adHocEmail.trim();
    if (!EMAIL_REGEX.test(email)) {
      setAdHocError(t('rfqs.invite.errors.invalidEmail'));
      return;
    }
    if (!adHocList.includes(email)) {
      setAdHocList((prev) => [...prev, email]);
    }
    setAdHocEmail('');
    setAdHocError(null);
  }, [adHocEmail, adHocList, t]);

  const removeAdHoc = useCallback((email: string) => {
    setAdHocList((prev) => prev.filter((e) => e !== email));
  }, []);

  const totalCount = selectedIds.size + adHocList.length;

  const handleSend = useCallback(async () => {
    setSending(true);
    try {
      const deadlineDays = deadlinePreset !== 'custom' ? Number(deadlinePreset) : 7;
      const sendContact = async (contactId: string) => {
        const contact = vendorContacts.find((c) => c.id === contactId);
        if (!contact?.email) return;
        await onCreate({ vendorContactId: contactId, deliveryChannel: 'email', expiresInDays: deadlineDays });
      };
      const sendAdHoc = async (email: string) => {
        await onCreate({ manualEmail: email, manualName: email, deliveryChannel: 'email', expiresInDays: deadlineDays });
      };

      await Promise.all([
        ...[...selectedIds].map(sendContact),
        ...adHocList.map(sendAdHoc),
      ]);

      await onAfterSend?.();
      toast.success(t('invites.button'));
      onOpenChange(false);
    } catch {
      toast.error(t('quotes.errors.updateFailed'));
    } finally {
      setSending(false);
    }
  }, [selectedIds, adHocList, deadlinePreset, vendorContacts, onCreate, onAfterSend, onOpenChange, t]);

  const handleClose = useCallback(() => {
    if (!sending) onOpenChange(false);
  }, [sending, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('rfqs.invite.dialog.title', { rfqTitle: rfq?.title ?? '' })}</DialogTitle>
        </DialogHeader>

        {alreadyInvitedIds.size > 0 && (
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            <span>{t('rfqs.invite.alreadyInvited.banner', { count: alreadyInvitedIds.size })}</span>
            {onViewInvites && (
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onViewInvites}>
                {t('rfqs.invite.alreadyInvited.action')}
              </Button>
            )}
          </div>
        )}

        <ScrollArea className="max-h-64">
          {contactsLoading ? (
            <p className="text-sm text-muted-foreground py-2">{t('rfqs.loading')}</p>
          ) : (
            <div className="space-y-3">
              {suggested.length > 0 && (
                <VendorGroup
                  label={t('rfqs.invite.section.suggested')}
                  vendors={suggested}
                  selectedIds={selectedIds}
                  onToggle={toggleId}
                />
              )}
              {others.length > 0 && (
                <VendorGroup
                  label={t('rfqs.invite.section.allVendors')}
                  vendors={others}
                  selectedIds={selectedIds}
                  onToggle={toggleId}
                />
              )}
            </div>
          )}
        </ScrollArea>

        <AdHocSection
          email={adHocEmail}
          onEmailChange={setAdHocEmail}
          onAdd={handleAddAdHoc}
          list={adHocList}
          onRemove={removeAdHoc}
          error={adHocError}
          sending={sending}
          t={t}
        />

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">{t('rfqs.invite.deadline.label')}</Label>
          <Select value={deadlinePreset} onValueChange={(v) => setDeadlinePreset(v as DeadlinePreset)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['3', '5', '7', '14'] as const).map((d) => (
                <SelectItem key={d} value={d}>{t(`rfqs.invite.deadline.preset.${d}d`)}</SelectItem>
              ))}
              <SelectItem value="custom">{t('rfqs.invite.deadline.preset.custom')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('rfqs.invite.subject.label')}</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={sending} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('rfqs.invite.body.label')}</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              disabled={sending}
              className="font-mono text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={sending}>
            {t('rfqs.invite.cancel')}
          </Button>
          <Button onClick={handleSend} disabled={totalCount === 0 || sending || !subject.trim() || !body.trim()}>
            {sending
              ? t('rfqs.notify.send.sending')
              : t('rfqs.invite.sendButton', { count: totalCount })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface VendorGroupProps {
  label: string;
  vendors: VendorContactOption[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}

function VendorGroup({ label, vendors, selectedIds, onToggle }: VendorGroupProps) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-1">{label}</p>
      <ul className="space-y-1">
        {vendors.map((v) => (
          <li key={v.id} className="flex items-center gap-2 rounded px-1 py-1 hover:bg-muted/50">
            <Checkbox
              id={`inv-${v.id}`}
              checked={selectedIds.has(v.id)}
              onCheckedChange={() => onToggle(v.id)}
            />
            <label htmlFor={`inv-${v.id}`} className="flex-1 cursor-pointer">
              <span className="text-sm">{v.displayName}</span>
              {v.email && <span className="ml-2 text-xs text-muted-foreground">{v.email}</span>}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface AdHocSectionProps {
  email: string;
  onEmailChange: (e: string) => void;
  onAdd: () => void;
  list: string[];
  onRemove: (e: string) => void;
  error: string | null;
  sending: boolean;
  t: (key: string) => string;
}

function AdHocSection({ email, onEmailChange, onAdd, list, onRemove, error, sending, t }: AdHocSectionProps) {
  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="text-xs font-semibold text-muted-foreground">{t('rfqs.invite.section.adHoc')}</p>
      <div className="flex gap-2">
        <Input
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder={t('rfqs.invite.adhocPlaceholder')}
          disabled={sending}
          className={error ? 'border-destructive' : ''}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAdd(); } }}
        />
        <Button type="button" variant="outline" size="sm" onClick={onAdd} disabled={sending || !email}>
          {t('rfqs.invite.addAdhocButton')}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {list.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {list.map((e) => (
            <Badge key={e} variant="secondary" className="gap-1">
              {e}
              <button
                type="button"
                onClick={() => onRemove(e)}
                className="ml-1 rounded hover:text-destructive"
                aria-label={`Remove ${e}`}
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
