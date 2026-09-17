'use client';

/**
 * @fileoverview **ΤΟ ΥΠΟΓΕΓΡΑΜΜΕΝΟ ΕΝΤΥΠΟ, ΠΙΣΩ ΑΠΟ ΟΡΙΟ** (ADR-864 §18.3 · ADR-744 §15 Κ2).
 * @related components/mandate/PrivateMarketingAgencySection.tsx · components/mandate/AttestationDocumentField.tsx
 * @module components/mandate/PrivateMarketingAttestationControl
 *
 * 🔑 **Γιατί ζει σε ΔΙΚΟ ΤΟΥ module**: ο δεύτερος δρόμος του §18.3 (*«έχω υπογεγραμμένο έντυπο»*) σέρνει τον
 * **διαχειριστή αρχείων** (`FileUploadButton` ⇒ namespace `files`) και το **νομικό κείμενο** (`legal`) μέσα στη
 * στατική κλειστότητα της `/o/[workspace]/listings/mandates/[ownerPropertyId]` — δύο ολόκληρες οικογένειες
 * κειμένου για οθόνη που **ανοίγει μόνο με κλικ**. Η CHECK 3.34 (Κ2) το μέτρησε: **5.772 → 10.733 bytes**.
 *
 * ⚠️ **ΠΟΤΕ `ssr: false`** (ADR-744 §14.3 · §15): θα μετακινούσε το ωμό κλειδί από το SSR HTML στο πρώτο καρέ
 * του πελάτη και θα το **έκρυβε** από τη CHECK 3.51, χωρίς να το διορθώσει. Εδώ δεν χρειάζεται καν: το
 * περιεχόμενο **δεν υπάρχει** στο πρώτο καρέ επειδή το `<details>` είναι **κλειστό** — ο τίτλος που το
 * ανοίγει (`agency.attestOpen`) μένει στον γονέα, δηλαδή στο σύγχρονο slice.
 */

import React from 'react';

import { PrivateMarketingConsentForm, type PartySubmission } from '@/components/mandate/PrivateMarketingConsentForm';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { LegalDocumentVersion } from '@/lib/legal/legal-document-versions';
import { pendingRequestIdOf, type PrivateMarketingPanel } from '@/lib/mandate/private-marketing-panel';
import { legalDocumentVersionHref } from '@/lib/routes/legalRoutes';
import { Link } from '@/lib/workspace/navigation';
import {
  attestPrivateMarketing,
  type PrivateMarketingActionOutcome,
} from '@/services/owner-property/private-marketing.client';
import { PRIVATE_MARKETING_DOCUMENT, type ClosedMarketingAudience } from '@/types/private-marketing-consent';

import { AttestationDocumentField, type AttestationDocumentState } from './AttestationDocumentField';

const NS = 'property-market';
const K = `${NS}:mandate.privateMarketing`;

export interface PrivateMarketingAttestationProps {
  readonly ownerPropertyId: string;
  readonly panel: PrivateMarketingPanel;
  readonly audience: ClosedMarketingAudience;
  readonly disclosure: LegalDocumentVersion;
  readonly onDone: (outcome: PrivateMarketingActionOutcome) => void;
}

export function PrivateMarketingAttestationControl({
  ownerPropertyId,
  panel,
  audience,
  disclosure,
  onDone,
}: PrivateMarketingAttestationProps): React.ReactElement {
  const { t } = useTranslation([NS]);
  const [attachment, setAttachment] = React.useState<AttestationDocumentState>({ kind: 'empty' });
  const [busy, setBusy] = React.useState(false);
  const version = disclosure.frozen.version;

  const submit = async (submissions: readonly PartySubmission[]): Promise<void> => {
    const submission = submissions[0]?.submission;
    if (submission === undefined || attachment.kind !== 'attached') return;
    setBusy(true);
    onDone(await attestPrivateMarketing(ownerPropertyId, { audience, requestId: pendingRequestIdOf(panel), submission, documentFileId: attachment.fileId }));
    setBusy(false);
  };

  return (
    <React.Fragment>
      <p className="text-sm text-muted-foreground">{t(`${K}.agency.attestExplain`)}</p>
      <Link href={legalDocumentVersionHref(PRIVATE_MARKETING_DOCUMENT, version)} className="text-sm underline">
        {t(`${K}.agency.printable`, { version })}
      </Link>
      <PrivateMarketingConsentForm
        version={disclosure}
        parties={[{ key: panel.agencyCompanyId, values: panel.values }]}
        busy={busy}
        ready={attachment.kind === 'attached'}
        purpose="attestation"
        onSubmit={(submissions) => void submit(submissions)}
      >
        <AttestationDocumentField ownerPropertyId={ownerPropertyId} state={attachment} onChange={setAttachment} />
      </PrivateMarketingConsentForm>
    </React.Fragment>
  );
}
