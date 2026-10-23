'use client';

/**
 * @fileoverview **Μία παράδοση, ένας αγοραστής** — ποιος κινείται, γιατί, τα βήματα, τα γεγονότα και το σφραγισμένο
 *   Πρωτόκολλο (ADR-916 §5.15 Φ-Δ).
 * @related PropertyHandoverView.tsx (η λίστα) · HandoverStepTrack.tsx · property-dossier/PropertyDossierProtocol.tsx
 *          (η **ίδια** κάρτα Πρωτοκόλλου με την πλευρά αγοραστή, με το αντίτυπο **εταιρείας**)
 * @module components/property-handover-office/HandoverEntryCard
 *
 * 🔒 Λέει «Σφραγίστηκε» — **ποτέ** «Επαληθευμένο»: επαλήθευση κάνει μόνο η δημόσια πόρτα (Σ6), στην οποία παραπέμπει.
 * 🔒 Από τον αγοραστή δείχνει **μόνο** ονοματεπώνυμο — ποτέ email · τηλέφωνο · ΑΦΜ.
 */

import React from 'react';
import { ShieldCheck } from 'lucide-react';

import { PropertyDossierProtocolCard } from '@/components/property-dossier/PropertyDossierProtocol';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import type { HandoverInvitationRenewalActions } from '@/hooks/property-handover/useHandoverInvitationRenewal';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import { handoverProtocolVerifyHref } from '@/lib/routes/legalRoutes';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/workspace/navigation';
import type { PropertyHandover, PropertyHandoverOfficeEntry } from '@/types/property-handover';

import { HANDOVER_MOVE_PRESENTATION } from './handover-office-presentation';
import { HandoverInvitationRenewal } from './HandoverInvitationRenewal';
import { HandoverStepTrack } from './HandoverStepTrack';

const K = 'properties-detail:handover';

/** Τα γεγονότα της παράδοσης — μόνο όσα έχουν συμβεί (κανένα «—»). */
function factsOf(handover: PropertyHandover): readonly { readonly key: string; readonly value: string }[] {
  const link = handover.invitation?.status === 'issued' ? handover.invitation : null;
  const facts: { key: string; value: string }[] = [];
  if (link) facts.push({ key: 'invitedAt', value: formatDate(link.issuedAt) });
  if (link && handover.recipient === null) facts.push({ key: 'expiresAt', value: formatDate(link.expiresAt) });
  if (handover.recipient) facts.push({ key: 'acceptedAt', value: formatDate(handover.recipient.acceptedAt) });
  if (handover.completion) facts.push({ key: 'completedAt', value: formatDate(handover.completion.at) });
  return facts;
}

function HandoverFacts({ handover }: { readonly handover: PropertyHandover }): React.ReactElement | null {
  const { t } = useTranslation(['properties-detail']);
  const facts = factsOf(handover);
  const delivery = handover.fileDelivery;
  if (facts.length === 0 && delivery === null) return null;
  return (
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      {facts.map(({ key, value }) => (
        <React.Fragment key={key}>
          <dt className="text-muted-foreground">{t(`${K}.facts.${key}`)}</dt>
          <dd className="m-0 text-foreground">{value}</dd>
        </React.Fragment>
      ))}
      {delivery !== null && (
        <>
          <dt className="text-muted-foreground">{t(`${K}.facts.files`)}</dt>
          <dd className="m-0 text-foreground">{t(`${K}.facts.filesValue`, { delivered: delivery.delivered, total: delivery.total })}</dd>
        </>
      )}
    </dl>
  );
}

function HandoverSignals({ entry }: { readonly entry: PropertyHandoverOfficeEntry }): React.ReactElement | null {
  const { t } = useTranslation(['properties-detail']);
  const { handover, status } = entry;
  if (status.signals.length === 0) return null;
  const params = {
    date: handover.invitation?.status === 'issued' ? formatDate(handover.invitation.expiresAt) : '',
    count: handover.fileDelivery?.awaitingReview ?? 0,
  };
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-foreground">
      {status.signals.map((signal) => <li key={signal} data-signal={signal}>{t(`${K}.signal.${signal}`, params)}</li>)}
    </ul>
  );
}

function HandoverProtocol({ handover }: { readonly handover: PropertyHandover }): React.ReactElement | null {
  const { t } = useTranslation(['properties-detail']);
  const iconSizes = useIconSizes();
  const protocol = handover.protocol;
  if (protocol === null) return null;
  const summary = { revision: protocol.revision, issuedAt: protocol.issuedAt, fileId: protocol.companyFileId };
  return (
    <>
      <PropertyDossierProtocolCard protocol={summary} custody="company" />
      <Link href={handoverProtocolVerifyHref(protocol.protocolId)} target="_blank" rel="noopener noreferrer"
        className={cn('inline-flex w-fit items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium', COLOR_BRIDGE.action.secondary)}>
        <ShieldCheck className={iconSizes.sm} aria-hidden="true" />
        {t(`${K}.verify`)}
      </Link>
    </>
  );
}

interface HandoverEntryCardProps {
  readonly entry: PropertyHandoverOfficeEntry;
  /** Φ-Δ.3 — οι πράξεις του γραφείου (η γκαλερί δίνει προσομοιωμένες, η καρτέλα τις πραγματικές). */
  readonly actions: HandoverInvitationRenewalActions;
}

export function HandoverEntryCard({ entry, actions }: HandoverEntryCardProps): React.ReactElement {
  const { t } = useTranslation(['properties-detail']);
  const iconSizes = useIconSizes();
  const titleId = React.useId();
  const { handover, status } = entry;
  const { variant, Icon } = HANDOVER_MOVE_PRESENTATION[status.move];
  const hintParams = { count: handover.fileDelivery?.unverifiable ?? 0 };
  return (
    <Card asChild className="flex flex-col gap-3 p-4">
      <section aria-labelledby={titleId} data-reason={status.reason}>
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={titleId} className="m-0 text-base font-semibold text-foreground">{entry.recipientName ?? t(`${K}.unnamedBuyer`)}</h3>
          <Badge variant={variant} className="gap-1">
            <Icon className={iconSizes.xs} aria-hidden="true" />
            {t(`${K}.move.${status.move}`)}
          </Badge>
        </header>
        <p className="m-0 text-sm font-medium text-foreground">{t(`${K}.reason.${status.reason}.title`)}</p>
        <p className="m-0 text-sm text-muted-foreground">{t(`${K}.reason.${status.reason}.hint`, hintParams)}</p>
        <HandoverInvitationRenewal handoverId={handover.id} offer={status.renewal} actions={actions} />
        <HandoverSignals entry={entry} />
        <HandoverStepTrack steps={status.steps} />
        <HandoverFacts handover={handover} />
        <HandoverProtocol handover={handover} />
      </section>
    </Card>
  );
}
