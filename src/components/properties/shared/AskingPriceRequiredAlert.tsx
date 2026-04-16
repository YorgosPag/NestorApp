'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: Asking Price Required Alert (SSoT inline message)
 * =============================================================================
 *
 * Inline Alert που ενημερώνει τον χρήστη ότι η επιλεγμένη `commercialStatus`
 * (for-sale / for-rent / for-sale-and-rent) απαιτεί δήλωση `askingPrice`.
 *
 * **SSoT**: Η λίστα των καταστάσεων που απαιτούν τιμή προέρχεται αποκλειστικά
 * από το `requiresAskingPrice()` στο `@/constants/commercial-statuses`. Καμία
 * duplicated λίστα — αν προστεθεί νέα κατάσταση που απαιτεί τιμή, ο helper
 * είναι το μοναδικό σημείο αλλαγής.
 *
 * **Reuse**: Χρησιμοποιείται τόσο από το `AddPropertyDialog` (creation flow)
 * όσο και από το `PropertyFieldsEditForm` (edit flow) για ομοιόμορφο UX.
 *
 * @module components/properties/shared/AskingPriceRequiredAlert
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { requiresAskingPrice } from '@/constants/commercial-statuses';
import type { CommercialStatus } from '@/constants/commercial-statuses';

interface AskingPriceRequiredAlertProps {
  /** Τρέχουσα εμπορική κατάσταση του ακινήτου (ή undefined αν δεν έχει επιλεγεί). */
  readonly commercialStatus: CommercialStatus | string | undefined;
  /**
   * Τρέχουσα ζητούμενη τιμή. Αν είναι `undefined`, η ειδοποίηση εμφανίζεται
   * πάντα όταν η κατάσταση απαιτεί τιμή (creation flow — το πεδίο δεν υπάρχει).
   * Αν είναι αριθμός/string, η ειδοποίηση εμφανίζεται μόνο όταν ο χρήστης δεν
   * έχει δηλώσει τιμή (0 ή κενό) — edit flow.
   */
  readonly askingPrice?: number | string | null;
  /** Επιπλέον className για fine-tuning spacing από το parent. */
  readonly className?: string;
}

function isAskingPriceMissing(value: number | string | null | undefined): boolean {
  if (value === undefined) return true;
  if (value === null) return true;
  if (typeof value === 'number') return value <= 0;
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  const numeric = Number(trimmed);
  return !Number.isFinite(numeric) || numeric <= 0;
}

export function AskingPriceRequiredAlert({
  commercialStatus,
  askingPrice,
  className,
}: AskingPriceRequiredAlertProps) {
  const { t } = useTranslation(['properties', 'properties-detail']);
  const iconSizes = useIconSizes();

  if (!requiresAskingPrice(commercialStatus)) return null;
  if (askingPrice !== undefined && !isAskingPriceMissing(askingPrice)) return null;

  return (
    <Alert className={className}>
      <Info className={iconSizes.sm} />
      <AlertTitle>{t('alerts.askingPriceRequired.title')}</AlertTitle>
      <AlertDescription>
        {t('alerts.askingPriceRequired.description')}
      </AlertDescription>
    </Alert>
  );
}
