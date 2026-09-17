'use client';

/**
 * @fileoverview **Η ΣΥΝΑΙΝΕΣΗ ΤΟΥ ΙΔΙΟΚΤΗΤΗ, ΠΙΣΩ ΑΠΟ ΟΡΙΟ** (ADR-864 §18 · ADR-744 §15 Κ2).
 * @related components/owner-property/PrivateMarketingOwnerSection.tsx · components/mandate/PrivateMarketingConsentForm.tsx
 * @module components/owner-property/PrivateMarketingOwnerConsent
 *
 * 🔑 **Γιατί ζει σε ΔΙΚΟ ΤΟΥ module**: η φόρμα σέρνει το **νομικό κείμενο** (`legal`) στη στατική κλειστότητα
 * της `/offers/[offerId]`, ενώ **δεν υπάρχει ποτέ στο πρώτο καρέ** — η ενότητα επιστρέφει `null` ώσπου να
 * φορτώσουν τα panels στον πελάτη. Η CHECK 3.34 (Κ2) το μέτρησε: **25.284 > 23.166 bytes**.
 *
 * ⚠️ **ΠΟΤΕ `ssr: false`** (ADR-744 §14.3 · §15) — ίδιο σκεπτικό με το `PrivateMarketingAttestationControl`.
 *
 * 🔴 **Α27 — όλα τα γραφεία, μία υποβολή** (Δ3). Κάθε γραφείο έχει το **δικό του** κείμενο και μονογραφή.
 */

import React from 'react';

import { PrivateMarketingConsentForm, type PartySubmission } from '@/components/mandate/PrivateMarketingConsentForm';
import { MARKETING_AUDIENCES, isOfferableAudience } from '@/constants/marketing-audiences';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { LegalDocumentVersion } from '@/lib/legal/legal-document-versions';
import { pendingRequestIdOf, type PrivateMarketingPanel } from '@/lib/mandate/private-marketing-panel';
import {
  grantPrivateMarketing,
  type PrivateMarketingActionOutcome,
} from '@/services/owner-property/private-marketing.client';
import { isClosedMarketingAudience, type ClosedMarketingAudience } from '@/types/private-marketing-consent';

import { usePrivateMarketingAgencyLabel } from './usePrivateMarketingAgencyLabel';

const NS = 'property-market';
const K = `${NS}:mandate.privateMarketing`;

/** Κοινό της υποβολής: `null` όταν **κάθε** γραμμή εκτελεί αίτημα (το κοινό του αιτήματος)· αλλιώς το πρώτο επιλέξιμο κλειστό. */
function grantAudienceOf(awaiting: readonly PrivateMarketingPanel[]): ClosedMarketingAudience | null {
  if (awaiting.every((panel) => pendingRequestIdOf(panel) !== null)) return null;
  return MARKETING_AUDIENCES.filter(isClosedMarketingAudience).find(isOfferableAudience) ?? null;
}

export interface PrivateMarketingOwnerConsentProps {
  readonly ownerPropertyId: string;
  readonly awaiting: readonly PrivateMarketingPanel[];
  readonly disclosure: LegalDocumentVersion;
  readonly onDone: (outcome: PrivateMarketingActionOutcome) => void;
}

export function PrivateMarketingOwnerConsent({ ownerPropertyId, awaiting, disclosure, onDone }: PrivateMarketingOwnerConsentProps): React.ReactElement {
  const { t } = useTranslation([NS]);
  const agencyLabel = usePrivateMarketingAgencyLabel();
  const [busy, setBusy] = React.useState(false);
  const several = awaiting.length > 1;

  const submit = async (submissions: readonly PartySubmission[]): Promise<void> => {
    const consents = submissions.flatMap(({ key, submission }) => {
      const panel = awaiting.find((candidate) => candidate.agencyCompanyId === key);
      return panel === undefined ? [] : [{ agencyCompanyId: key, requestId: pendingRequestIdOf(panel), submission }];
    });
    setBusy(true);
    onDone(await grantPrivateMarketing(ownerPropertyId, grantAudienceOf(awaiting), consents));
    setBusy(false);
  };

  return (
    <PrivateMarketingConsentForm
      version={disclosure}
      parties={awaiting.map((panel) => ({
        key: panel.agencyCompanyId,
        values: panel.values,
        ...(several ? { heading: t(`${K}.owner.consentFor`, { agency: agencyLabel(panel) }) } : {}),
      }))}
      busy={busy}
      onSubmit={(submissions) => void submit(submissions)}
    />
  );
}
