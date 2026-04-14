'use client';

/**
 * @fileoverview Sale Info Tab Content — ADR-197 §2.7 Tab 1
 * @description Commercial data: prices, status, buyer, dates
 * @pattern Enterprise card layout with semantic sections
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { ENTITY_ROUTES } from '@/lib/routes';
import {
  DollarSign,
  UserCheck,
  Calendar,
  TrendingDown,
  CreditCard,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrencyWhole, formatDate as formatDateIntl } from '@/lib/intl-utils';
import { normalizeToDate } from '@/lib/date-local';
import { InfoRow } from '@/components/shared/InfoRow';
import { SALES_ICON_COLORS } from '@/components/sales/config/sales-colors';
import type { Property } from '@/types/property';
import type { PropertyOwnerEntry } from '@/types/ownership-table';
import { formatOwnerNames, getPrimaryBuyerContactId } from '@/lib/ownership/owner-utils';
import { TransactionChainCard } from '@/components/sales/cards/TransactionChainCard';
import { PropertyHierarchyCard } from '@/components/sales/cards/PropertyHierarchyCard';
import '@/lib/design-system';
import { cn } from '@/lib/utils';

// =============================================================================
// 🏢 TYPES
// =============================================================================

interface SaleInfoContentProps {
  data?: Property;
}

// =============================================================================
// 🏢 HELPERS
// =============================================================================

function formatDate(ts: { toDate?: () => Date } | string | null | undefined): string {
  const d = normalizeToDate(ts);
  return d ? formatDateIntl(d) : '—';
}

function computeDaysOnMarket(listedDate: { toDate?: () => Date } | string | null | undefined): string {
  if (!listedDate) return '—';
  let listed: Date;
  if (typeof listedDate === 'string') {
    listed = new Date(listedDate);
  } else if (typeof listedDate.toDate === 'function') {
    listed = listedDate.toDate();
  } else {
    return '—';
  }
  if (isNaN(listed.getTime())) return '—';
  const days = Math.floor((Date.now() - listed.getTime()) / (1000 * 60 * 60 * 24));
  return `${days}`;
}

function computeDiscount(asking: number | null | undefined, final: number | null | undefined): string | null {
  if (!asking || !final || asking <= 0) return null;
  const pct = ((asking - final) / asking) * 100;
  if (pct <= 0) return null;
  return `−${pct.toFixed(1)}%`;
}

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

export function SaleInfoContent({ data: unit }: SaleInfoContentProps) {
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const router = useRouter();

  // ADR-244: Derive buyer info from owners[] SSoT
  const propertyOwners = (unit?.commercial?.owners as PropertyOwnerEntry[] | null) ?? [];
  const resolvedBuyerName = formatOwnerNames(propertyOwners);
  const primaryBuyerContactId = getPrimaryBuyerContactId(propertyOwners);

  if (!unit) return null;

  const commercial = unit.commercial;
  const askingPrice = commercial?.askingPrice;
  const finalPrice = commercial?.finalPrice;
  const area = unit.areas?.gross ?? unit.area ?? 0;
  const pricePerSqm = askingPrice && area > 0 ? Math.round(askingPrice / area) : null;
  const discount = computeDiscount(askingPrice, finalPrice);
  const daysOnMarket = computeDaysOnMarket(commercial?.listedDate);

  return (
    <section className="flex flex-col gap-2 p-2" aria-label={t('sales.tabs.saleInfo')}>
      {/* Ιεραρχία Ακινήτου: Εταιρεία → Έργο → Κτίριο → Μονάδα */}
      <PropertyHierarchyCard propertyId={unit.id} />

      {/* Εμπορικά Στοιχεία */}
      <Card>
        <CardHeader className="p-3 pb-0">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className={`${iconSizes.sm} ${SALES_ICON_COLORS.pricingSection}`} />
            {t('sales.saleInfo.pricing')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-2">
          <InfoRow
            icon={DollarSign}
            iconColor={SALES_ICON_COLORS.askingPrice}
            label={t('sales.saleInfo.askingPrice')}
            value={formatCurrencyWhole(askingPrice)}
            valueColor={colors.text.success}
          />
          {finalPrice !== null && finalPrice !== undefined && (
            <InfoRow
              icon={DollarSign}
              iconColor={SALES_ICON_COLORS.finalPrice}
              label={t('sales.saleInfo.finalPrice')}
              value={`${formatCurrencyWhole(finalPrice)}${discount ? ` (${discount})` : ''}`}
              valueColor={colors.text.info}
            />
          )}
          {pricePerSqm && (
            <InfoRow
              icon={TrendingDown}
              iconColor={SALES_ICON_COLORS.pricePerSqm}
              label="€/m²"
              value={formatCurrencyWhole(pricePerSqm)}
            />
          )}
        </CardContent>
      </Card>

      {/* Κράτηση / Αγοραστής */}
      {(primaryBuyerContactId || commercial?.reservationDeposit) && (
        <Card>
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <UserCheck className={`${iconSizes.sm} ${SALES_ICON_COLORS.reservationSection}`} />
              {t('sales.saleInfo.reservation')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-2">
            {commercial?.reservationDeposit && (
              <InfoRow
                icon={CreditCard}
                iconColor={SALES_ICON_COLORS.deposit}
                label={t('sales.saleInfo.deposit')}
                value={formatCurrencyWhole(commercial.reservationDeposit)}
              />
            )}
            {primaryBuyerContactId && (
              <div className="flex items-center justify-between py-1.5">
                <span className={cn("flex items-center gap-2 text-sm", colors.text.muted)}>
                  <UserCheck className={`${iconSizes.sm} ${SALES_ICON_COLORS.buyer} flex-shrink-0`} />
                  {t('sales.saleInfo.buyer')}
                </span>
                <button
                  onClick={() => router.push(ENTITY_ROUTES.contacts.withId(primaryBuyerContactId))}
                  className={`text-sm font-medium ${colors.text.info} flex items-center gap-1 hover:underline`}
                >
                  {resolvedBuyerName ?? t('sales.saleInfo.unknownBuyer')}
                  <ExternalLink className={iconSizes.xs} />
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ADR-198: Παραστατικά πώλησης — εμφάνιση αν υπάρχει deposit ή πώληση */}
      {(commercial?.reservationDeposit || commercial?.transactionChainId || unit.status === 'sold') && (
        <TransactionChainCard propertyId={unit.id} />
      )}

      {/* Ημερομηνίες */}
      <Card>
        <CardHeader className="p-3 pb-0">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className={`${iconSizes.sm} ${SALES_ICON_COLORS.datesSection}`} />
            {t('sales.saleInfo.dates')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-2">
          <InfoRow
            icon={Calendar}
            iconColor={SALES_ICON_COLORS.listedDate}
            label={t('sales.saleInfo.listedDate')}
            value={formatDate(commercial?.listedDate)}
          />
          {commercial?.reservationDate && (
            <InfoRow
              icon={Calendar}
              iconColor={SALES_ICON_COLORS.reservationDate}
              label={t('sales.saleInfo.reservationDate')}
              value={formatDate(commercial.reservationDate)}
            />
          )}
          {commercial?.saleDate && (
            <InfoRow
              icon={Calendar}
              iconColor={SALES_ICON_COLORS.saleDate}
              label={t('sales.saleInfo.saleDate')}
              value={formatDate(commercial.saleDate)}
            />
          )}
          {commercial?.cancellationDate && (
            <InfoRow
              icon={Calendar}
              iconColor={SALES_ICON_COLORS.cancellationDate}
              label={t('sales.saleInfo.cancellationDate')}
              value={formatDate(commercial.cancellationDate)}
            />
          )}
          <InfoRow
            icon={Clock}
            iconColor={SALES_ICON_COLORS.daysOnMarket}
            label={t('sales.saleInfo.daysOnMarket')}
            value={daysOnMarket}
          />
        </CardContent>
      </Card>
    </section>
  );
}
