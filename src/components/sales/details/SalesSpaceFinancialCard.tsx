'use client';

/**
 * =============================================================================
 * SALES SPACE FINANCIAL CARD — η οικονομική ενότητα ενός βοηθητικού χώρου
 * =============================================================================
 *
 * Τα δύο πάνελ λεπτομερειών (στάθμευση, αποθήκη) έδειχναν **ταυτόσημη**
 * οικονομική κάρτα — ίδιες τρεις σειρές, ίδια χρώματα, ίδιοι όροι εμφάνισης —
 * με μόνη διαφορά τα κλειδιά μετάφρασης· το CHECK 3.28 τη μέτρησε ως κλώνο.
 *
 * Ο λόγος που αξίζει κοινό component δεν είναι οι γραμμές: είναι ότι το «τι
 * σημαίνει οικονομικά αυτός ο χώρος» πρέπει να απαντιέται **μία** φορά. Η
 * τιμή έρχεται από τον SSoT (ADR-777 Α6) μέσω του `salesSpaceCardPricing`, εδώ
 * μέσα — ο καλών δεν την υπολογίζει και δεν μπορεί να δώσει άλλη.
 *
 * @module components/sales/details/SalesSpaceFinancialCard
 * @see components/sales/shared/sales-space-page — η κοινή τιμολόγηση
 */

import { DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useIconSizes } from '@/hooks/useIconSizes';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import { InfoRow } from '@/components/shared/InfoRow';
import { SALES_ICON_COLORS } from '@/components/sales/config/sales-colors';
import { salesSpaceCardPricing } from '@/components/sales/shared/sales-space-page';
import type { SalesSpaceItem } from '@/types/sales-shared';

/**
 * Οι τέσσερις ετικέτες που διαφέρουν ανά χώρο.
 *
 * Περνιούνται **λυμένες**, όχι ως κλειδιά: ο καλών ξέρει ήδη το namespace του,
 * και ένα κλειδί που ταξιδεύει ως συμβολοσειρά θα ήταν αόρατο στο CHECK 3.8.
 */
export interface SalesSpaceFinancialLabels {
  section: string;
  price: string;
  pricePerSqm: string;
  finalPrice: string;
}

interface SalesSpaceFinancialCardProps {
  item: SalesSpaceItem & { commercial?: { finalPrice?: number | null } | null };
  labels: SalesSpaceFinancialLabels;
}

export function SalesSpaceFinancialCard({ item, labels }: SalesSpaceFinancialCardProps) {
  const iconSizes = useIconSizes();
  const { price, pricePerSqm } = salesSpaceCardPricing(item);
  const finalPrice = item.commercial?.finalPrice;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <DollarSign className={`${iconSizes.sm} ${SALES_ICON_COLORS.financialSection}`} />
          {labels.section}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <InfoRow
          icon={DollarSign}
          iconColor={SALES_ICON_COLORS.askingPrice}
          label={labels.price}
          value={formatCurrencyWhole(price)}
          valueColor={SALES_ICON_COLORS.askingPrice}
        />
        {pricePerSqm && (
          <InfoRow
            icon={DollarSign}
            iconColor={SALES_ICON_COLORS.pricePerSqm}
            label={labels.pricePerSqm}
            value={`${formatCurrencyWhole(pricePerSqm)}/m²`}
          />
        )}
        {finalPrice && (
          <InfoRow
            icon={DollarSign}
            iconColor={SALES_ICON_COLORS.finalPrice}
            label={labels.finalPrice}
            value={formatCurrencyWhole(finalPrice)}
            valueColor={SALES_ICON_COLORS.finalPrice}
          />
        )}
      </CardContent>
    </Card>
  );
}
