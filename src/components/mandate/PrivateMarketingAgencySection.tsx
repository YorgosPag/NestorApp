'use client';

/**
 * @fileoverview **Η ΚΛΕΙΣΤΗ ΔΙΑΘΕΣΗ ΣΤΗΝ ΟΘΟΝΗ ΤΗΣ ΕΝΤΟΛΗΣ ΤΟΥ ΓΡΑΦΕΙΟΥ** — κατάσταση · αίτημα · έντυπο (ADR-864 §18).
 * @related components/mandate/MandateDetailContent.tsx · services/owner-property/private-marketing.client.ts
 * @module components/mandate/PrivateMarketingAgencySection
 *
 * 🔑 **Δύο δρόμοι, όπως οι μεγάλοι** (§18.3): *«ζήτα από τον ιδιοκτήτη»* (Compass — υπογραφή πωλητή πριν από
 * κάθε προ-προώθηση) **ή** *«έχω υπογεγραμμένο έντυπο»* (Bright MLS — ανέβασμα τη στιγμή της δήλωσης).
 *
 * 🔴 **Α22 — ΚΑΝΕΝΑ «ΑΙΤΗΜΑ» ΟΤΑΝ Η ΣΥΝΑΙΝΕΣΗ ΙΣΧΥΕΙ.** Ο διακομιστής αρνείται (`consent-already-granted`),
 * αλλά κουμπί που οδηγεί **μόνο** σε άρνηση είναι υπόσχεση που δεν υπάρχει — ίδια κλάση με την ADR-841 Α18.9.
 *
 * ⚠️ Το κοινό του αιτήματος **δεν** επιλέγεται εδώ όσο υπάρχει **ένα** επιλέξιμο κλειστό κοινό (`network` = Φ5)·
 * παράγεται από τη ρίζα, ώστε η ημέρα που ανοίγει το δίκτυο να μη χρειάζεται αλλαγή εδώ για να είναι σωστή.
 */

import React from 'react';
import dynamic from 'next/dynamic';

import { Button } from '@/components/ui/button';
import { MARKETING_AUDIENCES, isOfferableAudience } from '@/constants/marketing-audiences';
import { usePrivateMarketingPanels } from '@/hooks/mandate/usePrivateMarketingPanels';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDateTime } from '@/lib/intl-formatting';
import type { PrivateMarketingPanel } from '@/lib/mandate/private-marketing-panel';
import {
  requestPrivateMarketing,
  type PrivateMarketingRequestOutcome,
} from '@/services/owner-property/private-marketing.client';
import { isClosedMarketingAudience, type ClosedMarketingAudience } from '@/types/private-marketing-consent';

import { MandateEvidenceList } from './MandateEvidenceList';
import { PrivateMarketingActionNotice } from './PrivateMarketingActionNotice';
import { PrivateMarketingStandingLine } from './PrivateMarketingStandingLine';

const NS = 'property-market';
const K = `${NS}:mandate.privateMarketing`;

/** Όριο κλειστότητας (CHECK 3.34 Κ2) — `files` + `legal` μόνο πίσω από το κλικ· **ποτέ** `ssr: false` (δες το module). */
const PrivateMarketingAttestationControl = dynamic(() =>
  import('./PrivateMarketingAttestationControl').then((mod) => mod.PrivateMarketingAttestationControl),
);

/** Το κοινό του αιτήματος: του εκκρεμούς αιτήματος, αλλιώς το **πρώτο επιλέξιμο** κλειστό της ρίζας. */
function audienceFor(panel: PrivateMarketingPanel): ClosedMarketingAudience | null {
  if (panel.standing.kind === 'requested') return panel.standing.audience;
  return MARKETING_AUDIENCES.filter(isClosedMarketingAudience).find(isOfferableAudience) ?? null;
}

interface ActionProps {
  readonly ownerPropertyId: string;
  readonly panel: PrivateMarketingPanel;
  readonly audience: ClosedMarketingAudience;
  readonly onDone: (outcome: PrivateMarketingRequestOutcome) => void;
}

/** «Στάλθηκε» ≠ «η επαφή δεν έχει email» ≠ «απέτυχε η αποστολή» — τρεις δουλειές για τον άνθρωπο. */
function AgencyOutcomeNotice({ outcome }: { readonly outcome: PrivateMarketingRequestOutcome | null }): React.ReactElement | null {
  const { t } = useTranslation([NS]);
  if (outcome === null || outcome.kind !== 'requested') return <PrivateMarketingActionNotice outcome={outcome} />;
  return <p role="status" className="text-sm font-medium text-card-foreground">{t(`${K}.agency.notify.${outcome.notify}`)}</p>;
}

