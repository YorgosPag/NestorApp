'use client';

/**
 * @fileoverview ADR-945 §7.6 · Δ4 — **«Ζήτησε προσφορά» στην κάρτα επαγγελματία**, όταν ο κατάλογος ανοίχτηκε από ακίνητο.
 * @related agency-issuance-quote-context.tsx (η ΜΙΑ ανάγνωση της σελίδας) ·
 *   lib/document-validity/issuance-showcase-credential.ts (ο ΙΔΙΟΣ κριτής προσόντος με τον διακομιστή) ·
 *   lib/document-validity/issuance-request-view-model.ts (`inviteVerdictOf` — ο ΙΔΙΟΣ μειωτής)
 * @module components/mandate/AgencyRequestQuoteButton
 *
 * 🏆 Πέρα από Thumbtack/Checkatrade: η κάρτα λέει **πριν** το πάτημα τι θα γίνει — «Ζητήθηκε» για όποιον έχεις ήδη
 *    καλέσει, «έφτασες τις 3» όταν γέμισε ο κύκλος — αντί για κουμπί που απαντά «όχι» αφού πατηθεί.
 * 🔑 **Καμία δεύτερη κρίση**: εμφανίζεται μόνο σε βιτρίνα που **ο διακομιστής θα δεχτεί** (`showcaseIssuanceCredential`,
 *    ο ίδιος κριτής με την πρόσκληση) — ποτέ κουμπί που υπόσχεται κάτι που η πράξη αρνείται.
 * 🔑 Επιτυχία ⇒ **πίσω στο ακίνητο** (εκεί ζει το αίτημα). Ανώνυμος ⇒ σύνδεση, με επιστροφή **εδώ** (`next`).
 * ⚠️ Πλοήγηση **μόνο** μέσω του συνόρου (`@/lib/workspace/navigation`, CHECK 3.61).
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { OWNER_ISSUANCE_ERROR_KEYS } from '@/components/owner-property/owner-issuance-labels';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ISSUANCE_REQUEST_POLICY } from '@/lib/document-validity/issuance-bidding';
import { showcaseIssuanceCredential } from '@/lib/document-validity/issuance-showcase-credential';
import { expectedCycleOf, inviteVerdictOf } from '@/lib/document-validity/issuance-request-view-model';
import { offerDetailHref } from '@/lib/owner-property/owner-property-routes';
import { loginHrefForCurrentLocation } from '@/lib/routes/return-path';
import { Link, useRouter } from '@/lib/workspace/navigation';
import type { PublicShowcase } from '@/types/agency-profile';
import { issuanceActionKeyOf, useIssuanceRequestAction } from '@/hooks/document-registry/useIssuanceRequestAction';
import type { IssuanceRequestBody } from '@/lib/document-validity/issuance-bidding-request';
import { ISSUANCE_QUOTE_KEYS } from './agency-directory-labels';
import { useAgencyIssuanceQuote, type AgencyIssuanceQuoteApi } from './agency-issuance-quote-context';

const NAMESPACES = ['property-market', 'document-registry'] as const;

type QuoteButtonState = 'hidden' | 'sign-in' | 'loading' | 'request' | 'invited' | 'limit' | 'awarded';

function quoteButtonStateOf(api: AgencyIssuanceQuoteApi, showcase: PublicShowcase): QuoteButtonState {
  if (showcaseIssuanceCredential(showcase, api.context.documentKind) === null) return 'hidden';
  if (!api.signedIn) return 'sign-in';
  if (api.view.state === 'loading') return 'loading';
  if (api.view.state !== 'ready' || !api.view.response.canAct) return 'hidden';
  const verdict = inviteVerdictOf(api.view.response, showcase.companyId);
  if (verdict.kind === 'can-invite') return 'request';
  if (verdict.kind === 'invited') return 'invited';
  if (verdict.refusal === 'bid-limit') return 'limit';
  return verdict.refusal === 'already-awarded' ? 'awarded' : 'hidden';
}

function inviteBodyOf(api: AgencyIssuanceQuoteApi, companyId: string): IssuanceRequestBody | null {
  if (api.view.state !== 'ready') return null;
  const { propertyId, documentKind } = api.context;
  return { action: 'invite', propertyId, documentKind, professionalCompanyId: companyId, expectedCycle: expectedCycleOf(api.view.response) };
}

const NOTE_KEYS: Readonly<Record<'invited' | 'limit' | 'awarded', string>> = {
  invited: ISSUANCE_QUOTE_KEYS.invited,
  limit: ISSUANCE_QUOTE_KEYS.limitReached,
  awarded: ISSUANCE_QUOTE_KEYS.alreadyAwarded,
};

function RequestButton({ api, companyId }: { readonly api: AgencyIssuanceQuoteApi; readonly companyId: string }): React.ReactElement {
  const { t } = useTranslation([...NAMESPACES]);
  const router = useRouter();
  const action = useIssuanceRequestAction(api.revalidate);
  const body = inviteBodyOf(api, companyId);
  const busy = body !== null && action.busyKey === issuanceActionKeyOf(body);
  const failure = action.error !== null && body !== null && action.error.key === issuanceActionKeyOf(body) ? action.error.reason : null;
  const send = async (): Promise<void> => {
    if (body === null) return;
    if (await action.submit(body)) router.push(offerDetailHref(api.context.propertyId));
  };
  return (
    <>
      <Button type="button" size="sm" className="self-start" disabled={body === null || action.busyKey !== null} onClick={send}>
        {t(busy ? ISSUANCE_QUOTE_KEYS.saving : ISSUANCE_QUOTE_KEYS.request)}
      </Button>
      {failure === null ? null : <p role="alert" className="m-0 text-xs text-destructive">{t(OWNER_ISSUANCE_ERROR_KEYS[failure])}</p>}
    </>
  );
}

export interface AgencyRequestQuoteButtonProps {
  readonly showcase: PublicShowcase;
}

export function AgencyRequestQuoteButton({ showcase }: AgencyRequestQuoteButtonProps): React.ReactElement | null {
  const { t } = useTranslation([...NAMESPACES]);
  const api = useAgencyIssuanceQuote();
  if (api === null) return null;
  const state = quoteButtonStateOf(api, showcase);
  if (state === 'hidden') return null;
  if (state === 'sign-in') {
    return (
      <Button asChild variant="outline" size="sm" className="self-start">
        <Link href={loginHrefForCurrentLocation()}>{t(ISSUANCE_QUOTE_KEYS.signIn)}</Link>
      </Button>
    );
  }
  if (state === 'request' || state === 'loading') return <RequestButton api={api} companyId={showcase.companyId} />;
  return <p className="m-0 text-xs text-muted-foreground">{t(NOTE_KEYS[state], { max: ISSUANCE_REQUEST_POLICY.maxBids })}</p>;
}
