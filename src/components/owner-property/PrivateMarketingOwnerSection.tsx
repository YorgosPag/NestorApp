'use client';

/**
 * @fileoverview **Η ΚΛΕΙΣΤΗ ΔΙΑΘΕΣΗ ΣΤΗ ΣΕΛΙΔΑ ΤΟΥ ΙΔΙΟΚΤΗΤΗ** — αιτήματα · συναίνεση · ανάκληση (ADR-864 §18).
 * @related components/owner-property/OwnerPropertyDetailContent.tsx · services/owner-property/private-marketing.client.ts
 * @module components/owner-property/PrivateMarketingOwnerSection
 *
 * 🏆 **Το αίτημα του γραφείου φαίνεται ΕΔΩ, όχι μόνο στο email** (§18.5 #2) — μοτίβο που δεν βρέθηκε σε
 * Zillow · Idealista · Rightmove. Εκκρεμές αίτημα ⇒ η φόρμα **ανοίγει μόνη της**.
 *
 * 🔴 **Α24 — φόρμα ΜΟΝΟ για γραφεία χωρίς ενεργή συναίνεση.** Ξαναμονογραφή προς γραφείο που ήδη καλύπτεται θα
 * κατέγραφε δεύτερη συναίνεση για την ίδια σχέση και θα έκρυβε ποια λείπει πραγματικά.
 *
 * 🔴 **Α27 — όλα τα γραφεία, μία υποβολή** (Δ3): με δύο μη αποκλειστικές εντολές, συναίνεση «ένα-ένα» είναι
 * **αδύνατη** (το άλλο μένει παραβάτης). Κάθε γραφείο έχει το **δικό του** κείμενο και μονογραφή.
 *
 * ⚠️ Οι τιμές του κειμένου είναι **του διακομιστή** (Α25) — ποτέ η επωνυμία της βιτρίνας που δείχνει το
 * `OwnerMandatePanel` λίγο πιο πάνω: είναι **άλλη πηγή** (`agency_profiles` ≠ `companies`).
 */

import React from 'react';
import dynamic from 'next/dynamic';

import { Button } from '@/components/ui/button';
import type { MarketingAudience } from '@/constants/marketing-audiences';
import { usePrivateMarketingPanels } from '@/hooks/mandate/usePrivateMarketingPanels';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  panelsAwaitingConsent,
  pendingRequestIdOf,
  type PrivateMarketingPanel,
} from '@/lib/mandate/private-marketing-panel';
import {
  declinePrivateMarketing,
  revokePrivateMarketing,
  type PrivateMarketingActionOutcome,
} from '@/services/owner-property/private-marketing.client';
import type { PrivateMarketingRevocationOutcome } from '@/types/private-marketing-consent';
import { PrivateMarketingActionNotice } from '@/components/mandate/PrivateMarketingActionNotice';
import { PrivateMarketingStandingLine } from '@/components/mandate/PrivateMarketingStandingLine';

import { usePrivateMarketingAgencyLabel } from './usePrivateMarketingAgencyLabel';

const NS = 'property-market';
const K = `${NS}:mandate.privateMarketing`;

/** Όριο κλειστότητας (CHECK 3.34 Κ2) — το `legal` μόνο όταν ανοίξει η φόρμα· **ποτέ** `ssr: false` (δες το module). */
const PrivateMarketingOwnerConsent = dynamic(() =>
  import('./PrivateMarketingOwnerConsent').then((mod) => mod.PrivateMarketingOwnerConsent),
);

function RevokeControl({ ownerPropertyId, panel, onDone }: { readonly ownerPropertyId: string; readonly panel: PrivateMarketingPanel; readonly onDone: (outcome: PrivateMarketingActionOutcome) => void }): React.ReactElement {
  const { t } = useTranslation([NS]);
  const [busy, setBusy] = React.useState(false);
  const revoke = async (outcome: PrivateMarketingRevocationOutcome): Promise<void> => {
    setBusy(true);
    onDone(await revokePrivateMarketing(ownerPropertyId, panel.agencyCompanyId, outcome));
    setBusy(false);
  };
  return (
    <footer className="flex flex-wrap gap-2">
      <Button type="button" size="sm" disabled={busy} onClick={() => void revoke('public')}>{t(`${K}.revokePublic`)}</Button>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void revoke('withdrawn')}>{t(`${K}.revokeWithdraw`)}</Button>
    </footer>
  );
}

