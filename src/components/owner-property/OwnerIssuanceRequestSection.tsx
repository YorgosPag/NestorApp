'use client';

/**
 * @fileoverview ADR-945 §7.6 — **«Εκδόσεις εγγράφων» στην καρτέλα ακινήτου του ιδιώτη**: ζήτα προσφορές από έως 3
 *   επαγγελματίες του `/pro`, δες τα στάδιά τους, διάλεξε μία.
 * @related OwnerIssuanceBidList.tsx (οι κάρτες) · hooks/document-registry/useIssuanceRequest.ts ·
 *   hooks/document-registry/useIssuanceRequestAction.ts · lib/document-validity/issuance-request-view-model.ts ·
 *   components/mandate/agency-directory-route.ts (`documentIssuerSearchHref` — ο ΕΝΑΣ δημιουργός του `/pro`)
 * @module components/owner-property/OwnerIssuanceRequestSection
 *
 * 🏆 Thumbtack «Projects» / Block: **ένας** πίνακας για όλα τα αιτήματα του ακινήτου, όχι μία σελίδα ανά είδος. Μία
 *    γραμμή ανά είδος που εκδίδει επαγγελματίας (`ISSUANCE_REQUEST_KINDS`, από τον κατάλογο): χωρίς αίτημα ⇒ μία γραμμή
 *    με «Βρες επαγγελματία»· με αίτημα ⇒ οι προσφορές του.
 * 🔑 **ΟΧΙ αισιόδοξα**, με **επιβεβαίωση** στις δύο πράξεις που κλείνουν προσφορές (επιλογή · ακύρωση) — ο άνθρωπος βλέπει
 *    τι θα συμβεί **πριν** συμβεί (Thumbtack «Hire»: οι άλλοι ενημερώνονται ότι δεν επιλέχθηκαν).
 * 🔑 `canAct === false` ⇒ **μόνο ανάγνωση**, με το λόγο γραμμένο. Ξένο · αποσυρμένο ⇒ ο διακομιστής αρνείται ⇒ σιωπή.
 * ⛔ Η ενότητα στήνεται **μόνο** με ανοιχτό `OWNER_ISSUANCE_REQUESTS` (ο φρουρός ζει στον καλούντα, πριν από κάθε κλήση).
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DOCUMENT_KIND_LABEL_KEYS } from '@/components/document-registry/document-registry-labels';
import { documentIssuerSearchHref } from '@/components/mandate/agency-directory-route';
import type { DocumentKind } from '@/config/document-validity/document-validity';
import { useIssuanceRequest } from '@/hooks/document-registry/useIssuanceRequest';
import { issuanceActionKeyOf, useIssuanceRequestAction, type IssuanceRequestActionApi } from '@/hooks/document-registry/useIssuanceRequestAction';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ISSUANCE_REQUEST_POLICY } from '@/lib/document-validity/issuance-bidding';
import type { IssuanceBiddingResponse, IssuanceBidView, IssuanceRequestBody } from '@/lib/document-validity/issuance-bidding-request';
import {
  ISSUANCE_REQUEST_KINDS,
  canCancelRequest,
  canInviteMore,
  expectedCycleOf,
  expectedStagesOf,
  requestPhaseOf,
} from '@/lib/document-validity/issuance-request-view-model';
import { Link } from '@/lib/workspace/navigation';
import { OwnerIssuanceBidList } from './OwnerIssuanceBidList';
import {
  OWNER_ISSUANCE_CONFIRM_KEYS,
  OWNER_ISSUANCE_ERROR_KEYS,
  OWNER_ISSUANCE_KEYS,
  OWNER_ISSUANCE_NAMESPACES,
} from './owner-issuance-labels';

type Pending = { readonly kind: 'award'; readonly body: IssuanceRequestBody } | { readonly kind: 'cancel'; readonly body: IssuanceRequestBody } | null;

interface KindTarget {
  readonly propertyId: string;
  readonly documentKind: DocumentKind;
}

function awardBodyOf(target: KindTarget, response: IssuanceBiddingResponse, bid: IssuanceBidView): IssuanceRequestBody | null {
  const cycle = expectedCycleOf(response);
  const revision = bid.record?.quote?.revision ?? null;
  if (cycle === null || revision === null) return null;
  return { action: 'award', ...target, bidId: bid.bidId, expectedCycle: cycle, quoteRevision: revision, expectedStages: expectedStagesOf(response) };
}

function cancelBodyOf(target: KindTarget, response: IssuanceBiddingResponse): IssuanceRequestBody | null {
  const cycle = expectedCycleOf(response);
  return cycle === null ? null : { action: 'cancel', ...target, expectedCycle: cycle, expectedStages: expectedStagesOf(response) };
}

/**
 * «Βρες επαγγελματία» / «Ζήτησε κι από άλλον» — ο κατάλογος ανοιχτός **για** αυτό το ακίνητο και αυτό το έγγραφο.
 * 🔑 Περιοχή `null` **επίτηδες**: την κρίνει το `/pro` από το ακίνητο (`MyPropertyFilter`, ίδιος κριτής
 *    `ownerPropertyWhere`), εκεί όπου τα όρια είναι ήδη φορτωμένα — η καρτέλα ακινήτου δεν κατεβάζει ευρετήριο ορίων.
 */
