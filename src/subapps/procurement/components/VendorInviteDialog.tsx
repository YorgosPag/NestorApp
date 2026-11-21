/**
 * =============================================================================
 * VendorInviteDialog — Multi-select invite flow (§5.Y, Phase 12 · ADR-327 §7.5)
 * =============================================================================
 *
 * Supports:
 *   - Suggested vendors (category-based) + all vendors (checkboxes)
 *   - Ad-hoc email field (one-off invites) με **προαιρετικό όνομα** (Ε3 — ποτέ το email ως όνομα)
 *   - Λήξη συνδέσμου = πάντα **ημερομηνία** (συντομεύσεις ή ημερολόγιο, `VendorInviteExpiryField`, Ε1β)
 *   - Προσωπικό σημείωμα (`PersonalMessageField`) πάνω στο **πρότυπο συστήματος** (Ε1)
 *   - Προεπισκόπηση «ως <παραλήπτης>» από τον server — αυτό ακριβώς θα σταλεί (`VendorInvitePreview`)
 *   - Batch send: createInvite() called for each checked vendor
 *
 * ADR-598 «(θ)» — `<form>` + SSoT `useFormSubmission`/`FormActions`. Αποστολή με `allSettled`:
 * όσοι παραλήπτες ΠΕΤΥΧΑΝ φεύγουν από την επιλογή, ώστε η επανάληψη να στείλει ΜΟΝΟ τις
 * αποτυχημένες (πριν: `Promise.all` + ένα γενικό toast ⇒ η επανάληψη ξανάστελνε και τις
 * επιτυχημένες = διπλές προσκλήσεις).
 * ✅ Κλειστό (ADR-327 §7.5 · ADR-598 «(θ)»): το θέμα/κείμενο ήταν **διακοσμητικός** editor με ωμά ελληνικά, που
 * δεν έφευγε ποτέ. Πλέον το μήνυμα είναι το πρότυπο του server στη γλώσσα του παραλήπτη + το σημείωμα του αγοραστή.
 * Κάθε άνοιγμα = νέα φόρμα (κλειδί γενιάς): η αρχική κατάσταση διαβάζει το RFQ **τη στιγμή που ανοίγει**.
 *
 * @module subapps/procurement/components/VendorInviteDialog
 * @see ADR-327 §7.5 · ADR-598 «(θ)»
 */

'use client';

import { useCallback, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { useTranslation, type Translate } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FormDialog } from '@/components/ui/form/FormDialog';
import { PersonalMessageField } from '@/components/sharing/fields/PersonalMessageField';
import { useFormSubmission } from '@/hooks/useFormSubmission';
import { normalizeToMillisOrNull } from '@/lib/date-local';
import { isValidEmail } from '@/lib/validation/email-validation';
import { toast } from 'sonner';
import type { CreateInviteInput, CreateInviteOutput, VendorContactOption } from '../hooks/useVendorInvites';
import { initialInviteExpiryDay } from '../config/vendor-invite-policy';
import { rankVendors } from '../utils/vendor-suggestions';
import type { RFQ } from '../types/rfq';
import { VendorInviteExpiryField } from './VendorInviteExpiryField';
import { VendorInvitePreview, type VendorInvitePreviewOption } from './VendorInvitePreview';

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

/** Ένας ad-hoc παραλήπτης — το όνομα είναι προαιρετικό (Ε3). */
interface AdHocRecipient {
  readonly email: string;
  readonly name: string | null;
}

/** Ένας παραλήπτης της παρτίδας — επαφή ή ad-hoc email. */
type Recipient = { readonly kind: 'contact'; readonly id: string } | ({ readonly kind: 'adhoc' } & AdHocRecipient);

/** Ό,τι κοινό έχουν όλες οι προσκλήσεις της παρτίδας. */
interface InviteMessage {
  readonly expiresOn: string;
  readonly buyerNote: string;
}

// ============================================================================
// PURE: αποστολή παρτίδας με μερική αποτυχία
// ============================================================================

