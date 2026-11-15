'use client';

/**
 * @fileoverview ADR-915 §42 — **οι γραμμές της προσφοράς** στο ιστορικό της κάρτας: η προσφορά (σύνολο · είδος ·
 *   ισχύς), η αναθεώρηση μετά την αυτοψία με την αρχική της, και το παραστατικό (ΜΑΡΚ).
 * @related RegistryIssuanceStep.tsx (ο καταναλωτής) · lib/document-validity/issuance-quote.ts (τα σύνολα)
 * @module components/document-registry/registry-issuance-quote-lines
 */

import React from 'react';

import type { useTranslation } from '@/i18n/hooks/useTranslation';
import type { IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import { quoteTotalsOf } from '@/lib/document-validity/issuance-quote';
import { formatDate } from '@/lib/intl-formatting';
import { formatMinor } from '@/lib/money/money';
import { QUOTE_KEYS } from '@/components/document-registry/issuance-labels';
import { basisText } from '@/components/document-registry/issuance-quote-labels';
import { DELIVERY_KEYS } from '@/components/document-registry/issuance-delivery-labels';

type Translate = ReturnType<typeof useTranslation>['t'];

export function quoteLines(t: Translate, record: IssuanceAssignmentRecord): React.ReactNode[] {
  const { quote, receipt } = record;
  if (quote === null) return [];
  const total = formatMinor(quoteTotalsOf(quote).totalMinor);
  return [
    <li key="quote">{t(QUOTE_KEYS.line, { total, basis: basisText(t, quote.basis), date: formatDate(quote.validUntil) })}</li>,
    quote.deliveryBusinessDays === null ? null : <li key="quote-delivery">{t(DELIVERY_KEYS.quoteDays, { count: quote.deliveryBusinessDays })}</li>,
    quote.previous === null ? null : (
      <li key="quote-revised">{t(QUOTE_KEYS.revisedLine, { total, previous: formatMinor(quoteTotalsOf(quote.previous).totalMinor) })}</li>
    ),
    receipt === null ? null : <li key="receipt">{t(QUOTE_KEYS.receiptLine, { mark: receipt.mark, date: formatDate(receipt.issuedOn) })}</li>,
  ];
}
