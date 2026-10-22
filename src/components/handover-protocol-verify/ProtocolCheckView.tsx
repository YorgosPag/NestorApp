'use client';

/**
 * @fileoverview **Η όψη του ελέγχου ενός αρχείου** — κάθε κατάσταση του `useHandoverProtocolCheck` σε λέξη
 *               (ADR-916 Φ-Γ2 Σ6).
 * @module components/handover-protocol-verify/ProtocolCheckView
 *
 * 🔴 «Επαληθευμένο» **μόνο** στο `verdict.kind === 'verified'`. Γνήσιο αλλά παλιό ή αβέβαιο λέει **ποιο** από τα δύο.
 * 🔑 Ρητές κλήσεις `t('…')` ανά κλάδο: ο σαρωτής του route slice (ADR-744) δεν βλέπει αναζητήσεις σε χάρτη.
 */

import React from 'react';
import { ShieldAlert, ShieldQuestion } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { HandoverProtocolManifest } from '@/lib/property-handover/handover-protocol-manifest-parse';
import type { HandoverProtocolVerdict } from '@/lib/property-handover/handover-protocol-verification';

import { ProtocolManifestFacts } from './ProtocolFacts';
import { ProtocolVerdictBanner } from './ProtocolVerdictBanner';
import type { ProtocolLocalRefusal } from './protocol-local-read';
import type { ProtocolRegistryUnavailable } from './protocol-registry-client';
import type { HandoverProtocolCheckState } from './use-handover-protocol-verification';

/** Τι δείχνει η σελίδα κάτω από γνήσιο Πρωτόκολλο (ο έλεγχος πακέτου) — ο οικοδεσπότης το αποφασίζει. */
export type GenuineProtocolSlot = (manifest: HandoverProtocolManifest) => React.ReactNode;

function RefusedBanner({ reason }: { readonly reason: ProtocolLocalRefusal }) {
  const { t } = useTranslation('legal');
  switch (reason) {
    case 'too-large':
      return <ProtocolVerdictBanner tone="refuted" title={t('handoverVerify.refused.tooLarge.title')} body={t('handoverVerify.refused.tooLarge.body')} />;
    case 'not-pdf':
      return <ProtocolVerdictBanner tone="refuted" title={t('handoverVerify.refused.notPdf.title')} body={t('handoverVerify.refused.notPdf.body')} />;
    case 'no-manifest':
      return <ProtocolVerdictBanner tone="refuted" title={t('handoverVerify.refused.noManifest.title')} body={t('handoverVerify.refused.noManifest.body')} />;
    case 'manifest-invalid':
      return <ProtocolVerdictBanner tone="refuted" title={t('handoverVerify.refused.manifestInvalid.title')} body={t('handoverVerify.refused.manifestInvalid.body')} />;
  }
}

function UnavailableBanner({ reason }: { readonly reason: ProtocolRegistryUnavailable }) {
  const { t } = useTranslation('legal');
  return reason === 'rate-limited'
    ? <ProtocolVerdictBanner tone="neutral" title={t('handoverVerify.unavailable.rateLimited.title')} body={t('handoverVerify.unavailable.rateLimited.body')} />
    : <ProtocolVerdictBanner tone="neutral" title={t('handoverVerify.unavailable.unreachable.title')} body={t('handoverVerify.unavailable.unreachable.body')} />;
}

function VerdictBanner({ verdict, genuine }: { readonly verdict: HandoverProtocolVerdict; readonly genuine?: GenuineProtocolSlot }) {
  const { t } = useTranslation('legal');
  switch (verdict.kind) {
    case 'verified':
      return (
        <ProtocolVerdictBanner tone="verified" title={t('handoverVerify.verdict.verified.title')} body={t('handoverVerify.verdict.verified.body')}>
          <ProtocolManifestFacts manifest={verdict.manifest} />
          {genuine?.(verdict.manifest)}
        </ProtocolVerdictBanner>
      );
    case 'superseded':
      return (
        <ProtocolVerdictBanner tone="caution" title={t('handoverVerify.verdict.superseded.title')} body={t('handoverVerify.verdict.superseded.body', { latest: verdict.latestRevision })}>
          <ProtocolManifestFacts manifest={verdict.manifest} />
          {genuine?.(verdict.manifest)}
        </ProtocolVerdictBanner>
      );
    case 'genuine-standing-undetermined':
      return (
        <ProtocolVerdictBanner tone="caution" icon={ShieldQuestion} title={t('handoverVerify.verdict.undetermined.title')} body={t('handoverVerify.verdict.undetermined.body')}>
          <ProtocolManifestFacts manifest={verdict.manifest} />
          {genuine?.(verdict.manifest)}
        </ProtocolVerdictBanner>
      );
    case 'altered':
      return <ProtocolVerdictBanner tone="refuted" icon={ShieldAlert} title={t('handoverVerify.verdict.altered.title')} body={t('handoverVerify.verdict.altered.body')} />;
    case 'not-registered':
      return <ProtocolVerdictBanner tone="refuted" title={t('handoverVerify.verdict.notRegistered.title')} body={t('handoverVerify.verdict.notRegistered.body')} />;
    case 'other-protocol':
      return <ProtocolVerdictBanner tone="refuted" icon={ShieldAlert} title={t('handoverVerify.verdict.otherProtocol.title')} body={t('handoverVerify.verdict.otherProtocol.body')} />;
  }
}

/** **Μία** κατάσταση ελέγχου στην οθόνη — `idle` ⇒ τίποτα (ο επιλογέας αρχείου μιλά μόνος του). */
export function ProtocolCheckView({ state, genuine }: { readonly state: HandoverProtocolCheckState; readonly genuine?: GenuineProtocolSlot }) {
  const { t } = useTranslation('legal');
  switch (state.phase) {
    case 'idle':
      return null;
    case 'reading':
      return <ProtocolVerdictBanner tone="working" title={t('handoverVerify.progress.reading', { name: state.fileName })} />;
    case 'asking':
      return <ProtocolVerdictBanner tone="working" title={t('handoverVerify.progress.asking')} />;
    case 'refused':
      return <RefusedBanner reason={state.reason} />;
    case 'inconsistent':
      return <ProtocolVerdictBanner tone="refuted" icon={ShieldAlert} title={t('handoverVerify.inconsistent.title')} body={t('handoverVerify.inconsistent.body')} />;
    case 'unavailable':
      return <UnavailableBanner reason={state.reason} />;
    case 'judged':
      return <VerdictBanner verdict={state.verdict} genuine={genuine} />;
  }
}