function inviteInput(recipient: Recipient, message: InviteMessage): CreateInviteInput {
  const shared = { deliveryChannel: 'email' as const, expiresOn: message.expiresOn, buyerNote: message.buyerNote };
  return recipient.kind === 'contact'
    ? { ...shared, vendorContactId: recipient.id }
    : { ...shared, manualEmail: recipient.email, ...(recipient.name ? { manualName: recipient.name } : {}) };
}

/** Στέλνει σε όλους (`allSettled`) και επιστρέφει ΟΣΟΥΣ απέτυχαν. */
async function sendBatch(
  recipients: readonly Recipient[],
  message: InviteMessage,
  onCreate: VendorInviteDialogProps['onCreate'],
): Promise<Recipient[]> {
  const results = await Promise.allSettled(recipients.map((r) => onCreate(inviteInput(r, message))));
  return recipients.filter((_, i) => results[i].status === 'rejected');
}

/** Οι επιλογές της προεπισκόπησης — ένας ανά παραλήπτη, με το όνομα που θα δει ο αγοραστής. */
function previewOptions(recipients: readonly Recipient[], vendorContacts: readonly VendorContactOption[]): VendorInvitePreviewOption[] {
  return recipients.map((r) => (r.kind === 'contact'
    ? { key: `contact:${r.id}`, label: vendorContacts.find((c) => c.id === r.id)?.displayName ?? r.id, recipient: { vendorContactId: r.id } }
    : { key: `adhoc:${r.email}`, label: r.name ?? r.email, recipient: { manualEmail: r.email, ...(r.name ? { manualName: r.name } : {}) } }));
}

// ============================================================================
// FORM STATE + SUBMISSION
// ============================================================================

function useRecipients(vendorContacts: VendorContactOption[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [adHocList, setAdHocList] = useState<AdHocRecipient[]>([]);

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
    ...adHocList.map((entry) => ({ kind: 'adhoc' as const, ...entry })),
  ], [selectedIds, adHocList, vendorContacts]);

  /** Μένουν επιλεγμένοι ΜΟΝΟ όσοι απέτυχαν — η επανάληψη δεν ξαναστέλνει στους υπόλοιπους. */
  const keepOnly = useCallback((failed: readonly Recipient[]) => {
    setSelectedIds(new Set(failed.flatMap((r) => (r.kind === 'contact' ? [r.id] : []))));
    setAdHocList(failed.flatMap((r) => (r.kind === 'adhoc' ? [{ email: r.email, name: r.name }] : [])));
  }, []);

  return { selectedIds, toggleId, adHocList, setAdHocList, totalCount: selectedIds.size + adHocList.length, recipients, keepOnly };
}

