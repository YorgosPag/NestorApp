'use client';

/**
 * @fileoverview ADR-945 §7.6 — **«Ζητάς προσφορά για: {έγγραφο}»** πάνω από τον κατάλογο, όταν ανοίχτηκε από ακίνητο.
 * @related agency-issuance-quote-context.tsx · AgencyRequestQuoteButton.tsx · lib/agency/issuance-context-query.ts
 * @module components/mandate/AgencyIssuanceContextBar
 *
 * 🏆 Thumbtack/Airtasker κρατούν το «για ποια δουλειά» σε όλη τη διαδρομή επιλογής· εδώ, επιπλέον, η λωρίδα λέει **πόσες
 *    προσφορές έχεις ήδη** και σε γυρίζει στο ακίνητο με ένα πάτημα — ο κατάλογος δεν γίνεται αδιέξοδο.
 * 🔑 Καμία ονομασία ακινήτου από τη διεύθυνση: το πλαίσιο είναι **υπόδειξη** (ο καθένας γράφει URL). Το όνομα του εγγράφου
 *    βγαίνει από τον κλειστό κατάλογο ειδών· το ακίνητο ονομάζεται από τη σελίδα του, όπου ο κάτοχος έχει ελεγχθεί.
 */

import React from 'react';

import { DOCUMENT_KIND_LABEL_KEYS } from '@/components/document-registry/document-registry-labels';
import { OWNER_ISSUANCE_KEYS } from '@/components/owner-property/owner-issuance-labels';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ISSUANCE_REQUEST_POLICY } from '@/lib/document-validity/issuance-bidding';
import { requestPhaseOf } from '@/lib/document-validity/issuance-request-view-model';
import { offerDetailHref } from '@/lib/owner-property/owner-property-routes';
import { Link } from '@/lib/workspace/navigation';
import { ISSUANCE_QUOTE_KEYS } from './agency-directory-labels';
import { useAgencyIssuanceQuote } from './agency-issuance-quote-context';

const NAMESPACES = ['property-market', 'document-registry', 'conveyance', 'legality'] as const;

export function AgencyIssuanceContextBar(): React.ReactElement | null {
  const { t } = useTranslation([...NAMESPACES]);
  const api = useAgencyIssuanceQuote();
  if (api === null) return null;
  const response = api.view.state === 'ready' ? api.view.response : null;
  const live = response !== null && requestPhaseOf(response) !== 'none' && requestPhaseOf(response) !== 'closed';
  return (
    <aside aria-live="polite" className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <p className="m-0 text-sm font-semibold text-card-foreground">
        {t(ISSUANCE_QUOTE_KEYS.contextTitle, { document: t(DOCUMENT_KIND_LABEL_KEYS[api.context.documentKind]) })}
      </p>
      <p className="m-0 text-sm text-muted-foreground">{t(ISSUANCE_QUOTE_KEYS.contextHint, { max: ISSUANCE_REQUEST_POLICY.maxBids })}</p>
      {live ? (
        <p className="m-0 text-sm text-muted-foreground">
          {t(OWNER_ISSUANCE_KEYS.bidsCount, { count: response.bids.length, max: ISSUANCE_REQUEST_POLICY.maxBids })}
        </p>
      ) : null}
      {api.signedIn ? (
        <Link href={offerDetailHref(api.context.propertyId)} className="self-start text-sm font-medium text-foreground underline underline-offset-4">
          {t(ISSUANCE_QUOTE_KEYS.backToProperty)}
        </Link>
      ) : null}
    </aside>
  );
}
