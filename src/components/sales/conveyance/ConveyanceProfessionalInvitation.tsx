'use client';

/**
 * =============================================================================
 * Η πρόσκληση με email μιας θέσης — κατάσταση και πράξεις (ADR-901 Φ3 · Ε-5)
 * =============================================================================
 *
 * Επαγγελματίας **χωρίς λογαριασμό** ⇒ η θέση δείχνει την **πρόσκληση** αντί για συμμετοχή: εστάλη πότε, ανοίχτηκε
 * ή όχι («ένδειξη, όχι απόδειξη»), λήγει πότε, υπενθυμίστηκε πότε. Πράξεις: **αποστολή** · **επαναποστολή με ένα
 * πάτημα** · **ακύρωση** (με επιβεβαίωση).
 *
 * ⚠️ Κάθε υπο-κομμάτι καλεί **μόνο του** `useTranslation` — κανένα `t` ως prop.
 *
 * @module components/sales/conveyance/ConveyanceProfessionalInvitation
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { formatDate } from '@/lib/intl-utils';
import type { CaseProfessionalSlot } from '@/types/conveyance-case';
import type { CaseInvitationSummary } from '@/types/engagement-invitation';
import { INVITATION_STATE_PRESENTATION } from './conveyance-presentation';

/** Η πρόσκληση της θέσης: σήμα κατάστασης + email + ημερομηνίες. */
export function InvitationStatusLine({ invitation }: { readonly invitation: CaseInvitationSummary }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const presentation = INVITATION_STATE_PRESENTATION[invitation.state];
  const Icon = presentation.icon;
  const pending = invitation.state === 'pending';
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs">
      <Badge variant={presentation.variant} className="gap-1">
        <Icon className={iconSizes.xs} aria-hidden="true" />
        {t(`engagement.invitation.states.${invitation.state}`)}
      </Badge>
      <span className={colors.text.muted}>{invitation.inviteeEmail}</span>
      <span className={colors.text.muted}>{t('engagement.invitation.sentOn', { date: formatDate(invitation.sentAt) })}</span>
      {pending && (
        <span className={colors.text.muted}>
          {invitation.openedAt
            ? t('engagement.invitation.openedOn', { date: formatDate(invitation.openedAt) })
            : t('engagement.invitation.notOpened')}
        </span>
      )}
      {pending && <span className={colors.text.muted}>{t('engagement.invitation.expiresOn', { date: formatDate(invitation.expiresAt) })}</span>}
      {pending && invitation.reminderSentAt && (
        <span className={colors.text.muted}>{t('engagement.invitation.remindedOn', { date: formatDate(invitation.reminderSentAt) })}</span>
      )}
    </p>
  );
}

interface InvitationButtonsProps {
  readonly slot: CaseProfessionalSlot;
  readonly busy: boolean;
  readonly onSend: (slot: CaseProfessionalSlot) => void;
  readonly onCancel: (slot: CaseProfessionalSlot) => void;
}

/** Οι πράξεις της πρόσκλησης — εκκρεμής ⇒ επαναποστολή + ακύρωση· αλλιώς (καμία/έληξε/ακυρώθηκε/αρνήθηκε) ⇒ αποστολή. */
export function InvitationButtons({ slot, busy, onSend, onCancel }: InvitationButtonsProps) {
  const { t } = useTranslation(['conveyance']);
  if (slot.invitation?.state === 'pending') {
    return (
      <span className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => onSend(slot)}>
          {busy ? t('engagement.invitation.actions.sending') : t('engagement.invitation.actions.resend')}
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onCancel(slot)}>
          {t('engagement.invitation.actions.cancel')}
        </Button>
      </span>
    );
  }
  return (
    <Button size="sm" disabled={busy} onClick={() => onSend(slot)}>
      {busy ? t('engagement.invitation.actions.sending') : t('engagement.invitation.actions.send')}
    </Button>
  );
}
