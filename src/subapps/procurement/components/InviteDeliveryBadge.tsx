'use client';

/**
 * **Η κατάσταση παράδοσης μιας πρόσκλησης** στον πίνακα του αγοραστή (ADR-923 §5.13 Τ5).
 *
 * 🔑 Κείμενο **και** εικονίδιο σε κάθε κατάσταση: το χρώμα του `Badge` είναι τρίτο κανάλι, ποτέ το μόνο (WCAG 1.4.1).
 * 🔒 Κανένας παραλήπτης εδώ: η κρίση `inviteDeliveryDisplay` δεν έχει διεύθυνση να δώσει.
 *
 * @module subapps/procurement/components/InviteDeliveryBadge
 */

import type { LucideIcon } from 'lucide-react';
import { Ban, CalendarClock, CircleCheck, CircleHelp, CircleX, Clock, RotateCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { BadgeVariantProps } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import type { InviteUndeliverableReason, VendorInviteDelivery } from '../types/vendor-invite-delivery';
import { inviteDeliveryDisplay, type InviteDeliveryDisplayStatus } from '../utils/invite-delivery-display';

const VARIANTS: Readonly<Record<InviteDeliveryDisplayStatus, BadgeVariantProps['variant']>> = {
  queued: 'outline',
  sent: 'success',
  retrying: 'warning',
  deferred: 'info',
  failed: 'destructive',
  notSent: 'muted',
  unknown: 'secondary',
};

const ICONS: Readonly<Record<InviteDeliveryDisplayStatus, LucideIcon>> = {
  queued: Clock,
  sent: CircleCheck,
  retrying: RotateCw,
  deferred: CalendarClock,
  failed: CircleX,
  notSent: Ban,
  unknown: CircleHelp,
};

// Τα κλειδιά γραμμένα κυριολεκτικά (ADR-744), ώστε οι πύλες i18n να τα βλέπουν· `Record` ⇒ καμία κατάσταση χωρίς λέξη.
const STATUS_KEYS: Readonly<Record<InviteDeliveryDisplayStatus, string>> = {
  queued: 'invites.delivery.statuses.queued',
  sent: 'invites.delivery.statuses.sent',
  retrying: 'invites.delivery.statuses.retrying',
  deferred: 'invites.delivery.statuses.deferred',
  failed: 'invites.delivery.statuses.failed',
  notSent: 'invites.delivery.statuses.notSent',
  unknown: 'invites.delivery.statuses.unknown',
};

const REASON_KEYS: Readonly<Record<InviteUndeliverableReason, string>> = {
  no_recipient: 'invites.delivery.reasons.no_recipient',
  rfq_closed: 'invites.delivery.reasons.rfq_closed',
  invite_closed: 'invites.delivery.reasons.invite_closed',
  recipient_quota: 'invites.delivery.reasons.recipient_quota',
};

export function InviteDeliveryBadge({ delivery }: { delivery: VendorInviteDelivery | undefined }) {
  const { t } = useTranslation('quotes');
  const display = inviteDeliveryDisplay(delivery);
  if (display === null) return null;
  const Icon = ICONS[display.status];
  return (
    <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
      <Badge variant={VARIANTS[display.status]}>
        <Icon className="mr-1 h-3 w-3 shrink-0" aria-hidden="true" />
        {t(STATUS_KEYS[display.status])}
      </Badge>
      {display.reason !== null && <span>{t(REASON_KEYS[display.reason])}</span>}
    </p>
  );
}
