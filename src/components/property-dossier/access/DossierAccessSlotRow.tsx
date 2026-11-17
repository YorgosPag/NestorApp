'use client';

/**
 * @fileoverview **Μία θέση της πρόσβασης** (δικηγόρος · συμβολαιογράφος) — κατάσταση και πράξεις (ADR-916 Φ-Ε1 Σ4).
 * @module components/property-dossier/access/DossierAccessSlotRow
 * @related `components/sales/conveyance/ConveyanceProfessionalsAccess.tsx` (ο αδελφός της μεταβίβασης — ίδια παρουσίαση
 *          κατάστασης · πρόσκλησης · δηλωμένης ιδιότητας, από τα ΙΔΙΑ συστατικά)
 *
 * 🔑 **Η κατάσταση λέγεται από την κρίση (`verdict`), όχι από το πεδίο**: «ενεργή» στη βάση με περασμένη λήξη δείχνεται
 *    «Έληξε», με διέξοδο «Ανανέωση» ή «Ανάκληση» — η όψη ποτέ δεν συγκρίνει ημερομηνίες μόνη της.
 * 🔑 **Η πιο ζωντανή αλήθεια μπροστά**: εκκρεμής πρόσκληση > συμμετοχή > παλιά πρόσκληση > «κανείς».
 */

import React from 'react';

import { DeclaredCredentialLine } from '@/components/conveyance/shared/DeclaredCredentialLine';
import { ENGAGEMENT_STATE_PRESENTATION } from '@/components/sales/conveyance/conveyance-presentation';
import { InvitationStatusLine } from '@/components/sales/conveyance/ConveyanceProfessionalInvitation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-utils';
import type { FloorplanTabKind } from '@/lib/property-dossier/property-dossier-view';
import { cn } from '@/lib/utils';
import type { DossierAccessSlot, DossierEngagementSummary } from '@/types/dossier-access';
import { LIVE_ENGAGEMENT_STATES, type EngagementState } from '@/types/engagement';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { useDossierTabLabel } from './DossierAccessFields';

const K = 'property-market:dossier.access';

/** Η κατάσταση **όπως κρίνεται τώρα** — η λήξη και η ανάκληση από τον κριτή, αλλιώς το πεδίο. */
function presentedState(engagement: DossierEngagementSummary): EngagementState {
  if (engagement.verdict === 'expired' || engagement.verdict === 'unreadable-expiry') return 'expired';
  if (engagement.verdict === 'revoked') return 'revoked';
  return engagement.state;
}

/** Ζει ακόμη η συμμετοχή στη βάση; (και η ληγμένη-ενεργή — πιάνει τη θέση μέχρι ανανέωση ή ανάκληση) */
export function isLiveEngagement(engagement: DossierEngagementSummary | null): engagement is DossierEngagementSummary {
  return engagement !== null && LIVE_ENGAGEMENT_STATES.includes(engagement.state);
}

function ReachLine({ engagement, floorplanKind }: { readonly engagement: DossierEngagementSummary; readonly floorplanKind: FloorplanTabKind }) {
  const { t } = useTranslation(['property-market']);
  const colors = useSemanticColors();
  const tabLabel = useDossierTabLabel(floorplanKind);
  const excluded = engagement.reach.excludedFileIds.length;
  return (
    <span className={colors.text.muted}>
      {t(`${K}.reachLine`, { tabs: engagement.reach.tabs.map(tabLabel).join(' · ') })}
      {excluded > 0 && ` · ${t(`${K}.excludedCount`, { count: excluded })}`}
    </span>
  );
}

