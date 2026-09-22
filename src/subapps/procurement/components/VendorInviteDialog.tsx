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
 *   - Batch send: createInvite() called for each checked vendor
 *
 * ADR-598 «(θ)» — `<form>` + SSoT `useFormSubmission`/`FormActions`. Αποστολή με `allSettled`:
 * όσοι παραλήπτες ΠΕΤΥΧΑΝ φεύγουν από την επιλογή, ώστε η επανάληψη να στείλει ΜΟΝΟ τις
 * αποτυχημένες (πριν: `Promise.all` + ένα γενικό toast ⇒ η επανάληψη ξανάστελνε και τις
 * επιτυχημένες = διπλές προσκλήσεις).
 * ⚠️ Ανοιχτό (ADR-598 «(θ)»): το θέμα/κείμενο ΔΕΝ περνά στο `CreateInviteInput` — ο server
 * στέλνει το δικό του πρότυπο· και τα προεπιλεγμένα κείμενα είναι ωμά ελληνικά.
 *
 * @module subapps/procurement/components/VendorInviteDialog
 * @see ADR-328 §5.Y Phase 12
 */

'use client';

import { useCallback, useId, useMemo, useState } from 'react';
import { EmailMessageFields } from './EmailMessageFields';
import { useTranslation, type Translate } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FormDialog } from '@/components/ui/form/FormDialog';
import { useFormSubmission } from '@/hooks/useFormSubmission';
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

/** Ένας παραλήπτης της παρτίδας — επαφή ή ad-hoc email. */
type Recipient = { readonly kind: 'contact'; readonly id: string } | { readonly kind: 'adhoc'; readonly email: string };

// ============================================================================
// PURE: αποστολή παρτίδας με μερική αποτυχία
// ============================================================================

function inviteInput(recipient: Recipient, expiresInDays: number): CreateInviteInput {
  return recipient.kind === 'contact'
    ? { vendorContactId: recipient.id, deliveryChannel: 'email', expiresInDays }
    : { manualEmail: recipient.email, manualName: recipient.email, deliveryChannel: 'email', expiresInDays };
}

/** Στέλνει σε όλους (`allSettled`) και επιστρέφει ΟΣΟΥΣ απέτυχαν. */
async function sendBatch(
  recipients: readonly Recipient[],
  expiresInDays: number,
  onCreate: VendorInviteDialogProps['onCreate'],
): Promise<Recipient[]> {
  const results = await Promise.allSettled(recipients.map((r) => onCreate(inviteInput(r, expiresInDays))));
  return recipients.filter((_, i) => results[i].status === 'rejected');
}

// ============================================================================
// FORM STATE + SUBMISSION
// ============================================================================

