'use client';

/**
 * =============================================================================
 * «Επαγγελματίες και πρόσβαση» — οι τρεις θέσεις της υπόθεσης (ADR-901 Φ2 · ADR-862 Φ1)
 * =============================================================================
 *
 * Μία γραμμή ανά θέση (δικηγόρος πωλητή · δικηγόρος αγοραστή · συμβολαιογράφος), με την **αλυσίδα** ορατή:
 * ορίστηκε; → έχει λογαριασμό; → προτάθηκε; → ανέλαβε; Κάθε κρίκος που λείπει λέει **τι κάνει ο άνθρωπος**,
 * ποτέ σιωπηλό κενό (ADR-901 §2.2 Κ-2).
 *
 * - Πρόταση σε ρόλο που βλέπει έγγραφα του αγοραστή ⇒ **διάλογος συναίνεσης** (§5.2) — και πριν από **πρόσκληση**
 * - Χωρίς λογαριασμό ⇒ **πρόσκληση με email**: αποστολή · επαναποστολή με ένα πάτημα · ακύρωση (ADR-901 Φ3 · Ε-5)
 * - Απόσυρση / ανάκληση ⇒ επιβεβαίωση — **άμεση**, ειπωμένη, με ίχνος (ADR-787 Ε-2 §5)
 *
 * @module components/sales/conveyance/ConveyanceProfessionalsAccess
 */

import React, { useCallback, useState } from 'react';
import { Briefcase } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useNotifications } from '@/providers/NotificationProvider';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useCaseProfessionals, type ProfessionalActionOutcome } from '@/hooks/useCaseProfessionals';
import { formatDate } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import type { CaseProfessionalSlot } from '@/types/conveyance-case';
import type { ConsentBasis } from '@/types/engagement';
import type { LegalProfessionalRole } from '@/types/legal-contracts';
import { ENGAGEMENT_STATE_PRESENTATION } from './conveyance-presentation';
import { ConveyanceEngagementConsentDialog } from './ConveyanceEngagementConsentDialog';
import { DeclaredCredentialLine } from '@/components/conveyance/shared/DeclaredCredentialLine';
import { InvitationButtons, InvitationStatusLine } from './ConveyanceProfessionalInvitation';

interface SlotActions {
  readonly canManage: boolean;
  readonly busy: boolean;
  readonly onOffer: (slot: CaseProfessionalSlot) => void;
  readonly onEnd: (slot: CaseProfessionalSlot) => void;
  readonly onCancelInvitation: (slot: CaseProfessionalSlot) => void;
}

/** Η κατάσταση της θέσης: συμμετοχή αν υπάρχει, αλλιώς ο κρίκος της αλυσίδας που λείπει. */
function SlotStatus({ slot }: { readonly slot: CaseProfessionalSlot }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const engagement = slot.engagement;
  if (!engagement) {
    if (slot.invitation) return <InvitationStatusLine invitation={slot.invitation} />;
    if (slot.appointment === 'account') return null;
    return <p className={cn('text-xs', colors.text.muted)}>{t(`engagement.appointment.${slot.appointment}`)}</p>;
  }
  const presentation = ENGAGEMENT_STATE_PRESENTATION[engagement.state];
  const Icon = presentation.icon;
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs">
      <Badge variant={presentation.variant} className="gap-1">
        <Icon className={iconSizes.xs} aria-hidden="true" />
        {t(`engagement.states.${engagement.state}`)}
      </Badge>
      <span className={colors.text.muted}>{engagement.email}</span>
      <span className={colors.text.muted}>{t('engagement.offeredOn', { date: formatDate(engagement.offeredAt) })}</span>
      {engagement.declaredCredential && <DeclaredCredentialLine credential={engagement.declaredCredential} />}
    </p>
  );
}

function SlotButtons({ slot, canManage, busy, onOffer, onEnd, onCancelInvitation }: SlotActions & { readonly slot: CaseProfessionalSlot }) {
  const { t } = useTranslation(['conveyance']);
  if (!canManage) return null;
  const state = slot.engagement?.state;
  if (state === 'offered' || state === 'active') {
    return (
      <Button size="sm" variant="outline" disabled={busy} onClick={() => onEnd(slot)}>
        {t(state === 'active' ? 'engagement.actions.revoke' : 'engagement.actions.withdraw')}
      </Button>
    );
  }
  if (slot.appointment === 'needs-invitation') {
    return <InvitationButtons slot={slot} busy={busy} onSend={onOffer} onCancel={onCancelInvitation} />;
  }
  if (slot.appointment !== 'account') return null;
  return (
    <Button size="sm" disabled={busy} onClick={() => onOffer(slot)}>
      {busy ? t('engagement.actions.offering') : t('engagement.actions.offer')}
    </Button>
  );
}