/** Α35 — «μη μου ξαναστείλετε»: δικαίωμα του παραλήπτη (Adobe Acrobat Sign), ένα κλικ δίπλα στο αίτημα. */
function DeclineControl({ ownerPropertyId, panel, requestId, onDone }: { readonly ownerPropertyId: string; readonly panel: PrivateMarketingPanel; readonly requestId: string; readonly onDone: (outcome: PrivateMarketingActionOutcome) => void }): React.ReactElement {
  const { t } = useTranslation([NS]);
  const [busy, setBusy] = React.useState(false);
  const decline = async (): Promise<void> => {
    setBusy(true);
    onDone(await declinePrivateMarketing(ownerPropertyId, panel.agencyCompanyId, requestId));
    setBusy(false);
  };
  return (
    <footer className="flex flex-col gap-1">
      <Button type="button" size="sm" variant="outline" className="self-start" disabled={busy} onClick={() => void decline()}>{t(`${K}.decline`)}</Button>
      <p className="text-sm text-muted-foreground">{t(`${K}.declineExplain`)}</p>
    </footer>
  );
}

function AgencyRow({ panel, closed, ownerPropertyId, onDone }: { readonly panel: PrivateMarketingPanel; readonly closed: boolean; readonly ownerPropertyId: string; readonly onDone: (outcome: PrivateMarketingActionOutcome) => void }): React.ReactElement {
  const { t } = useTranslation([NS]);
  const agencyLabel = usePrivateMarketingAgencyLabel();
  const requestId = pendingRequestIdOf(panel);
  return (
    <li className="flex flex-col gap-1">
      <p className="text-sm font-medium text-card-foreground">{agencyLabel(panel)}</p>
      <PrivateMarketingStandingLine standing={panel.standing} />
      {panel.standing.kind === 'granted' && closed && (
        <>
          <p className="text-sm text-muted-foreground">{t(`${K}.revokeExplain`)}</p>
          <RevokeControl ownerPropertyId={ownerPropertyId} panel={panel} onDone={onDone} />
        </>
      )}
      {requestId !== null && <DeclineControl ownerPropertyId={ownerPropertyId} panel={panel} requestId={requestId} onDone={onDone} />}
    </li>
  );
}

export function PrivateMarketingOwnerSection({
  ownerPropertyId,
  marketingAudience,
  revision,
}: {
  readonly ownerPropertyId: string;
  readonly marketingAudience: MarketingAudience;
  readonly revision: string | null;
}): React.ReactElement | null {
  const { t } = useTranslation([NS]);
  const { load, reload } = usePrivateMarketingPanels(ownerPropertyId, revision);
  const [outcome, setOutcome] = React.useState<PrivateMarketingActionOutcome | null>(null);
  const [started, setStarted] = React.useState(false);
  const headingId = React.useId();

  if (load === null || load.kind !== 'found' || load.panels.viewer !== 'owner') return null;
  const { panels, disclosure } = load.panels;
  const awaiting = panelsAwaitingConsent(panels);
  const requested = awaiting.some((panel) => pendingRequestIdOf(panel) !== null);
  const onDone = (next: PrivateMarketingActionOutcome): void => {
    setOutcome(next);
    if (next.kind === 'saved') setStarted(false);
    reload();
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <h2 id={headingId} className="text-base font-semibold text-card-foreground">{t(`${K}.title`)}</h2>
      <ul className="flex flex-col gap-3">
        {panels.map((panel) => (
          <AgencyRow key={panel.agencyCompanyId} panel={panel} closed={marketingAudience !== 'public'} ownerPropertyId={ownerPropertyId} onDone={onDone} />
        ))}
      </ul>
      <PrivateMarketingActionNotice outcome={outcome} />
      {awaiting.length > 0 && !requested && !started && (
        <Button type="button" variant="outline" className="self-start" onClick={() => setStarted(true)}>{t(`${K}.owner.start`)}</Button>
      )}
      {awaiting.length > 0 && (requested || started) && disclosure !== null && (
        <PrivateMarketingOwnerConsent ownerPropertyId={ownerPropertyId} awaiting={awaiting} disclosure={disclosure} onDone={onDone} />
      )}
    </section>
  );
}