function EngagementLine({ engagement, floorplanKind }: { readonly engagement: DossierEngagementSummary; readonly floorplanKind: FloorplanTabKind }) {
  const { t } = useTranslation(['conveyance', 'property-market']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const state = presentedState(engagement);
  const presentation = ENGAGEMENT_STATE_PRESENTATION[state];
  const Icon = presentation.icon;
  const live = isLiveEngagement(engagement);
  return (
    <p className="m-0 flex flex-wrap items-center gap-2 text-xs">
      <Badge variant={presentation.variant} className="gap-1">
        <Icon className={iconSizes.xs} aria-hidden="true" />
        {t(`conveyance:engagement.states.${state}`)}
      </Badge>
      <span className={colors.text.muted}>{engagement.email}</span>
      {live && (
        <span className={colors.text.muted}>
          {t(state === 'expired' ? `${K}.expiredOn` : `${K}.expiresOn`, { date: formatDate(engagement.expiresAt) })}
        </span>
      )}
      {live && <ReachLine engagement={engagement} floorplanKind={floorplanKind} />}
      {engagement.declaredCredential && <DeclaredCredentialLine credential={engagement.declaredCredential} />}
    </p>
  );
}

function SlotStatus({ slot, floorplanKind }: { readonly slot: DossierAccessSlot; readonly floorplanKind: FloorplanTabKind }) {
  const { t } = useTranslation(['property-market']);
  const colors = useSemanticColors();
  if (slot.invitation?.state === 'pending') return <InvitationStatusLine invitation={slot.invitation} />;
  if (slot.engagement) return <EngagementLine engagement={slot.engagement} floorplanKind={floorplanKind} />;
  if (slot.invitation) return <InvitationStatusLine invitation={slot.invitation} />;
  return <p className={cn('m-0 text-xs', colors.text.muted)}>{t(`${K}.nobody`)}</p>;
}

/** Οι πράξεις της θέσης — ο καλών ανοίγει τον σωστό διάλογο. */
export interface DossierSlotActions {
  readonly busy: boolean;
  /** Αρχειοθετημένος φάκελος ⇒ καμία νέα πρόσκληση (η πόρτα θα απαντούσε 409). */
  readonly archived: boolean;
  readonly onInvite: (slot: DossierAccessSlot) => void;
  readonly onCancelInvitation: (slot: DossierAccessSlot) => void;
  readonly onRenew: (engagement: DossierEngagementSummary) => void;
  readonly onReach: (engagement: DossierEngagementSummary) => void;
  readonly onRevoke: (engagement: DossierEngagementSummary) => void;
}

function SlotButtons({ slot, busy, archived, onInvite, onCancelInvitation, onRenew, onReach, onRevoke }: DossierSlotActions & { readonly slot: DossierAccessSlot }) {
  const { t } = useTranslation(['property-market']);
  const engagement = slot.engagement;
  if (isLiveEngagement(engagement)) {
    return (
      <span className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => onRenew(engagement)}>{t(`${K}.actions.renew`)}</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onReach(engagement)}>{t(`${K}.actions.reach`)}</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onRevoke(engagement)}>{t(`${K}.actions.revoke`)}</Button>
      </span>
    );
  }
  const pending = slot.invitation?.state === 'pending';
  return (
    <span className="flex flex-wrap gap-2">
      <Button size="sm" disabled={busy || archived} onClick={() => onInvite(slot)}>
        {t(pending ? `${K}.actions.resend` : `${K}.actions.invite`)}
      </Button>
      {pending && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onCancelInvitation(slot)}>{t(`${K}.actions.cancelInvitation`)}</Button>
      )}
    </span>
  );
}

export function DossierAccessSlotRow(props: DossierSlotActions & { readonly slot: DossierAccessSlot; readonly floorplanKind: FloorplanTabKind }) {
  const { t } = useTranslation(['property-market']);
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 border-t border-border py-3 first:border-t-0">
      <article className="min-w-0 space-y-1">
        <h3 className="m-0 text-sm font-medium">{t(`${K}.roles.${props.slot.role}`)}</h3>
        <SlotStatus slot={props.slot} floorplanKind={props.floorplanKind} />
      </article>
      <SlotButtons {...props} />
    </li>
  );
}