function useRecipients(vendorContacts: VendorContactOption[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [adHocList, setAdHocList] = useState<string[]>([]);

  const toggleId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** Επαφές χωρίς email παραλείπονται (όπως πριν). */
  const recipients = useMemo<Recipient[]>(() => [
    ...[...selectedIds].filter((id) => vendorContacts.find((c) => c.id === id)?.email).map((id) => ({ kind: 'contact' as const, id })),
    ...adHocList.map((email) => ({ kind: 'adhoc' as const, email })),
  ], [selectedIds, adHocList, vendorContacts]);

  /** Μένουν επιλεγμένοι ΜΟΝΟ όσοι απέτυχαν — η επανάληψη δεν ξαναστέλνει στους υπόλοιπους. */
  const keepOnly = useCallback((failed: readonly Recipient[]) => {
    setSelectedIds(new Set(failed.flatMap((r) => (r.kind === 'contact' ? [r.id] : []))));
    setAdHocList(failed.flatMap((r) => (r.kind === 'adhoc' ? [r.email] : [])));
  }, []);

  return { selectedIds, toggleId, adHocList, setAdHocList, totalCount: selectedIds.size + adHocList.length, recipients, keepOnly };
}

function useVendorInviteForm(props: VendorInviteDialogProps, t: Translate) {
  const { rfq, vendorContacts, onCreate, onAfterSend, onOpenChange } = props;
  const recipients = useRecipients(vendorContacts);
  const [deadlinePreset, setDeadlinePreset] = useState<DeadlinePreset>('5');
  const [subject, setSubject] = useState(DEFAULT_SUBJECT.replace('{{rfqTitle}}', rfq?.title ?? ''));
  const [body, setBody] = useState(DEFAULT_BODY.replace(/\{\{rfqTitle\}\}/g, rfq?.title ?? ''));
  const canSubmit = recipients.totalCount > 0 && subject.trim() !== '' && body.trim() !== '';

  const submission = useFormSubmission({
    canSubmit,
    submit: async () => {
      const batch = recipients.recipients;
      const failed = await sendBatch(batch, deadlinePreset !== 'custom' ? Number(deadlinePreset) : 7, onCreate);
      recipients.keepOnly(failed);
      if (failed.length < batch.length) await onAfterSend?.();
      if (failed.length > 0) throw new Error(t('rfqs.invite.errors.partialFailed', { failed: failed.length, total: batch.length }));
    },
    onSuccess: () => {
      toast.success(t('invites.button'));
      onOpenChange(false);
    },
    errorFallback: t('rfqs.invite.errors.sendFailed'),
  });

  return { ...recipients, deadlinePreset, setDeadlinePreset, subject, setSubject, body, setBody, canSubmit, submission };
}

function useAdHocEntry(list: string[], setList: (next: string[]) => void, t: Translate) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = useCallback(() => {
    const trimmed = email.trim();
    if (!EMAIL_REGEX.test(trimmed)) {
      setError(t('rfqs.invite.errors.invalidEmail'));
      return;
    }
    if (!list.includes(trimmed)) setList([...list, trimmed]);
    setEmail('');
    setError(null);
  }, [email, list, setList, t]);

  const remove = useCallback((target: string) => setList(list.filter((e) => e !== target)), [list, setList]);

  return { email, setEmail, error, add, remove };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function VendorInviteDialog(props: VendorInviteDialogProps) {
  const { rfq, open, onOpenChange } = props;
  const { t } = useTranslation('quotes');
  const idBase = useId(); // `${idBase}-<πεδίο>`: η <Label> ονομάζει το πεδίο (ADR-598 G11)
  const f = useVendorInviteForm(props, t);
  const adHoc = useAdHocEntry(f.adHocList, f.setAdHocList, t);
  const sending = f.submission.submitting;

  // Ο διάλογος ΔΕΝ κλείνει όσο στέλνει — το εγγυάται πλέον το SSoT `FormDialog`.
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('rfqs.invite.dialog.title', { rfqTitle: rfq?.title ?? '' })}
      contentClassName="max-w-2xl"
      formClassName="space-y-4"
      submission={f.submission}
      submitLabel={t('rfqs.invite.sendButton', { count: f.totalCount })}
      pendingLabel={t('rfqs.notify.send.sending')}
      cancelLabel={t('rfqs.invite.cancel')}
      submitDisabled={!f.canSubmit}
    >
      <VendorPicker {...props} selectedIds={f.selectedIds} onToggle={f.toggleId} t={t} />

      <AdHocSection
        email={adHoc.email}
        onEmailChange={adHoc.setEmail}
        onAdd={adHoc.add}
        list={f.adHocList}
        onRemove={adHoc.remove}
        error={adHoc.error}
        sending={sending}
        t={t}
      />
      <InviteMessage f={f} deadlineId={`${idBase}-deadline`} sending={sending} t={t} />
    </FormDialog>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function VendorPicker({ rfq, vendorContacts, contactsLoading, alreadyInvitedIds, onViewInvites, selectedIds, onToggle, t }: VendorInviteDialogProps & {
  selectedIds: Set<string>; onToggle: (id: string) => void; t: Translate;
}) {
  const { suggested, others } = useMemo(
    () => rankVendors((rfq as (typeof rfq & { category?: string | null }))?.category ?? null, vendorContacts, alreadyInvitedIds),
    [rfq, vendorContacts, alreadyInvitedIds],
  );
  return (
    <>
      <AlreadyInvitedBanner count={alreadyInvitedIds.size} onViewInvites={onViewInvites} t={t} />
      <ScrollArea className="max-h-64">
        {contactsLoading ? (
          <p className="text-sm text-muted-foreground py-2">{t('rfqs.loading')}</p>
        ) : (
          <div className="space-y-3">
            {suggested.length > 0 && <VendorGroup label={t('rfqs.invite.section.suggested')} vendors={suggested} selectedIds={selectedIds} onToggle={onToggle} />}
            {others.length > 0 && <VendorGroup label={t('rfqs.invite.section.allVendors')} vendors={others} selectedIds={selectedIds} onToggle={onToggle} />}
          </div>
        )}
      </ScrollArea>
    </>
  );
}

function InviteMessage({ f, deadlineId, sending, t }: {
  f: ReturnType<typeof useVendorInviteForm>; deadlineId: string; sending: boolean; t: Translate;
}) {
  return (
    <>
      <DeadlineField id={deadlineId} value={f.deadlinePreset} onChange={f.setDeadlinePreset} t={t} />
      <EmailMessageFields
        subjectLabel={t('rfqs.invite.subject.label')}
        bodyLabel={t('rfqs.invite.body.label')}
        subject={f.subject}
        body={f.body}
        onSubjectChange={f.setSubject}
        onBodyChange={f.setBody}
        bodyRows={5}
        disabled={sending}
      />
    </>
  );
}

function AlreadyInvitedBanner({ count, onViewInvites, t }: { count: number; onViewInvites?: () => void; t: Translate }) {
  if (count === 0) return null;
  return (
    <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
      <span>{t('rfqs.invite.alreadyInvited.banner', { count })}</span>
      {onViewInvites && (
        <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onViewInvites}>
          {t('rfqs.invite.alreadyInvited.action')}
        </Button>
      )}
    </p>
  );
}

function DeadlineField({ id, value, onChange, t }: { id: string; value: DeadlinePreset; onChange: (v: DeadlinePreset) => void; t: Translate }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">{t('rfqs.invite.deadline.label')}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as DeadlinePreset)}>
        <SelectTrigger id={id} className="w-48">
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
  );
}

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
  t: Translate;
}

function AdHocSection({ email, onEmailChange, onAdd, list, onRemove, error, sending, t }: AdHocSectionProps) {
  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="text-xs font-semibold text-muted-foreground">{t('rfqs.invite.section.adHoc')}</p>
      <div className="flex gap-2">
        <Input
          type="email"
          aria-label={t('rfqs.invite.section.adHoc')}
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder={t('rfqs.invite.adhocPlaceholder')}
          disabled={sending}
          className={error ? 'border-destructive' : ''}
          // Enter εδώ = «Προσθήκη» στη λίστα, ΟΧΙ αποστολή της φόρμας.
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAdd(); } }}
        />
        <Button type="button" variant="outline" size="sm" onClick={onAdd} disabled={sending || !email}>
          {t('rfqs.invite.addAdhocButton')}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      {list.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {list.map((e) => (
            <Badge key={e} variant="secondary" className="gap-1">
              {e}
              <button type="button" onClick={() => onRemove(e)} className="ml-1 rounded hover:text-destructive" aria-label={t('rfqs.invite.removeAdhoc', { email: e })}>
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