function FindProfessionalLink({ target, labelKey }: { readonly target: KindTarget; readonly labelKey: string }): React.ReactElement {
  const { t } = useTranslation([...OWNER_ISSUANCE_NAMESPACES]);
  return (
    <Button asChild variant="outline" size="sm" className="w-fit">
      <Link href={documentIssuerSearchHref(target.documentKind, null, target.propertyId)}>{t(labelKey)}</Link>
    </Button>
  );
}

interface KindActionsProps {
  readonly target: KindTarget;
  readonly response: IssuanceBiddingResponse;
  readonly action: IssuanceRequestActionApi;
  readonly onCancel: () => void;
}

/** Οι πράξεις του αιτήματος — μόνο όταν ο διακομιστής λέει ότι μπορεί (`canAct`). */
function KindActions({ target, response, action, onCancel }: KindActionsProps): React.ReactElement | null {
  const { t } = useTranslation([...OWNER_ISSUANCE_NAMESPACES]);
  const phase = requestPhaseOf(response);
  if (!response.canAct) return <p className="m-0 text-xs text-muted-foreground">{t(OWNER_ISSUANCE_KEYS.readOnly)}</p>;
  if (phase === 'none' || phase === 'closed') {
    return <FindProfessionalLink target={target} labelKey={phase === 'none' ? OWNER_ISSUANCE_KEYS.findProfessional : OWNER_ISSUANCE_KEYS.requestAgain} />;
  }
  const cancelBody = cancelBodyOf(target, response);
  const cancelling = cancelBody !== null && action.busyKey === issuanceActionKeyOf(cancelBody);
  return (
    <nav className="flex flex-wrap items-center gap-3">
      {canInviteMore(response)
        ? <FindProfessionalLink target={target} labelKey={OWNER_ISSUANCE_KEYS.inviteMore} />
        : phase === 'inviting' && <p className="m-0 text-xs text-muted-foreground">{t(OWNER_ISSUANCE_KEYS.limitReached, { max: ISSUANCE_REQUEST_POLICY.maxBids })}</p>}
      {canCancelRequest(response) ? (
        <Button type="button" variant="ghost" size="sm" disabled={action.busyKey !== null} onClick={onCancel}>
          {t(cancelling ? OWNER_ISSUANCE_KEYS.saving : OWNER_ISSUANCE_KEYS.cancelRequest)}
        </Button>
      ) : null}
    </nav>
  );
}

/** Ποια προσφορά περιμένει απάντηση για επιλογή — από την ΙΔΙΑ ταυτότητα πράξης με το hook. */
function busyBidIdOf(action: IssuanceRequestActionApi, target: KindTarget, response: IssuanceBiddingResponse): string | null {
  if (action.busyKey === null) return null;
  return response.bids.find((bid) => {
    const body = awardBodyOf(target, response, bid);
    return body !== null && issuanceActionKeyOf(body) === action.busyKey;
  })?.bidId ?? null;
}

function KindStatus({ response }: { readonly response: IssuanceBiddingResponse }): React.ReactElement {
  const { t } = useTranslation([...OWNER_ISSUANCE_NAMESPACES]);
  const phase = requestPhaseOf(response);
  if (phase === 'none') return <p className="m-0 text-sm text-muted-foreground">{t(OWNER_ISSUANCE_KEYS.noRequest)}</p>;
  if (phase === 'closed') return <p className="m-0 text-sm text-muted-foreground">{t(OWNER_ISSUANCE_KEYS.closed)}</p>;
  return (
    <p className="m-0 text-sm text-muted-foreground">
      {t(OWNER_ISSUANCE_KEYS.bidsCount, { count: response.bids.length, max: ISSUANCE_REQUEST_POLICY.maxBids })}
    </p>
  );
}

