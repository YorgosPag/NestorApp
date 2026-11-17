'use client';

/**
 * ADR-916 Φ-Ε1 — τα στοιχεία της πρόσκλησης **φακέλου ιδιώτη** στη σελίδα `/case-invite/[token]`: ρόλος · ποιες
 * καρτέλες (το εύρος, ποτέ ονόματα αρχείων — «μετρήσεις, όχι έγγραφα», ADR-901 §5.3) · για πόσες ημέρες.
 *
 * @module components/case-invite/DossierSubjectFacts
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { DOSSIER_INVITE_KEYS, DOSSIER_ROLE_KEY, DOSSIER_TAB_KEY } from '@/components/conveyance/my-cases/dossier-space-labels';
import { dossierTabWord } from '@/lib/property-dossier/property-dossier-view';
import type { EngagementInvitationSubjectView } from '@/types/engagement-invitation';
import { CASE_INVITE_KEYS, CASE_INVITE_NS } from './case-invite-labels';

type DossierSubject = Extract<EngagementInvitationSubjectView, { kind: 'property_dossier' }>;

export function DossierSubjectFacts({ subject }: { readonly subject: DossierSubject }) {
  const { t } = useTranslation(CASE_INVITE_NS);
  return (
    <>
      <dt className="text-muted-foreground">{t(CASE_INVITE_KEYS.roleLabel)}</dt>
      <dd>{t(DOSSIER_ROLE_KEY[subject.role])}</dd>
      <dt className="text-muted-foreground">{t(DOSSIER_INVITE_KEYS.tabsLabel)}</dt>
      <dd>{subject.tabs.map((tab) => t(DOSSIER_TAB_KEY[dossierTabWord(tab, subject.floorplanKind)])).join(' · ')}</dd>
      <dt className="text-muted-foreground">{t(DOSSIER_INVITE_KEYS.durationLabel)}</dt>
      <dd>{t(DOSSIER_INVITE_KEYS.duration, { days: subject.shareDays })}</dd>
    </>
  );
}
