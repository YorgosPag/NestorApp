'use client';

/**
 * @fileoverview Τα στοιχεία μιας πρόσκλησης **ανάθεσης έκδοσης** (ADR-862 §5.3.11): ποιο έγγραφο.
 * @module components/case-invite/IssuanceSubjectFacts
 *
 * Φορτώνεται **μόνο** μέσω `IssuanceSurfaces` (ADR-744 §27.4): το είδος εγγράφου δανείζεται ονόματα από το
 * `document-registry` / `legality` (`DOCUMENT_KIND_LABEL_KEYS`, το **ίδιο** λεξιλόγιο με το μητρώο λήξεων), και αυτά
 * δεν ανήκουν στο slice της σελίδας πρόσκλησης, που υπηρετεί και τη μεταβίβαση.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { DOCUMENT_KIND_LABEL_KEYS } from '@/components/document-registry/document-registry-labels';
import type { EngagementInvitationSubjectView } from '@/types/engagement-invitation';

type IssuanceSubject = Extract<EngagementInvitationSubjectView, { kind: 'document_issuance' }>;

export function IssuanceSubjectFacts({ subject }: { readonly subject: IssuanceSubject }) {
  // Κυριολεκτικός πίνακας (ADR-744): ο γεννήτορας διαβάζει στατικά τα namespaces του chunk.
  const { t } = useTranslation(['conveyance', 'document-registry', 'legality']);
  return (
    <>
      <dt className="text-muted-foreground">{t('conveyance:engagement.invite.issuance.documentLabel')}</dt>
      <dd>{t(DOCUMENT_KIND_LABEL_KEYS[subject.documentKind])}</dd>
    </>
  );
}
