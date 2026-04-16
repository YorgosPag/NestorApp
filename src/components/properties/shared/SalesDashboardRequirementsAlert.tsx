'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: Sales Dashboard Requirements Alert (SSoT inline message)
 * =============================================================================
 *
 * Unified inline Alert που ενημερώνει τον χρήστη ότι η επιλεγμένη
 * `commercialStatus` (for-sale / for-rent / for-sale-and-rent) απαιτεί
 * συγκεκριμένα πεδία για να εμφανιστεί το ακίνητο σε sales/rental dashboards.
 *
 * **Unified UX**: Αντί για πολλαπλά consecutive alerts (ένα ανά πεδίο), ένα
 * μόνο Alert με δυναμική bulletlist των πεδίων που λείπουν. Λιγότερος οπτικός
 * θόρυβος όταν λείπουν πολλά requirements ταυτόχρονα.
 *
 * **SSoT**: Η λίστα των καταστάσεων που απαιτούν δεδομένα για sales dashboards
 * προέρχεται αποκλειστικά από το `LISTED_COMMERCIAL_STATUSES` μέσω
 * `requiresAskingPrice()` / `requiresNetArea()` helpers στο
 * `@/constants/commercial-statuses`. Καμία duplicated λίστα.
 *
 * **Reuse**: Creation flow (`AddPropertyDialog` — askingPrice undefined στο
 * form, net area ως `formData.area`) και edit flow (`PropertyFieldsEditForm` —
 * askingPrice + areaNet ή aggregated multi-level net).
 *
 * @module components/properties/shared/SalesDashboardRequirementsAlert
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 16)
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { requiresAskingPrice } from '@/constants/commercial-statuses';
import type { CommercialStatus } from '@/constants/commercial-statuses';

type NumericInput = number | string | null | undefined;

interface SalesDashboardRequirementsAlertProps {
  /** Τρέχουσα εμπορική κατάσταση του ακινήτου (ή undefined αν δεν έχει επιλεγεί). */
  readonly commercialStatus: CommercialStatus | string | undefined;
  /**
   * Τρέχουσα ζητούμενη τιμή. `undefined` σημαίνει "το field δεν υπάρχει στο
   * form" (creation flow) — ο alert τότε πάντα συμπεριλαμβάνει το askingPrice
   * ως missing. Αριθμός/string gated από `isMissingNumericValue()`.
   */
  readonly askingPrice?: NumericInput;
  /**
   * Τρέχον καθαρό εμβαδό. Ίδια σημασιολογία με `askingPrice`: `undefined`
   * (field απουσιάζει) vs value (gated).
   */
  readonly netArea?: NumericInput;
  /** Επιπλέον className για fine-tuning spacing από το parent. */
  readonly className?: string;
}

function isMissingNumericValue(value: NumericInput): boolean {
  if (value === undefined) return true;
  if (value === null) return true;
  if (typeof value === 'number') return value <= 0;
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  const numeric = Number(trimmed);
  return !Number.isFinite(numeric) || numeric <= 0;
}

export function SalesDashboardRequirementsAlert({
  commercialStatus,
  askingPrice,
  netArea,
  className,
}: SalesDashboardRequirementsAlertProps) {
  const { t } = useTranslation(['properties', 'properties-detail']);
  const iconSizes = useIconSizes();

  if (!requiresAskingPrice(commercialStatus)) return null;

  const missingAskingPrice = isMissingNumericValue(askingPrice);
  const missingNetArea = isMissingNumericValue(netArea);

  if (!missingAskingPrice && !missingNetArea) return null;

  return (
    <Alert
      className={cn(
        'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-700',
        className,
      )}
    >
      <AlertTriangle className={iconSizes.sm} />
      <AlertTitle>{t('alerts.salesDashboardRequirements.title')}</AlertTitle>
      <AlertDescription>
        <p>{t('alerts.salesDashboardRequirements.description')}</p>
        <ul className="mt-1 list-disc pl-5">
          {missingAskingPrice && (
            <li>{t('alerts.salesDashboardRequirements.missing.askingPrice')}</li>
          )}
          {missingNetArea && (
            <li>{t('alerts.salesDashboardRequirements.missing.netArea')}</li>
          )}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
