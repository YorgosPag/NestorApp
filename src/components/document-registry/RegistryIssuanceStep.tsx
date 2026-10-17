'use client';

/**
 * @fileoverview ADR-915 §27 — **«Ανάθεση σε επαγγελματία»** μέσα στη μπάρα «Επόμενο βήμα»: ποιος προτάθηκε, τι
 *   αποφάσισε ο ιδιοκτήτης, **σε ποιον είναι η μπάλα**, και η **μία** επόμενη ενέργεια κάθε σταδίου.
 * @related registry-issuance.ts (η κρίση) · RegistryIssuanceDialogs.tsx ·
 *   RegistryNextStep.tsx (ο γονέας)
 * @module components/document-registry/RegistryIssuanceStep
 *
 * 🔑 **«Ανατέθηκε» ΜΟΝΟ με απόφαση ιδιοκτήτη**: το στάδιο `proposed` λέει «αναμένει απόφαση ιδιοκτήτη», ποτέ «ανατέθηκε».
 * 🔑 **Ball in court** (Procore) ως **λέξη**, όχι χρώμα: «Σειρά έχει: ο ιδιοκτήτης <όνομα>».
 * 🔑 **Το προσόν λέγεται «δηλωμένο»**, και για άδεια μητρώου δίνεται ο σύνδεσμος ελέγχου (buildingcert.gr) — ποτέ
 *    υπαινιγμός ότι η εφαρμογή το επαλήθευσε.
 * 🔑 Χωρίς δικαίωμα (`canAct: false`) η γραμμή λέει την κατάσταση **χωρίς** κουμπιά (εργονομία, όχι ασφάλεια — ADR-801).
 */

import React from 'react';
import { ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ISSUER_QUALIFICATION_SPECS } from '@/config/document-validity/document-issuers';
import { PROFESSIONAL_LICENCE_SPECS } from '@/config/professional-licences';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import type {
  IssuanceApprovalRequest,
  IssuanceAssignmentRecord,
  IssuanceDecision,
  IssuanceDelivery,
  IssuanceNotice,
  IssuanceResponse,
  IssuanceStage,
} from '@/lib/document-validity/issuance-assignment';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import { useIssuanceAssignmentActions } from '@/components/document-registry/issuance-assignment-context';
import { issuanceTargetOf, type RegistryIssuanceView } from '@/components/document-registry/registry-issuance';
import { registryPersonOf } from '@/components/document-registry/registry-obligors';
import { ObligorPerson } from '@/components/document-registry/RegistryObligorPeople';
import {
  IssuanceCancelDialog,
  IssuanceDecisionDialog,
  IssuanceNoticeDialog,
  IssuanceProposeDialog,
  IssuanceSendDialog,
} from '@/components/document-registry/RegistryIssuanceDialogs';
import { ISSUER_KEYS, NEXT_STEP_KEYS, PROPERTY_MARKET_NS, qualificationText, REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import {
  BALL_IN_COURT_KEYS,
  CHANNEL_KEYS,
  ISSUANCE_KEYS,
  ISSUANCE_STAGE_KEYS,
  LINK_HISTORY_KEYS,
} from '@/components/document-registry/issuance-labels';

type Names = Pick<DocumentRegistryResponse, 'people'>;
type Translate = ReturnType<typeof useTranslation>['t'];
type OpenState = Extract<RegistryIssuanceView['state'], { kind: 'open' }>;

/** Το όνομα μιας επαφής για **φράση** (διάλογοι) — ποτέ κενό. */
function nameOf(t: Translate, contactId: string, registry: Names): string {
  const person = registryPersonOf(contactId, registry);
  if (!person.reachable) return t(ISSUER_KEYS.obligorUnavailable);
  return person.name ?? t(ISSUER_KEYS.obligorUnnamed);
}

/** Τα ονόματα των υποψηφίων — **μόνο** όσοι είναι ακόμη επαφές του μισθωτή (ξένη ≡ ανύπαρκτη). */
function candidateNames(t: Translate, view: RegistryIssuanceView, registry: Names): Record<string, string> {
  return Object.fromEntries(view.candidates
    .filter((candidate) => registryPersonOf(candidate.contactId, registry).reachable)
    .map((candidate) => [candidate.contactId, nameOf(t, candidate.contactId, registry)] as const));
}

function CredentialLine({ record }: { readonly record: IssuanceAssignmentRecord }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, PROPERTY_MARKET_NS]);
  const { qualification, registryNumber } = record.credential;
  const spec = ISSUER_QUALIFICATION_SPECS[qualification];
  const label = qualificationText(t, qualification);
  return (
    <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
      <span>{registryNumber === null ? t(ISSUANCE_KEYS.credential, { qualification: label }) : t(ISSUANCE_KEYS.credentialWithNumber, { qualification: label, number: registryNumber })}</span>
      {spec.kind === 'licence' ? (
        <a href={PROFESSIONAL_LICENCE_SPECS[spec.licence].registryLookupUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
          {t(ISSUANCE_KEYS.verifyRegistry)}<ExternalLink className="size-3" aria-hidden="true" />
          <span className="sr-only">{t(NEXT_STEP_KEYS.opensInNewTab)}</span>
        </a>
      ) : null}
    </span>
  );
}

