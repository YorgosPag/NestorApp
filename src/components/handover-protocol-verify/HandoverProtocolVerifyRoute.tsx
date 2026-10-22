'use client';

/**
 * @fileoverview **Η δημόσια σελίδα επαλήθευσης Πρωτοκόλλου παράδοσης** — `/handover-protocol/verify[/{protocolId}]`
 *               (ADR-916 Φ-Γ2 Σ6).
 * @module components/handover-protocol-verify/HandoverProtocolVerifyRoute
 * @related lib/property-handover/handover-protocol-verification.ts · app/api/handover-protocols/[protocolId]/verification
 *
 * 🏆 Εκδότης + μητρώο (docs.gov.gr) · μόνο το hash στο δίκτυο (Blueink) · κατακερματισμός στη συσκευή (LiveVerify) — και
 *    πέρα από αυτούς: τρέχον ή αντικατεστημένο, έλεγχος **πακέτου** byte προς byte, και η ανεξάρτητη οδός δίπλα.
 * 🔑 Με `protocolId` (QR του χαρτιού): πρώτα η καταχώριση του μητρώου, μετά ο έλεγχος του PDF — που αρνείται ονομαστικά
 *    αρχείο **άλλου** πρωτοκόλλου. Άκυρος κωδικός ⇒ 404, ποτέ «κάποιο» πρωτόκολλο στη θέση του.
 */

import React from 'react';
import { notFound, useParams } from 'next/navigation';

import { ShellSurface } from '@/core/containers/ShellSurface';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { enterpriseIdFromRequest } from '@/services/enterprise-id-parse';
import { ENTERPRISE_ID_PREFIXES } from '@/services/enterprise-id-prefixes';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { decodeRouteParam } from '@/lib/routes/route-param';
import { cn } from '@/lib/utils';

import { ProtocolCheckView } from './ProtocolCheckView';
import { ProtocolFilePicker } from './ProtocolFilePicker';
import { ProtocolIndependentCheck } from './ProtocolIndependentCheck';
import { ProtocolPackageSection } from './ProtocolPackageSection';
import { ProtocolRecordView } from './ProtocolRecordView';
import { useHandoverProtocolCheck, useHandoverProtocolRecord } from './use-handover-protocol-verification';

/** Ο έλεγχος ενός PDF — επιλογέας όσο δεν υπάρχει ετυμηγορία, «έλεγχος άλλου» μετά. */
export function ProtocolCheckSection({ expectedProtocolId }: { readonly expectedProtocolId: string | null }) {
  const { t } = useTranslation('legal');
  const { state, check, reset } = useHandoverProtocolCheck(expectedProtocolId);
  const settled = state.phase !== 'idle' && state.phase !== 'reading' && state.phase !== 'asking';
  return (
    <>
      {state.phase === 'idle' && (
        <ProtocolFilePicker
          title={t('handoverVerify.pick.protocolTitle')}
          hint={t('handoverVerify.pick.protocolHint')}
          action={t('handoverVerify.pick.choose')}
          accept="application/pdf,.pdf"
          onFiles={(files) => void check(files[0])}
        />
      )}
      <ProtocolCheckView state={state} genuine={(manifest) => <ProtocolPackageSection manifest={manifest} />} />
      {settled && (
        <nav aria-label={t('handoverVerify.title')}>
          <button type="button" onClick={reset} className={cn('rounded-md px-3 py-1.5 text-sm font-medium', COLOR_BRIDGE.action.secondary)}>
            {t('handoverVerify.pick.another')}
          </button>
        </nav>
      )}
    </>
  );
}

function ProtocolRecordSection({ protocolId }: { readonly protocolId: string }) {
  const state = useHandoverProtocolRecord(protocolId);
  return <ProtocolRecordView protocolId={protocolId} state={state} />;
}

/** Το τμήμα `[protocolId]`, αν υπάρχει — έγκυρο `phpr_<uuid v4>` ή 404. */
function useRouteProtocolId(): string | null {
  const params = useParams<{ protocolId?: string }>();
  const raw = params?.protocolId;
  if (raw === undefined) return null;
  const protocolId = enterpriseIdFromRequest(decodeRouteParam(raw), ENTERPRISE_ID_PREFIXES.PROPERTY_HANDOVER_PROTOCOL);
  if (protocolId === null) notFound();
  return protocolId;
}

export function HandoverProtocolVerifyRoute() {
  const { t } = useTranslation('legal');
  const protocolId = useRouteProtocolId();
  return (
    <ShellSurface measure="prose">
      <article className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="m-0">{t('handoverVerify.title')}</h1>
          <p className="m-0">{t('handoverVerify.lead')}</p>
          <p className="m-0 text-sm text-muted-foreground">{t('handoverVerify.privacy')}</p>
        </header>
        {protocolId !== null && <ProtocolRecordSection protocolId={protocolId} />}
        <ProtocolCheckSection expectedProtocolId={protocolId} />
        <ProtocolIndependentCheck />
      </article>
    </ShellSurface>
  );
}
