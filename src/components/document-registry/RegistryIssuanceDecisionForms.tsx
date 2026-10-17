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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  INSTRUCTION_CHANNELS,
  ISSUANCE_NOTE_MAX,
  NOTICE_CHANNELS,
  type InstructionChannel,
  type NoticeChannel,
} from '@/lib/document-validity/issuance-assignment';
import { isOneOf } from '@/lib/type-guards';
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

interface ChoiceFieldProps<V extends string> {
  readonly legend: string;
  readonly options: readonly V[];
  readonly value: V | null;
  readonly onChange: (value: V) => void;
  readonly labelOf: (value: V) => string;
}

/** Μία επιλογή από λίγες, όλες ορατές, μέσα σε `<fieldset>/<legend>` — κανάλι · απόφαση. */
function ChoiceField<V extends string>({ legend, options, value, onChange, labelOf }: ChoiceFieldProps<V>): React.ReactElement {
  const legendId = useId();
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" aria-labelledby={legendId}>
      <legend id={legendId} className="mb-1 text-sm font-medium text-foreground">{legend}</legend>
      <RadioGroup value={value ?? ''} onValueChange={(next) => { if (isOneOf(options, next)) onChange(next); }}>
        {options.map((option) => (
          <Label key={option} className="flex items-center gap-2 text-sm font-normal">
            <RadioGroupItem value={option} />
            <span>{labelOf(option)}</span>
          </Label>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

const OUTCOMES = ['approved', 'rejected'] as const;
type Outcome = (typeof OUTCOMES)[number];

export interface IssuanceFormProps {
  readonly view: RegistryIssuanceView;
  readonly close: () => void;
}

export function DecisionForm({ view, close, professionalName, leadId }: IssuanceFormProps & { readonly professionalName: string; readonly leadId: string }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const actions = useIssuanceAssignmentActions();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [channel, setChannel] = useState<InstructionChannel | null>(null);
  const [note, setNote] = useState('');
  const noteId = useId();
  const submit = () => {
    if (actions === null || outcome === null || channel === null) return;
    close();
    actions.act({ action: 'decide', ...issuanceTargetOf(view), outcome, channel, note: note.trim() || null, expectedOwnerContactId: leadId });
  };
  return (
    <>
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
  const [channel, setChannel] = useState<NoticeChannel | null>(null);
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