/** «Σειρά έχει: ο ιδιοκτήτης Χ» — ο υπεύθυνος ονομάζεται όταν η μπάλα είναι στον ιδιοκτήτη. */
function BallInCourtLine({ state, view, registry }: { readonly state: OpenState; readonly view: RegistryIssuanceView; readonly registry: Names }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const leadId = view.lead?.kind === 'designated' ? view.lead.contactId : null;
  const who = state.ballInCourt === 'professional' ? state.record.professionalContactId : state.ballInCourt === 'owner' ? leadId : null;
  return (
    <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-sm text-foreground">
      <span>{t(ISSUANCE_KEYS.ballInCourt, { party: t(BALL_IN_COURT_KEYS[state.ballInCourt]) })}</span>
      {who === null ? null : <ObligorPerson person={registryPersonOf(who, registry)} />}
    </p>
  );
}

/** «Δεν έφυγε» — μόνο όταν **ξέρουμε** ότι ο πάροχος δεν το δέχτηκε· `null` (δεν κρίθηκε) δεν λέει τίποτα. */
function notDelivered(delivery: IssuanceDelivery | null): boolean {
  return delivery !== null && delivery.recipient !== 'accepted';
}

function informedCount(delivery: IssuanceDelivery | null): number {
  return delivery === null ? 0 : Object.values(delivery.coOwners).filter((outcome) => outcome === 'accepted').length;
}

/** §28 — το αίτημα έγκρισης με σύνδεσμο: σε ποιον, πότε, ποιοι ενημερώθηκαν, και αν **δεν** έφυγε. */
function requestLines(t: Translate, request: IssuanceApprovalRequest, registry: Names): React.ReactNode[] {
  const count = informedCount(request.delivery);
  return [
    <li key="request">{t(LINK_HISTORY_KEYS.requestedApproval, { name: nameOf(t, request.ownerContactId, registry), date: formatDate(request.at) })}</li>,
    count > 0 ? <li key="informed">{t(LINK_HISTORY_KEYS.informed, { count: String(count) })}</li> : null,
    notDelivered(request.delivery) ? <li key="request-failed" className="text-destructive">{t(LINK_HISTORY_KEYS.notDelivered)}</li> : null,
  ];
}

function decisionLine(t: Translate, decision: IssuanceDecision, registry: Names): React.ReactNode {
  const name = nameOf(t, decision.ownerContactId, registry);
  return decision.basis === 'owner-link-approval'
    ? <li>{t(LINK_HISTORY_KEYS.decidedByLink, { name, date: formatDate(decision.at) })}</li>
    : <li>{t(ISSUANCE_KEYS.decided, { name, channel: t(CHANNEL_KEYS[decision.channel]), date: formatDate(decision.at) })}</li>;
}

function noticeLines(t: Translate, notice: IssuanceNotice): React.ReactNode[] {
  const line = notice.invitationId === null
    ? t(ISSUANCE_KEYS.noticed, { channel: t(CHANNEL_KEYS[notice.channel]), date: formatDate(notice.at) })
    : t(LINK_HISTORY_KEYS.noticedByLink, { date: formatDate(notice.at) });
  return [
    <li key="notice">{line}</li>,
    notDelivered(notice.delivery) ? <li key="notice-failed" className="text-destructive">{t(LINK_HISTORY_KEYS.notDelivered)}</li> : null,
  ];
}

/** Μόνο η απάντηση **με σύνδεσμο** γράφει γραμμή — η καταγραφή του γραφείου φαίνεται ήδη στο στάδιο. */
function responseLines(t: Translate, response: IssuanceResponse): React.ReactNode[] {
  if (response.basis !== 'professional-link') return [];
  const date = formatDate(response.at);
  return [
    <li key="response">{response.outcome === 'accepted' ? t(LINK_HISTORY_KEYS.acceptedByLink, { date }) : t(LINK_HISTORY_KEYS.declinedByLink, { date })}</li>,
    response.note === null ? null : <li key="response-note">{t(LINK_HISTORY_KEYS.responseNote, { note: response.note })}</li>,
  ];
}

/** Τι έγινε ως τώρα — πρόταση · αίτημα · απόφαση · ενημέρωση · απάντηση, με ημερομηνία, κανάλι και βάση. */
function HistoryLines({ record, registry }: { readonly record: IssuanceAssignmentRecord; readonly registry: Names }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const { approvalRequest, decision, notice, response } = record;
  return (
    <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-xs text-muted-foreground">
      <li>{t(ISSUANCE_KEYS.proposedOn, { date: formatDate(record.proposedAt) })}</li>
      {approvalRequest === null ? null : requestLines(t, approvalRequest, registry)}
      {decision === null ? null : decisionLine(t, decision, registry)}
      {notice === null ? null : noticeLines(t, notice)}
      {response === null ? null : responseLines(t, response)}
    </ul>
  );
}