function ConfirmPending({ pending, onClose, onConfirm }: { readonly pending: Pending; readonly onClose: () => void; readonly onConfirm: () => Promise<void> }) {
  const { t } = useTranslation([...OWNER_ISSUANCE_NAMESPACES]);
  const award = pending?.kind === 'award';
  return (
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={t(award ? OWNER_ISSUANCE_CONFIRM_KEYS.awardTitle : OWNER_ISSUANCE_CONFIRM_KEYS.cancelTitle)}
      description={t(award ? OWNER_ISSUANCE_CONFIRM_KEYS.awardDescription : OWNER_ISSUANCE_CONFIRM_KEYS.cancelDescription)}
      confirmText={t(award ? OWNER_ISSUANCE_CONFIRM_KEYS.awardConfirm : OWNER_ISSUANCE_CONFIRM_KEYS.cancelConfirm)}
      cancelText={t(OWNER_ISSUANCE_CONFIRM_KEYS.keep)}
      variant={award ? 'default' : 'destructive'}
      onConfirm={onConfirm}
    />
  );
}

function KindRow({ target }: { readonly target: KindTarget }): React.ReactElement | null {
  const { t } = useTranslation([...OWNER_ISSUANCE_NAMESPACES]);
  const { view, revalidate } = useIssuanceRequest(target.propertyId, target.documentKind);
  const action = useIssuanceRequestAction(revalidate);
  const [pending, setPending] = React.useState<Pending>(null);
  if (view.state === 'failed') return <li role="alert" className="text-sm text-destructive">{t(OWNER_ISSUANCE_KEYS.loadFailed)}</li>;
  if (view.state !== 'ready') return null;
  const { response } = view;
  const confirm = async (): Promise<void> => {
    if (pending === null) return;
    setPending(null);
    await action.submit(pending.body);
  };
  const askAward = (bid: IssuanceBidView): void => {
    const body = awardBodyOf(target, response, bid);
    if (body !== null) setPending({ kind: 'award', body });
  };
  const askCancel = (): void => {
    const body = cancelBodyOf(target, response);
    if (body !== null) setPending({ kind: 'cancel', body });
  };
  // Κάθε γραμμή έχει το δικό της hook ⇒ η άρνηση είναι πάντα **αυτού** του είδους.
  const failure = action.error?.reason ?? null;
  return (
    <li className="flex flex-col gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <h3 className="m-0 text-sm font-semibold text-card-foreground">{t(DOCUMENT_KIND_LABEL_KEYS[target.documentKind])}</h3>
      <KindStatus response={response} />
      <OwnerIssuanceBidList view={response} canAct={response.canAct} busyBidId={busyBidIdOf(action, target, response)} onAward={askAward} />
      <KindActions target={target} response={response} action={action} onCancel={askCancel} />
      {failure === null ? null : <p role="alert" className="m-0 text-sm text-destructive">{t(OWNER_ISSUANCE_ERROR_KEYS[failure])}</p>}
      <ConfirmPending pending={pending} onClose={() => setPending(null)} onConfirm={confirm} />
    </li>
  );
}

export interface OwnerIssuanceRequestSectionProps {
  readonly propertyId: string;
}

export function OwnerIssuanceRequestSection({ propertyId }: OwnerIssuanceRequestSectionProps): React.ReactElement {
  const { t } = useTranslation([...OWNER_ISSUANCE_NAMESPACES]);
  const headingId = `owner-issuance-title-${propertyId}`;
  return (
    <section aria-labelledby={headingId} className="mb-4 flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <header className="flex flex-col gap-1">
        <h2 id={headingId} className="m-0 text-base font-semibold text-card-foreground">{t(OWNER_ISSUANCE_KEYS.title)}</h2>
        <p className="m-0 text-sm text-muted-foreground">{t(OWNER_ISSUANCE_KEYS.lead, { max: ISSUANCE_REQUEST_POLICY.maxBids })}</p>
      </header>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {ISSUANCE_REQUEST_KINDS.map((documentKind) => (
          <KindRow key={documentKind} target={{ propertyId, documentKind }} />
        ))}
      </ul>
    </section>
  );
}
