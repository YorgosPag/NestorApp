'use client';

/**
 * @fileoverview **Η καταχώριση στο μητρώο για τον κωδικό του χαρτιού** — η σελίδα άνοιξε από το QR, χωρίς αρχείο
 *               (ADR-916 Φ-Γ2 Σ6).
 * @module components/handover-protocol-verify/ProtocolRecordView
 *
 * 🏆 docs.gov.gr/validate: ο κωδικός του εγγράφου φέρνει την καταχώριση του εκδότη. Εδώ **και** αν είναι η τρέχουσα
 *    αναθεώρηση. 🔒 Κανένα όνομα: μόνο όσα τυπώνει ήδη το χαρτί, για σύγκριση. Η **πλήρης** επαλήθευση θέλει το PDF.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { HandoverProtocolStanding } from '@/lib/property-handover/handover-protocol-verification';

import { ProtocolFact, ProtocolRegistryFacts } from './ProtocolFacts';
import { ProtocolVerdictBanner } from './ProtocolVerdictBanner';
import type { HandoverProtocolRecordState } from './use-handover-protocol-verification';

function StandingValue({ standing }: { readonly standing: HandoverProtocolStanding }) {
  const { t } = useTranslation('legal');
  switch (standing.kind) {
    case 'current':
      return <strong>{t('handoverVerify.record.current')}</strong>;
    case 'superseded':
      return <strong>{t('handoverVerify.record.superseded', { latest: standing.latestRevision })}</strong>;
    case 'undetermined':
      return <strong>{t('handoverVerify.record.undetermined')}</strong>;
  }
}

export function ProtocolRecordView({ protocolId, state }: { readonly protocolId: string; readonly state: HandoverProtocolRecordState }) {
  const { t } = useTranslation('legal');
  if (state.phase === 'loading') return <ProtocolVerdictBanner tone="working" title={t('handoverVerify.record.loading')} />;
  if (state.phase === 'unavailable') {
    return state.reason === 'rate-limited'
      ? <ProtocolVerdictBanner tone="neutral" title={t('handoverVerify.unavailable.rateLimited.title')} body={t('handoverVerify.unavailable.rateLimited.body')} />
      : <ProtocolVerdictBanner tone="neutral" title={t('handoverVerify.unavailable.unreachable.title')} body={t('handoverVerify.unavailable.unreachable.body')} />;
  }
  const { registry } = state;
  if (registry.kind === 'unknown') {
    return <ProtocolVerdictBanner tone="refuted" title={t('handoverVerify.verdict.notRegistered.title')} body={t('handoverVerify.verdict.notRegistered.body')} />;
  }
  return (
    <ProtocolVerdictBanner tone="neutral" title={t('handoverVerify.record.title')} body={t('handoverVerify.record.compare')}>
      <ProtocolRegistryFacts protocolId={protocolId} registry={registry}>
        <ProtocolFact term={t('handoverVerify.record.standing')}>
          <StandingValue standing={registry.standing} />
        </ProtocolFact>
      </ProtocolRegistryFacts>
    </ProtocolVerdictBanner>
  );
}