interface ActionsProps {
  readonly view: RegistryIssuanceView;
  readonly stage: IssuanceStage;
  readonly record: IssuanceAssignmentRecord;
  readonly registry: Names;
}

/** Η **μία** επόμενη ενέργεια κάθε σταδίου (+ ακύρωση). Κανένα κουμπί για πράξη που ο μειωτής θα αρνιόταν. */
function StageActions({ view, stage, record, registry }: ActionsProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const actions = useIssuanceAssignmentActions();
  const professionalName = nameOf(t, record.professionalContactId, registry);
  const lead = view.lead?.kind === 'designated' ? { contactId: view.lead.contactId, name: nameOf(t, view.lead.contactId, registry) } : null;
  const respond = (outcome: 'accepted' | 'declined') => actions?.act({ action: 'respond', ...issuanceTargetOf(view), outcome });
  return (
    <div className="flex flex-wrap gap-2">
      {stage === 'proposed' && lead !== null ? (
        <IssuanceSendDialog view={view} audience="owner" recipientName={lead.name} leadId={lead.contactId} resend={record.approvalRequest !== null} />
      ) : null}
      {stage === 'proposed' ? <IssuanceDecisionDialog view={view} professionalName={professionalName} lead={lead} /> : null}
      {stage === 'ownerApproved' || (stage === 'sent' && (record.notice?.invitationId ?? null) !== null) ? (
        <IssuanceSendDialog view={view} audience="professional" recipientName={professionalName} leadId={null} resend={stage === 'sent'} />
      ) : null}
      {stage === 'ownerApproved' ? <IssuanceNoticeDialog view={view} professionalName={professionalName} /> : null}
      {stage === 'sent' ? (
        <>
          <Button type="button" size="sm" variant="outline" onClick={() => respond('accepted')}>{t(ISSUANCE_KEYS.accepted)}</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => respond('declined')}>{t(ISSUANCE_KEYS.declined)}</Button>
        </>
      ) : null}
      {stage === 'proposed' || stage === 'declined' ? (
        <IssuanceProposeDialog view={view} names={candidateNames(t, view, registry)} trigger="proposeOther" />
      ) : null}
      <IssuanceCancelDialog view={view} />
    </div>
  );
}

function OpenAssignment({ view, state, registry }: { readonly view: RegistryIssuanceView; readonly state: OpenState; readonly registry: Names }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const actions = useIssuanceAssignmentActions();
  const saving = actions?.pending.has(view.key) ?? false;
  return (
    <section aria-label={t(ISSUANCE_KEYS.heading)} className="flex flex-col gap-1.5 rounded-md border border-border p-3">
      <p className="m-0 text-sm font-medium text-foreground">{t(ISSUANCE_STAGE_KEYS[state.stage])}</p>
      <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-sm text-foreground">
        <span className="text-muted-foreground">{t(ISSUANCE_KEYS.professional)}</span>
        <ObligorPerson person={registryPersonOf(state.record.professionalContactId, registry)} />
      </p>
      <CredentialLine record={state.record} />
      <BallInCourtLine state={state} view={view} registry={registry} />
      <HistoryLines record={state.record} registry={registry} />
      {saving ? <span role="status" className="text-xs text-muted-foreground">{t(ISSUANCE_KEYS.saving)}</span> : null}
      {actions?.canAct && !saving ? <StageActions view={view} stage={state.stage} record={state.record} registry={registry} /> : null}
    </section>
  );
}

/** Καμία ενεργή ανάθεση: «Ανάθεση σε επαγγελματία» — και, αν υπήρξε, τι έγινε με την προηγούμενη. */
function NoAssignment({ view, registry }: { readonly view: RegistryIssuanceView; readonly registry: Names }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const actions = useIssuanceAssignmentActions();
  const last = view.state.kind === 'none' ? view.state : null;
  const lastName = last?.last === null || last === null ? null : nameOf(t, last.last.professionalContactId, registry);
  return (
    <>
      {actions?.canAct ? <IssuanceProposeDialog view={view} names={candidateNames(t, view, registry)} trigger="assign" /> : null}
      <p className="m-0 text-xs text-muted-foreground">{t(ISSUANCE_KEYS.assignHint)}</p>
      {lastName === null ? null : (
        <p className="m-0 text-xs text-muted-foreground">{t(last?.fulfilled ? ISSUANCE_KEYS.lastFulfilled : ISSUANCE_KEYS.lastClosed, { name: lastName })}</p>
      )}
    </>
  );
}

export interface RegistryIssuanceStepProps {
  readonly view: RegistryIssuanceView | 'unavailable';
  readonly registry: Names;
}

export function RegistryIssuanceStep({ view, registry }: RegistryIssuanceStepProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  if (view === 'unavailable') {
    return <li><p className="m-0 text-xs text-muted-foreground">{t(ISSUANCE_KEYS.unavailable)}</p></li>;
  }
  return (
    <li className="flex flex-col gap-1">
      {view.state.kind === 'open'
        ? <OpenAssignment view={view} state={view.state} registry={registry} />
        : <NoAssignment view={view} registry={registry} />}
    </li>
  );
}