function SlotRow(props: SlotActions & { readonly slot: CaseProfessionalSlot }) {
  const { t } = useTranslation(['conveyance']);
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 border-t py-2 first:border-t-0">
      <article className="min-w-0 space-y-1">
        <h4 className="text-sm font-medium">{t(`engagement.roles.${props.slot.role}`)}</h4>
        <SlotStatus slot={props.slot} />
      </article>
      <SlotButtons {...props} />
    </li>
  );
}

/** Τα αποτελέσματα των πράξεων → μήνυμα. Η επιτυχία φαίνεται στη γραμμή· η άρνηση λέγεται με όνομα. */
function useReport() {
  const { t } = useTranslation(['conveyance']);
  const { error: notifyError, success: notifySuccess } = useNotifications();
  return useCallback((outcome: ProfessionalActionOutcome) => {
    if (!outcome.ok) notifyError(t(`engagement.rejections.${outcome.rejection}`));
    // ADR-901 Φ3 — η αποστολή του email λέγεται **ονομαστικά**: «δεν έφυγε» ≠ σιωπή.
    else if (outcome.invited === 'accepted') notifySuccess(t('engagement.invitation.delivery.accepted'));
    else if (outcome.invited) notifyError(t(`engagement.invitation.delivery.${outcome.invited}`));
  }, [notifyError, notifySuccess, t]);
}

interface ConveyanceProfessionalsAccessProps {
  readonly caseId: string;
  readonly canManage: boolean;
  /** ADR-901 §14.8 — η αναθεώρηση της όψης του οικοδεσπότη: ανεβαίνει ⇒ οι θέσεις ξαναδιαβάζονται (ζωντανές). */
  readonly viewRevision: number;
}

export function ConveyanceProfessionalsAccess({ caseId, canManage, viewRevision }: ConveyanceProfessionalsAccessProps) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const report = useReport();
  const { slots, failed, pending, offer, end, cancelInvitation } = useCaseProfessionals(caseId, viewRevision);
  const [consentRole, setConsentRole] = useState<LegalProfessionalRole | null>(null);
  const [ending, setEnding] = useState<CaseProfessionalSlot | null>(null);
  const [cancelling, setCancelling] = useState<CaseProfessionalSlot | null>(null);

  const onOffer = useCallback((slot: CaseProfessionalSlot) => {
    if (slot.requiresAttestation) setConsentRole(slot.role);
    else void offer(slot.role, null).then(report);
  }, [offer, report]);
  const onConsent = useCallback((role: LegalProfessionalRole, basis: ConsentBasis) => {
    setConsentRole(null);
    void offer(role, basis).then(report);
  }, [offer, report]);
  const onConfirmEnd = useCallback(() => {
    const slot = ending;
    setEnding(null);
    if (slot?.engagement) void end(slot.role, slot.engagement.engagementId).then(report);
  }, [end, ending, report]);
  const onConfirmCancel = useCallback(() => {
    const slot = cancelling;
    setCancelling(null);
    if (slot) void cancelInvitation(slot.role).then(report);
  }, [cancelInvitation, cancelling, report]);

  return (
    <section className="space-y-2 rounded-lg border bg-card p-3" aria-labelledby="conveyance-professionals-title">
      <header className="flex items-center gap-2">
        <Briefcase className={cn(iconSizes.sm, colors.text.muted)} aria-hidden="true" />
        <h3 id="conveyance-professionals-title" className="text-sm font-semibold">{t('engagement.section.title')}</h3>
      </header>
      <p className={cn('text-xs', colors.text.muted)}>{t('engagement.section.hint')}</p>
      {failed && <p className={cn('text-xs', colors.text.error)}>{t('engagement.rejections.generic')}</p>}
      <ul>
        {slots.map((slot) => (
          <SlotRow
            key={slot.role}
            slot={slot}
            canManage={canManage}
            busy={pending.has(slot.role)}
            onOffer={onOffer}
            onEnd={setEnding}
            onCancelInvitation={setCancelling}
          />
        ))}
      </ul>
      <ConveyanceEngagementConsentDialog role={consentRole} busy={false} onCancel={() => setConsentRole(null)} onConfirm={onConsent} />
      <ConfirmDialog
        open={ending !== null}
        onOpenChange={(open) => { if (!open) setEnding(null); }}
        title={t(ending?.engagement?.state === 'active' ? 'engagement.endConfirm.revokeTitle' : 'engagement.endConfirm.withdrawTitle')}
        description={t('engagement.endConfirm.description')}
        confirmText={t('engagement.endConfirm.confirm')}
        cancelText={t('engagement.endConfirm.cancel')}
        variant="destructive"
        onConfirm={onConfirmEnd}
      />
      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => { if (!open) setCancelling(null); }}
        title={t('engagement.invitation.cancelConfirm.title')}
        description={t('engagement.invitation.cancelConfirm.description')}
        confirmText={t('engagement.endConfirm.confirm')}
        cancelText={t('engagement.endConfirm.cancel')}
        variant="destructive"
        onConfirm={onConfirmCancel}
      />
    </section>
  );
}