function useVendorInviteForm(props: VendorInviteDialogProps, t: Translate) {
  const { rfq, vendorContacts, onCreate, onAfterSend, onOpenChange } = props;
  const recipients = useRecipients(vendorContacts);
  const rfqDeadlineMs = normalizeToMillisOrNull(rfq?.deadlineDate ?? null);
  const [expiresOn, setExpiresOn] = useState(() => initialInviteExpiryDay(rfqDeadlineMs, new Date()));
  const [buyerNote, setBuyerNote] = useState('');
  const canSubmit = recipients.totalCount > 0;

  const submission = useFormSubmission({
    canSubmit,
    submit: async () => {
      const batch = recipients.recipients;
      const failed = await sendBatch(batch, { expiresOn, buyerNote }, onCreate);
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

  return { ...recipients, rfqDeadlineMs, expiresOn, setExpiresOn, buyerNote, setBuyerNote, canSubmit, submission };
}

function useAdHocEntry(list: AdHocRecipient[], setList: (next: AdHocRecipient[]) => void, t: Translate) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = useCallback(() => {
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setError(t('rfqs.invite.errors.invalidEmail'));
      return;
    }
    if (!list.some((entry) => entry.email === trimmed)) setList([...list, { email: trimmed, name: name.trim() || null }]);
    setEmail('');
    setName('');
    setError(null);
  }, [email, name, list, setList, t]);

  const remove = useCallback((target: string) => setList(list.filter((entry) => entry.email !== target)), [list, setList]);

  return { email, setEmail, name, setName, error, add, remove };
}

// ============================================================================
// COMPONENT
// ============================================================================

/** Κάθε άνοιγμα = νέα φόρμα: ό,τι έμεινε από την προηγούμενη φορά δεν ξαναεμφανίζεται (πρότυπο `NewVersionDialog`). */
export function VendorInviteDialog(props: VendorInviteDialogProps) {
  const [lastOpen, setLastOpen] = useState(props.open);
  const [generation, setGeneration] = useState(0);
  if (props.open !== lastOpen) {
    setLastOpen(props.open);
    if (props.open) setGeneration((n) => n + 1);
  }
  return <VendorInviteForm key={generation} {...props} />;
}

function VendorInviteForm(props: VendorInviteDialogProps) {
  const { rfqId, rfq, open, onOpenChange, vendorContacts } = props;
  const { t, currentLanguage } = useTranslation('quotes');
  const idBase = useId(); // `${idBase}-<πεδίο>`: η <Label> ονομάζει το πεδίο (ADR-598 G11)
  const f = useVendorInviteForm(props, t);
  const adHoc = useAdHocEntry(f.adHocList, f.setAdHocList, t);
  const sending = f.submission.submitting;
  const options = useMemo(() => previewOptions(f.recipients, vendorContacts), [f.recipients, vendorContacts]);

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
      <AdHocSection entry={adHoc} list={f.adHocList} sending={sending} t={t} />
      <VendorInviteExpiryField
        id={`${idBase}-deadline`}
        value={f.expiresOn}
        onChange={f.setExpiresOn}
        rfqDeadlineMs={f.rfqDeadlineMs}
        disabled={sending}
        language={currentLanguage}
        t={t}
      />
      <PersonalMessageField value={f.buyerNote} onChange={f.setBuyerNote} disabled={sending} />
      <VendorInvitePreview rfqId={rfqId} options={options} expiresOn={f.expiresOn} buyerNote={f.buyerNote} t={t} />
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
  entry: ReturnType<typeof useAdHocEntry>;
  list: readonly AdHocRecipient[];
  sending: boolean;
  t: Translate;
}

/** Enter σε οποιοδήποτε πεδίο εδώ = «Προσθήκη» στη λίστα, ΟΧΙ αποστολή της φόρμας. */
const addOnEnter = (onAdd: () => void) => (e: KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter') { e.preventDefault(); onAdd(); }
};

function AdHocSection({ entry, list, sending, t }: AdHocSectionProps) {
  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="text-xs font-semibold text-muted-foreground">{t('rfqs.invite.section.adHoc')}</p>
      <div className="flex flex-wrap gap-2">
        <Input
          type="email"
          aria-label={t('rfqs.invite.section.adHoc')}
          value={entry.email}
          onChange={(e) => entry.setEmail(e.target.value)}
          placeholder={t('rfqs.invite.adhocPlaceholder')}
          disabled={sending}
          className={`min-w-48 flex-1 ${entry.error ? 'border-destructive' : ''}`}
          onKeyDown={addOnEnter(entry.add)}
        />
        <Input
          aria-label={t('rfqs.invite.adhocNameLabel')}
          value={entry.name}
          onChange={(e) => entry.setName(e.target.value)}
          placeholder={t('rfqs.invite.adhocNamePlaceholder')}
          disabled={sending}
          className="min-w-40 flex-1"
          onKeyDown={addOnEnter(entry.add)}
        />
        <Button type="button" variant="outline" size="sm" onClick={entry.add} disabled={sending || !entry.email}>
          {t('rfqs.invite.addAdhocButton')}
        </Button>
      </div>
      {entry.error && <p className="text-xs text-destructive" role="alert">{entry.error}</p>}
      {list.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {list.map((r) => (
            <li key={r.email}>
              <Badge variant="secondary" className="gap-1">
                {r.name ? `${r.name} · ${r.email}` : r.email}
                <button type="button" onClick={() => entry.remove(r.email)} className="ml-1 rounded hover:text-destructive" aria-label={t('rfqs.invite.removeAdhoc', { email: r.email })}>
                  ×
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
