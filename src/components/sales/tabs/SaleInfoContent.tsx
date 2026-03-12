'use client';

/**
 * @fileoverview Sale Info Tab Content — ADR-197 §2.7 Tab 1
 * @description Commercial data: prices, status, buyer, dates
 * @pattern Enterprise card layout with semantic sections
 */

import React, { useState, useEffect } from 'react';
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
import { formatCurrencyWhole } from '@/lib/intl-utils';
import { InfoRow } from '@/components/shared/InfoRow';
import { SALES_ICON_COLORS } from '@/components/sales/config/sales-colors';
import type { Unit } from '@/types/unit';
import { TransactionChainCard } from '@/components/sales/cards/TransactionChainCard';
import { UnitHierarchyCard } from '@/components/sales/cards/UnitHierarchyCard';
import { apiClient } from '@/lib/api/enterprise-api-client';

// =============================================================================
// 🏢 TYPES
// =============================================================================

interface SaleInfoContentProps {
  data?: Unit;
}

// =============================================================================
// 🏢 HELPERS
// =============================================================================

function formatDate(ts: { toDate?: () => Date } | string | null | undefined): string {
  if (!ts) return '—';
  let date: Date;
  if (typeof ts === 'string') {
    date = new Date(ts);
  } else if (typeof ts.toDate === 'function') {
    date = ts.toDate();
  } else {
    return '—';
  }
  if (isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
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
  const { t } = useTranslation('common');
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const router = useRouter();

  // Fallback: αν buyerName λείπει αλλά buyerContactId υπάρχει, φέρνουμε από API
  const [resolvedBuyerName, setResolvedBuyerName] = useState<string | null>(
    unit?.commercial?.buyerName ?? null
  );

  useEffect(() => {
    const contactId = unit?.commercial?.buyerContactId;
    const existingName = unit?.commercial?.buyerName;
    if (existingName || !contactId) {
      setResolvedBuyerName(existingName ?? null);
      return;
    }

    let cancelled = false;
    apiClient.get<{ contact: { displayName: string } }>(
      `/api/contacts/${encodeURIComponent(contactId)}`
    ).then((data) => {
      if (!cancelled && data?.contact?.displayName) {
        setResolvedBuyerName(data.contact.displayName);
      }
    }).catch(() => { /* silent */ });

    return () => { cancelled = true; };
  }, [unit?.commercial?.buyerContactId, unit?.commercial?.buyerName]);

  if (!unit) return null;

  const commercial = unit.commercial;
  const askingPrice = commercial?.askingPrice;
  const finalPrice = commercial?.finalPrice;
  const area = unit.areas?.gross ?? unit.area ?? 0;
  const pricePerSqm = askingPrice && area > 0 ? Math.round(askingPrice / area) : null;
  const discount = computeDiscount(askingPrice, finalPrice);
  const daysOnMarket = computeDaysOnMarket(commercial?.listedDate);

  return (
    <section className="flex flex-col gap-2 p-2" aria-label={t('sales.tabs.saleInfo', { defaultValue: 'Πληροφορίες Πώλησης' })}>
      {/* Ιεραρχία Ακινήτου: Εταιρεία → Έργο → Κτίριο → Μονάδα */}
      <UnitHierarchyCard unitId={unit.id} />

      {/* Εμπορικά Στοιχεία */}
      <Card>
        <CardHeader className="p-3 pb-0">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className={`${iconSizes.sm} ${SALES_ICON_COLORS.pricingSection}`} />
            {t('sales.saleInfo.pricing', { defaultValue: 'Εμπορικά Στοιχεία' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-2">
          <InfoRow
            icon={DollarSign}
            iconColor={SALES_ICON_COLORS.askingPrice}
            label={t('sales.saleInfo.askingPrice', { defaultValue: 'Ζητούμενη' })}
            value={formatCurrencyWhole(askingPrice)}
            valueColor={colors.text.success}
          />
          {finalPrice !== null && finalPrice !== undefined && (
            <InfoRow
              icon={DollarSign}
              iconColor={SALES_ICON_COLORS.finalPrice}
              label={t('sales.saleInfo.finalPrice', { defaultValue: 'Τελική τιμή' })}
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
      {(commercial?.buyerContactId || commercial?.reservationDeposit) && (
        <Card>
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <UserCheck className={`${iconSizes.sm} ${SALES_ICON_COLORS.reservationSection}`} />
              {t('sales.saleInfo.reservation', { defaultValue: 'Κράτηση' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-2">
            {commercial?.reservationDeposit && (
              <InfoRow
                icon={CreditCard}
                iconColor={SALES_ICON_COLORS.deposit}
                label={t('sales.saleInfo.deposit', { defaultValue: 'Προκαταβολή' })}
                value={formatCurrencyWhole(commercial.reservationDeposit)}
              />
            )}
            {commercial?.buyerContactId && (
              <div className="flex items-center justify-between py-1.5">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <UserCheck className={`${iconSizes.sm} ${SALES_ICON_COLORS.buyer} flex-shrink-0`} />
                  {t('sales.saleInfo.buyer', { defaultValue: 'Αγοραστής' })}
                </span>
                <button
                  onClick={() => router.push(ENTITY_ROUTES.contacts.withId(commercial.buyerContactId))}
                  className={`text-sm font-medium ${colors.text.info} flex items-center gap-1 hover:underline`}
                >
                  {resolvedBuyerName ?? t('sales.saleInfo.unknownBuyer', { defaultValue: 'Άγνωστος' })}
                  <ExternalLink className={iconSizes.xs} />
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ADR-198: Παραστατικά πώλησης — εμφάνιση αν υπάρχει deposit ή πώληση */}
      {(commercial?.reservationDeposit || commercial?.transactionChainId || unit.status === 'sold') && (
        <TransactionChainCard unitId={unit.id} />
      )}

      {/* Ημερομηνίες */}
      <Card>
        <CardHeader className="p-3 pb-0">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className={`${iconSizes.sm} ${SALES_ICON_COLORS.datesSection}`} />
            {t('sales.saleInfo.dates', { defaultValue: 'Ημερομηνίες' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-2">
          <InfoRow
            icon={Calendar}
            iconColor={SALES_ICON_COLORS.listedDate}
            label={t('sales.saleInfo.listedDate', { defaultValue: 'Στην αγορά' })}
            value={formatDate(commercial?.listedDate)}
          />
          {commercial?.reservationDate && (
            <InfoRow
              icon={Calendar}
              iconColor={SALES_ICON_COLORS.reservationDate}
              label={t('sales.saleInfo.reservationDate', { defaultValue: 'Ημ. κράτησης' })}
              value={formatDate(commercial.reservationDate)}
            />
          )}
          {commercial?.saleDate && (
            <InfoRow
              icon={Calendar}
              iconColor={SALES_ICON_COLORS.saleDate}
              label={t('sales.saleInfo.saleDate', { defaultValue: 'Ημ. πώλησης' })}
              value={formatDate(commercial.saleDate)}
            />
          )}
          {commercial?.cancellationDate && (
            <InfoRow
              icon={Calendar}
              iconColor={SALES_ICON_COLORS.cancellationDate}
              label={t('sales.saleInfo.cancellationDate', { defaultValue: 'Ημ. ακύρωσης' })}
              value={formatDate(commercial.cancellationDate)}
            />
          )}
          <InfoRow
            icon={Clock}
            iconColor={SALES_ICON_COLORS.daysOnMarket}
            label={t('sales.saleInfo.daysOnMarket', { defaultValue: 'Ημέρες' })}
            value={daysOnMarket}
          />
        </CardContent>
      </Card>
    </section>
  );
}
