'use client';

/**
 * **Η παράδοση μιας πρόσκλησης, όπως τη βλέπει ο αγοραστής** (ADR-923 §5.13 Τ5): σε αναμονή · στάλθηκε · άγνωστη έκβαση ·
 * απέτυχε.
 *
 * Το καθολικό (`delivery`) έχει έξι καταστάσεις· ο άνθρωπος χρειάζεται τέσσερις (`inviteDeliveryDisplay`). Στην αποτυχία
 * λέγεται **γιατί** (ονομασμένος λόγος, ποτέ το κείμενο του παρόχου — βλ. `INVITE_DELIVERY_ERROR_CODES`).
 * 🔑 Λ1β Χ3: το `unknown` **δεν** λέγεται «απέτυχε» (ίσως έφτασε — ένα «απέτυχε» σπρώχνει σε δεύτερο email)· και για χώρο της
 *    πλατφόρμας δεν λέμε «αντιγράψτε τον σύνδεσμο», γιατί ο αγοραστής δεν ξέρει τη διεύθυνση.
 * Πρόσκληση χωρίς καθολικό (χειρόγραφη, παλιά) ⇒ τίποτα: η κατάστασή της τη λέει ήδη το `StatusBadge`.
 *
 * @module subapps/procurement/components/VendorInviteDeliveryBadge
 */

import { Badge } from '@/components/ui/badge';
import type { BadgeVariantProps } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import type { VendorInvite } from '../types/vendor-invite';
import { inviteDeliveryDisplay, type InviteDeliveryDisplay, type VendorInviteDelivery } from '../types/vendor-invite-delivery';

const DELIVERY_VARIANTS: Record<InviteDeliveryDisplay, BadgeVariantProps['variant']> = {
  pending: 'outline',
  delivered: 'success',
  uncertain: 'warning',
  failed: 'destructive',
};

type Translate = ReturnType<typeof useTranslation>['t'];

/** Η εξήγηση κάτω από το σήμα — μόνο για `uncertain` και `failed`. Κλειδιά γραμμένα ρητά: τα λύνει στατικά το CHECK 3.34. */
function hintText(t: Translate, display: InviteDeliveryDisplay, delivery: VendorInviteDelivery): string | null {
  if (display === 'uncertain') return t('invites.delivery.uncertainHint');
  if (display !== 'failed') return null;
  if (delivery.reason) return t(`invites.delivery.reasons.${delivery.reason}`);
  return delivery.recipientKind === 'platform' ? t('invites.delivery.failedHintPlatform') : t('invites.delivery.failedHint');
}

export function VendorInviteDeliveryBadge({ delivery }: { delivery: VendorInvite['delivery'] }) {
  const { t } = useTranslation('quotes');
  const display = inviteDeliveryDisplay(delivery);
  if (display === null || delivery === undefined) return null;
  const hint = hintText(t, display, delivery);
  return (
    <span className="flex flex-col items-start gap-0.5">
      <Badge variant={DELIVERY_VARIANTS[display]}>
        <span className="sr-only">{t('invites.delivery.label')}: </span>
        {t(`invites.delivery.${display}`)}
      </Badge>
      {hint !== null && <span className="text-xs text-muted-foreground">{hint}</span>}
    </span>
  );
}
