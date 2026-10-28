'use client';

/**
 * Σήμα κατάστασης παραγγελίας (PO) — ΙΔΙΑ παραλλαγή με τις κάρτες λίστας/πλέγματος (`PO_STATUS_BADGE_VARIANTS`),
 * ΙΔΙΟ μετρημένο μελάνι (`Badge` → `SOLID_FILL_INK`, ADR-854 §3), ετικέτα από το i18n (`procurement:status.*`).
 *
 * 🔴 Ως τις 2026-10-28 η κεφαλίδα PO και η καρτέλα «Παραγγελίες» της επαφής είχαν η καθεμία δική της αντιστοίχιση
 * χρώματος, με γέμισμα **και** κείμενο από το ΙΔΙΟ token ⇒ άδειο χρωματιστό χάπι· και ετικέτα `label.el` ⇒ ελληνικά
 * και στην αγγλική διεπαφή (ADR-327 changelog 2026-10-28).
 */

import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PO_STATUS_BADGE_VARIANTS } from '@/domain/cards/po/po-card-model';
import type { PurchaseOrderStatus } from '@/types/procurement';

interface PurchaseOrderStatusBadgeProps {
  status: PurchaseOrderStatus;
  className?: string;
}

export function PurchaseOrderStatusBadge({ status, className }: PurchaseOrderStatusBadgeProps) {
  const { t } = useTranslation('procurement');
  return (
    <Badge variant={PO_STATUS_BADGE_VARIANTS[status]} className={className}>
      {t(`status.${status}`)}
    </Badge>
  );
}