function RequestControl({ ownerPropertyId, panel, audience, onDone }: ActionProps): React.ReactElement {
  const { t } = useTranslation([NS]);
  const [busy, setBusy] = React.useState(false);
  const request = async (): Promise<void> => {
    setBusy(true);
    onDone(await requestPrivateMarketing(ownerPropertyId, audience));
    setBusy(false);
  };
  // Α30 — η αναμονή λέγεται με ΩΡΑ, από τον διακομιστή· κουμπί που θα γύριζε `consent-request-cooling` δεν δείχνεται.
  if (panel.nextRequestAt !== null) {
    return <p className="text-sm text-muted-foreground">{t(`${K}.agency.requestCooling`, { time: formatDateTime(panel.nextRequestAt) })}</p>;
  }
  return (
    <footer className="flex flex-col gap-1">
      <Button type="button" className="self-start" disabled={busy} onClick={() => void request()}>
        {t(panel.standing.kind === 'requested' ? `${K}.agency.requestAgain` : `${K}.agency.request`)}
      </Button>
      <p className="text-sm text-muted-foreground">{t(`${K}.agency.requestHint`)}</p>
    </footer>
  );
}

/** Ο τύπος παράγεται από το όριο — `import type` του module θα το ξαναέσερνε στην κλειστότητα (CHECK 3.34). */
type AttestationProps = React.ComponentProps<typeof PrivateMarketingAttestationControl>;

function AttestationControl(props: AttestationProps): React.ReactElement {
  const { t } = useTranslation([NS]);
  return (
    <details className="flex flex-col gap-3">
      <summary className="cursor-pointer text-sm font-medium text-card-foreground">{t(`${K}.agency.attestOpen`)}</summary>
      <PrivateMarketingAttestationControl {...props} />
    </details>
  );
}

export function PrivateMarketingAgencySection({ ownerPropertyId }: { readonly ownerPropertyId: string }): React.ReactElement | null {
  const { t } = useTranslation([NS]);
  const { load, reload } = usePrivateMarketingPanels(ownerPropertyId);
  const [outcome, setOutcome] = React.useState<PrivateMarketingRequestOutcome | null>(null);
  const headingId = React.useId();

  if (load === null) return <p className="text-sm text-muted-foreground">{t(`${K}.loading`)}</p>;
  if (load.kind === 'failed') return <p className="text-sm text-muted-foreground">{t(`${K}.loadFailed`)}</p>;
  const panel = load.kind === 'found' ? load.panels.panels[0] : undefined;
  // Χωρίς δεσμευτική εντολή του γραφείου δεν υπάρχει συναίνεση να ζητηθεί (Α7β).
  if (load.kind === 'absent' || panel === undefined) return null;

  // Α22 — με ενεργή συναίνεση **καμία** πράξη δεν προσφέρεται: μόνο η κατάσταση.
  const audience = panel.standing.kind === 'granted' ? null : audienceFor(panel);
  const onDone = (next: PrivateMarketingRequestOutcome): void => {
    setOutcome(next);
    reload();
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <h2 id={headingId} className="text-base font-semibold text-card-foreground">{t(`${K}.title`)}</h2>
      <PrivateMarketingStandingLine standing={panel.standing} />
      <MandateEvidenceList evidence={panel.evidence} source={{ kind: 'account', ownerPropertyId }} />
      <AgencyOutcomeNotice outcome={outcome} />
      {/* Α35 — ο ιδιοκτήτης αρνήθηκε: κανένα αίτημα για αυτούς τους όρους. Το έντυπο μένει (ειδοποιείται για αμφισβήτηση). */}
      {audience !== null && panel.standing.kind !== 'declined' && (
        <RequestControl ownerPropertyId={ownerPropertyId} panel={panel} audience={audience} onDone={onDone} />
      )}
      {audience !== null && load.panels.disclosure !== null && (
        <AttestationControl ownerPropertyId={ownerPropertyId} panel={panel} audience={audience} onDone={onDone} disclosure={load.panels.disclosure} />
      )}
    </section>
  );
}
