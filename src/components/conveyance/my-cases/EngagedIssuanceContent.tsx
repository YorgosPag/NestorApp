'use client';

/**
 * =============================================================================
 * Ο χώρος της ανάθεσης, όπως τον βλέπει ο επαγγελματίας (ADR-915 §39 · ADR-862 §5.3.11)
 * =============================================================================
 *
 * Ποιο γραφείο, ποιο ακίνητο, ποιο έγγραφο, πού βρίσκεται η ανάθεση και σε ποιον είναι η σειρά — **παραγόμενα** από
 * την ανάθεση, ποτέ αποθηκευμένα δεύτερη φορά. Η ιδιότητα φαίνεται όπως τη δήλωσε ο ίδιος («δηλωμένη»).
 *
 * 🔒 Ε-9′ — **κανένα** τηλέφωνο ή email του γραφείου: μόνο ονόματα και γεγονότα.
 * 🔑 Η παράδοση (Φ-Γ) και τα μηνύματα (Φ-Δ) προστίθενται **εδώ**, πάνω στο ίδιο `kind` — η σελίδα δεν αλλάζει διεύθυνση.
 *
 * @module components/conveyance/my-cases/EngagedIssuanceContent
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PrivatePageHeader } from '@/components/private-space/PrivatePageHeader';
import { Card } from '@/components/ui/card';
import { DOCUMENT_KIND_LABEL_KEYS } from '@/components/document-registry/document-registry-labels';
import { BALL_IN_COURT_KEYS, ISSUANCE_STAGE_KEYS } from '@/components/document-registry/issuance-labels';
import { REGISTRY_AUTHORITY_PRESENTATION } from '@/constants/professional-registries';
import { formatDate } from '@/lib/intl-utils';
import type { EngagedIssuanceView } from '@/types/my-engagements';
import { ISSUANCE_SPACE_KEYS } from './issuance-space-labels';

function Facts({ view }: { readonly view: EngagedIssuanceView }) {
  const { t } = useTranslation(['conveyance', 'document-registry', 'legality', 'property-market']);
  const credential = view.credential;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      <dt className="text-muted-foreground">{t(ISSUANCE_SPACE_KEYS.officeLabel)}</dt>
      <dd>{view.hostName ?? t(ISSUANCE_SPACE_KEYS.unnamedOffice)}</dd>
      <dt className="text-muted-foreground">{t(ISSUANCE_SPACE_KEYS.propertyLabel)}</dt>
      <dd>{view.propertyName ?? t(ISSUANCE_SPACE_KEYS.untitledProperty)}</dd>
      <dt className="text-muted-foreground">{t(ISSUANCE_SPACE_KEYS.documentLabel)}</dt>
      <dd>{t(DOCUMENT_KIND_LABEL_KEYS[view.documentKind])}</dd>
      <dt className="text-muted-foreground">{t(ISSUANCE_SPACE_KEYS.stageLabel)}</dt>
      <dd>{t(ISSUANCE_STAGE_KEYS[view.stage])}</dd>
      {view.ballInCourt && (
        <>
          <dt className="text-muted-foreground">{t(ISSUANCE_SPACE_KEYS.ballLabel)}</dt>
          <dd>{t(BALL_IN_COURT_KEYS[view.ballInCourt])}</dd>
        </>
      )}
      {credential && (
        <>
          <dt className="text-muted-foreground">{t(ISSUANCE_SPACE_KEYS.credentialLabel)}</dt>
          <dd>
            {t(ISSUANCE_SPACE_KEYS.credentialValue, {
              registry: t(REGISTRY_AUTHORITY_PRESENTATION[credential.authority].abbreviationKey),
              number: credential.number,
            })}
          </dd>
        </>
      )}
      <dt className="text-muted-foreground">{t(ISSUANCE_SPACE_KEYS.requestedLabel)}</dt>
      <dd>{formatDate(view.proposedAt)}</dd>
    </dl>
  );
}

export function EngagedIssuanceContent({ view }: { readonly view: EngagedIssuanceView }) {
  const { t } = useTranslation(['conveyance', 'document-registry', 'legality']);
  return (
    <>
      <PrivatePageHeader
        title={view.propertyName ?? t(ISSUANCE_SPACE_KEYS.untitledProperty)}
        lead={`${t(ISSUANCE_SPACE_KEYS.kindLabel)} · ${t(DOCUMENT_KIND_LABEL_KEYS[view.documentKind])}`}
      />
      <Card asChild className="space-y-4 p-4">
        <section aria-label={t(ISSUANCE_SPACE_KEYS.kindLabel)}>
          <Facts view={view} />
          <p className="text-xs text-muted-foreground">{t(ISSUANCE_SPACE_KEYS.scope)}</p>
        </section>
      </Card>
    </>
  );
}
