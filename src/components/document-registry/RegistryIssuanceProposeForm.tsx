'use client';

/**
 * @fileoverview ADR-915 §27 — η **φόρμα** της «Ανάθεσης σε επαγγελματία»: το γραφείο ΠΡΟΤΕΙΝΕΙ — πρώτα όσους ήδη ξέρει,
 *   με το **γιατί**, ή οποιαδήποτε επαφή του, με δηλωμένο προσόν που **επιτρέπει ο νόμος** για αυτό το έγγραφο.
 *   Φορτώνεται με `next/dynamic` όταν ανοίξει ο διάλογος (όριο του route slice, CHECK 3.34).
 * @related lib/document-validity/issuance-assignment.ts (`rankIssuanceCandidates` · `qualifiesFor`) ·
 *   RegistryIssuanceDialogs.tsx (το κέλυφος) · components/contacts/relationships/ContactSearchManager.tsx (η αναζήτηση)
 * @module components/document-registry/RegistryIssuanceProposeForm
 *
 * 🏆 **Πέρα από Thumbtack «hire again» / Procore «Use Previous Bidders»**: ο πρώτος προτεινόμενος είναι όποιος βγάζει
 *    **το άλλο έγγραφο του ίδιου ακινήτου** (ένας μηχανικός για ΠΕΑ + ταυτότητα), και κάθε υποψήφιος λέει γιατί.
 * 🔑 **Προσόν ≠ επάγγελμα** (§18 Ε1): οι επιλογές είναι **μόνο** τα προσόντα του εκδότη — ο μηχανολόγος δεν εμφανίζεται
 *    για την ταυτότητα κτιρίου. Το προσόν είναι **δηλωμένο** από το γραφείο, και η φόρμα το λέει.
 * 🔑 **Η πρόταση δεν στέλνεται σε κανέναν** — περιμένει απόφαση του ιδιοκτήτη (ο νόμος: τον ορίζει ο ιδιοκτήτης).
 */

import dynamic from 'next/dynamic';
import React, { useId, useState } from 'react';

import type { ContactSummary } from '@/components/ui/enterprise-contact-dropdown';
import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ISSUER_QUALIFICATION_SPECS, type IssuerQualification } from '@/config/document-validity/document-issuers';
import { documentKindSpec, type DocumentKind } from '@/config/document-validity/document-validity';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { conveyanceToday } from '@/lib/conveyance/conveyance-calendar';
import {
  REGISTRY_NUMBER_MAX,
  type CandidateReason,
  type IssuanceCandidate,
} from '@/lib/document-validity/issuance-assignment';
import { formatDateKey } from '@/lib/intl-formatting';
import { isOneOf } from '@/lib/type-guards';
import { useIssuanceAssignmentActions } from '@/components/document-registry/issuance-assignment-context';
import { issuanceTargetOf, type RegistryIssuanceView } from '@/components/document-registry/registry-issuance';
import { qualificationText } from '@/components/document-registry/RegistryIssuerValue';
import {
  CONVEYANCE_NS,
  DOCUMENT_KIND_LABEL_KEYS,
  LEGALITY_NS,
  PROPERTY_MARKET_NS,
  REGISTRY_NS,
} from '@/components/document-registry/document-registry-labels';
import { ISSUANCE_KEYS, PROPOSE_KEYS } from '@/components/document-registry/issuance-labels';

type Translate = ReturnType<typeof useTranslation>['t'];

/**
 * Η αναζήτηση επαφής φέρνει όλη την υπηρεσία επαφών — **μόνο** όταν επιλεγεί «Άλλη επαφή». Το `next/dynamic` είναι και το
 * ΟΡΙΟ της κλειστότητας του route slice (CHECK 3.34): χωρίς αυτό η σελίδα λήξεων θα κουβαλούσε τις επαφές στο πρώτο καρέ.
 */
const ContactSearchManager = dynamic(
  () => import('@/components/contacts/relationships/ContactSearchManager').then((mod) => mod.ContactSearchManager),
  { ssr: false },
);

/** Η τιμή του «Άλλη επαφή» στο radio — καμία επαφή δεν μοιάζει με αυτήν (`cont_*`). */
const OTHER = 'other';

function qualificationsOf(kind: DocumentKind): readonly IssuerQualification[] {
  const { issuer } = documentKindSpec(kind);
  return issuer.kind === 'professional' ? issuer.qualifications : [];
}

function reasonText(t: Translate, reason: CandidateReason): string {
  if (reason.kind === 'same-property') return t(PROPOSE_KEYS.sameProperty, { document: t(DOCUMENT_KIND_LABEL_KEYS[reason.documentKind]) });
  return t(PROPOSE_KEYS.previously, { count: reason.count, date: formatDateKey(conveyanceToday(new Date(reason.lastAt))) });
}

interface CandidateListProps {
  readonly candidates: readonly IssuanceCandidate[];
  readonly names: Readonly<Record<string, string>>;
  readonly selected: string;
  readonly onSelect: (value: string) => void;
}

