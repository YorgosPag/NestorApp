'use client';

/**
 * @fileoverview ADR-915 §27 — οι **φόρμες** της απόφασης ιδιοκτήτη και της ενημέρωσης επαγγελματία. Φορτώνονται με
 *   `next/dynamic` **μόνο όταν ανοίξει ο διάλογος** (`RegistryIssuanceDialogs.tsx`) — όριο της κλειστότητας του route slice
 *   (CHECK 3.34): οι λέξεις τους δεν βαραίνουν το πρώτο καρέ της σελίδας λήξεων.
 * @related RegistryIssuanceDialogs.tsx (το κέλυφος) · issuance-assignment-context.ts (οι ενέργειες)
 * @module components/document-registry/RegistryIssuanceDecisionForms
 *
 * 🔑 Radio, όχι Select, για 2–4 επιλογές (δόγμα `BrokeredMandateFields`): όλες ορατές, μέσα σε `<fieldset>/<legend>`.
 * 🔑 Ο υπεύθυνος που στέλνεται είναι **όποιον είδε** ο άνθρωπος (`leadId`) — ο διακομιστής τον ξανακρίνει (`lead-changed`).
 */

import React, { useId, useState } from 'react';

import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  INSTRUCTION_CHANNELS,
  ISSUANCE_NOTE_MAX,
  NOTICE_CHANNELS,
  type InstructionChannel,
  type RecordableNoticeChannel,
} from '@/lib/document-validity/issuance-assignment';
import { conveyanceToday } from '@/lib/conveyance/conveyance-calendar';
import { deliveryDueFromApproval, deliveryMissesSigning } from '@/lib/document-validity/issuance-delivery-due';
import { formatDate } from '@/lib/intl-formatting';
import { ChoiceField } from '@/components/document-registry/IssuanceChoiceField';
import { DELIVERY_KEYS } from '@/components/document-registry/issuance-delivery-labels';
import { useIssuanceAssignmentActions } from '@/components/document-registry/issuance-assignment-context';
import { issuanceTargetOf, type RegistryIssuanceView } from '@/components/document-registry/registry-issuance';
import { REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import {
  CHANNEL_KEYS,
  DECISION_KEYS,
  ISSUANCE_KEYS,
  NOTICE_KEYS,
  PROPOSE_KEYS,
} from '@/components/document-registry/issuance-labels';

const OUTCOMES = ['approved', 'rejected'] as const;
type Outcome = (typeof OUTCOMES)[number];

export interface IssuanceFormProps {
  readonly view: RegistryIssuanceView;
  readonly close: () => void;
}

export interface DecisionFormProps extends IssuanceFormProps {
  readonly professionalName: string;
  readonly leadId: string;
  /** §42 — η αναθεώρηση της προσφοράς που **βλέπει** ο άνθρωπος· ο μειωτής αρνείται απόφαση για άλλη. */
  readonly quoteRevision: number;
}

/**
 * §45 Φ2 — **τι εγκρίνεται**: πρόσωπο + τιμή + **χρόνος**. «Παράδοση σε N εργάσιμες — έως <ημ.>, αν εγκριθεί σήμερα»,
 * και 🏆 Α4: αν αυτή η ημέρα πέφτει μετά την υπογραφή, το λέει **πριν** δεσμευτεί κανείς. Ίδιος κριτής με το κελί.
 */
function ApprovalDeliveryNotice({ view }: { readonly view: IssuanceFormProps['view'] }): React.ReactElement | null {
  const { t } = useTranslation([REGISTRY_NS]);
  const quote = view.state.kind === 'open' ? view.state.record.quote : null;
  if (quote === null || quote.deliveryBusinessDays === null) return null;
  const dueOn = deliveryDueFromApproval(conveyanceToday(), quote);
  if (dueOn === null) return null;
  return (
    <section className="flex flex-col gap-1" aria-live="polite">
      <p className="m-0 text-sm text-foreground">
        {t(DELIVERY_KEYS.ifApprovedToday, { count: quote.deliveryBusinessDays, date: formatDate(dueOn) })}
      </p>
      {deliveryMissesSigning(dueOn, view.signingDay) && view.signingDay !== null ? (
        <p role="alert" className="m-0 text-sm text-destructive">
          {t(DELIVERY_KEYS.missesSigning, { due: formatDate(dueOn), signing: formatDate(view.signingDay) })}
        </p>
      ) : null}
    </section>
  );
}

export function DecisionForm({ view, close, professionalName, leadId, quoteRevision }: DecisionFormProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const actions = useIssuanceAssignmentActions();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [channel, setChannel] = useState<InstructionChannel | null>(null);
  const [note, setNote] = useState('');
  const noteId = useId();
  const submit = () => {
    if (actions === null || outcome === null || channel === null) return;
    close();
    actions.act({ action: 'decide', ...issuanceTargetOf(view), outcome, channel, note: note.trim() || null, expectedOwnerContactId: leadId, quoteRevision });
  };
  return (
    <>
      <ApprovalDeliveryNotice view={view} />
      <ChoiceField
        legend={t(DECISION_KEYS.outcomeLegend)} options={OUTCOMES} value={outcome} onChange={setOutcome}
        labelOf={(option) => (option === 'approved' ? t(DECISION_KEYS.approved, { name: professionalName }) : t(DECISION_KEYS.rejected))}
      />
      <ChoiceField
        legend={t(DECISION_KEYS.channelLegend)} options={INSTRUCTION_CHANNELS} value={channel} onChange={setChannel}
        labelOf={(option) => t(CHANNEL_KEYS[option])}
      />
      <Label htmlFor={noteId} className="text-sm font-medium">{t(DECISION_KEYS.noteLabel)}</Label>
      <Textarea id={noteId} value={note} maxLength={ISSUANCE_NOTE_MAX} onChange={(event) => setNote(event.target.value)} />
      <DialogActionFooter
        cancelLabel={t(PROPOSE_KEYS.cancel)} confirmLabel={t(DECISION_KEYS.submit)} busyLabel={t(ISSUANCE_KEYS.saving)}
        onCancel={close} onConfirm={submit} isSubmitting={false} canSubmit={outcome !== null && channel !== null}
      />
    </>
  );
}

export function NoticeForm({ view, close }: IssuanceFormProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const actions = useIssuanceAssignmentActions();
  const [channel, setChannel] = useState<RecordableNoticeChannel | null>(null);
  const submit = () => {
    if (actions === null || channel === null) return;
    close();
    actions.act({ action: 'notify', ...issuanceTargetOf(view), channel });
  };
  return (
    <>
      <ChoiceField
        legend={t(NOTICE_KEYS.channelLegend)} options={NOTICE_CHANNELS} value={channel} onChange={setChannel}
        labelOf={(option) => t(CHANNEL_KEYS[option])}
      />
      <DialogActionFooter
        cancelLabel={t(PROPOSE_KEYS.cancel)} confirmLabel={t(NOTICE_KEYS.submit)} busyLabel={t(ISSUANCE_KEYS.saving)}
        onCancel={close} onConfirm={submit} isSubmitting={false} canSubmit={channel !== null}
      />
    </>
  );
}