function CandidateList({ candidates, names, selected, onSelect }: CandidateListProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const legendId = useId();
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" aria-labelledby={legendId}>
      <legend id={legendId} className="mb-1 text-sm font-medium text-foreground">{t(PROPOSE_KEYS.knownLegend)}</legend>
      {candidates.length === 0 ? <p className="m-0 text-xs text-muted-foreground">{t(PROPOSE_KEYS.noKnown)}</p> : null}
      <RadioGroup value={selected} onValueChange={onSelect}>
        {candidates.map((candidate) => (
          <Label key={candidate.contactId} className="flex items-start gap-2 text-sm font-normal">
            <RadioGroupItem value={candidate.contactId} />
            <span className="flex flex-col">
              <span>{names[candidate.contactId]}</span>
              {candidate.reasons.map((reason) => (
                <span key={reason.kind} className="text-xs text-muted-foreground">{reasonText(t, reason)}</span>
              ))}
            </span>
          </Label>
        ))}
        <Label className="flex items-center gap-2 text-sm font-normal">
          <RadioGroupItem value={OTHER} /><span>{t(PROPOSE_KEYS.otherContact)}</span>
        </Label>
      </RadioGroup>
    </fieldset>
  );
}

interface CredentialFieldsProps {
  readonly kind: DocumentKind;
  readonly qualification: IssuerQualification | null;
  readonly onQualification: (value: IssuerQualification) => void;
  readonly registryNumber: string;
  readonly onRegistryNumber: (value: string) => void;
}

function CredentialFields({ kind, qualification, onQualification, registryNumber, onRegistryNumber }: CredentialFieldsProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, PROPERTY_MARKET_NS]);
  const options = qualificationsOf(kind);
  const numberId = useId();
  const needsNumber = qualification !== null && ISSUER_QUALIFICATION_SPECS[qualification].kind === 'licence';
  return (
    <>
      <Label className="text-sm font-medium">{t(PROPOSE_KEYS.qualificationLabel)}</Label>
      <Select value={qualification ?? undefined} onValueChange={(next) => { if (isOneOf(options, next)) onQualification(next); }}>
        <SelectTrigger aria-label={t(PROPOSE_KEYS.qualificationLabel)}>
          <SelectValue placeholder={t(PROPOSE_KEYS.qualificationPlaceholder)} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => <SelectItem key={option} value={option}>{qualificationText(t, option)}</SelectItem>)}
        </SelectContent>
      </Select>
      {needsNumber ? (
        <>
          <Label htmlFor={numberId} className="text-sm font-medium">{t(PROPOSE_KEYS.registryNumberLabel)}</Label>
          <Input id={numberId} value={registryNumber} maxLength={REGISTRY_NUMBER_MAX} onChange={(event) => onRegistryNumber(event.target.value)} />
        </>
      ) : null}
      <p className="m-0 text-xs text-muted-foreground">{t(PROPOSE_KEYS.declared)}</p>
    </>
  );
}

interface ProposeFormProps {
  readonly view: RegistryIssuanceView;
  readonly names: Readonly<Record<string, string>>;
  readonly close: () => void;
}

/** Η αρχική τιμή: ο πρώτος γνωστός (με το προσόν του, αν επαρκεί) ή «Άλλη επαφή»· ένα μόνο νόμιμο προσόν ⇒ ήδη επιλεγμένο. */
function useProposeState(view: RegistryIssuanceView) {
  const first = view.candidates[0];
  const only = qualificationsOf(view.kind).length === 1 ? qualificationsOf(view.kind)[0] : null;
  const [selected, setSelected] = useState<string>(first?.contactId ?? OTHER);
  const [other, setOther] = useState<ContactSummary | null>(null);
  const [qualification, setQualification] = useState<IssuerQualification | null>(first?.credential?.qualification ?? only);
  const [registryNumber, setRegistryNumber] = useState(first?.credential?.registryNumber ?? '');
  const choose = (value: string) => {
    setSelected(value);
    const credential = view.candidates.find((candidate) => candidate.contactId === value)?.credential ?? null;
    setQualification(credential?.qualification ?? only);
    setRegistryNumber(credential?.registryNumber ?? '');
  };
  const contactId = selected === OTHER ? other?.id ?? null : selected;
  return { selected, choose, setOther, qualification, setQualification, registryNumber, setRegistryNumber, contactId };
}

export function ProposeForm({ view, names, close }: ProposeFormProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const actions = useIssuanceAssignmentActions();
  const state = useProposeState(view);
  const ready = state.contactId !== null && state.qualification !== null;
  const submit = () => {
    if (actions === null || state.contactId === null || state.qualification === null) return;
    close();
    actions.act({
      action: 'propose', ...issuanceTargetOf(view), professionalContactId: state.contactId,
      qualification: state.qualification, registryNumber: state.registryNumber.trim() || null,
    });
  };
  return (
    <>
      <CandidateList candidates={view.candidates} names={names} selected={state.selected} onSelect={state.choose} />
      {state.selected === OTHER ? (
        <ContactSearchManager selectedContactId="" onContactSelect={state.setOther} placeholder={t(PROPOSE_KEYS.searchPlaceholder)} label="" />
      ) : null}
      <CredentialFields
        kind={view.kind} qualification={state.qualification} onQualification={state.setQualification}
        registryNumber={state.registryNumber} onRegistryNumber={state.setRegistryNumber}
      />
      <DialogActionFooter
        cancelLabel={t(PROPOSE_KEYS.cancel)} confirmLabel={t(PROPOSE_KEYS.submit)} busyLabel={t(ISSUANCE_KEYS.saving)}
        onCancel={close} onConfirm={submit} isSubmitting={false} canSubmit={ready}
      />
    </>
  );
}
