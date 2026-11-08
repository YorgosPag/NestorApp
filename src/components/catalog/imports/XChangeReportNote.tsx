'use client';

/**
 * Τι έμεινε απέξω από ένα αρχείο ETIM xChange (ADR-923 Φάση 7 · §23.2 K4γ), ανά σκοπό της παρτίδας. Γραμμή μόνο για ό,τι υπάρχει:
 * καθαρή εισαγωγή δεν γράφει τίποτα πέρα από το πλήθος.
 * @module components/catalog/imports/XChangeReportNote
 */

import React from 'react';

import { MONEY_CURRENCY } from '@/lib/money/money';
import type { XChangeAttachmentReport, XChangeAttributeImportReport, XChangeImportReport, XChangePriceImportReport } from '@/subapps/catalog/interop/etim/xchange-report';
import { useImportText } from './import-text';

type ImportText = ReturnType<typeof useImportText>['t'];

const codesOf = (codes: readonly string[]): string => codes.join(' · ');

/** Τα συνημμένα (ADR-934 §5.2 Μ2). Απούσα αναφορά (πριν από το στάδιο Μ-α) ⇒ καμία γραμμή. */
function attachmentLines(t: ImportText, report: XChangeAttachmentReport | undefined): (string | null)[] {
  if (!report) return [];
  const { assets, links, unsupportedTypes, thumbnails, unreachableUris, invalidDates, unreadable } = report;
  return [
    assets > 0 ? t('xchange.attachments.assets', { count: assets }) : null,
    links > 0 ? t('xchange.attachments.links', { count: links }) : null,
    unsupportedTypes.length > 0 ? t('xchange.attachments.unsupported', { codes: codesOf(unsupportedTypes) }) : null,
    thumbnails > 0 ? t('xchange.attachments.thumbnails', { count: thumbnails }) : null,
    unreachableUris > 0 ? t('xchange.attachments.unreachable', { count: unreachableUris }) : null,
    invalidDates > 0 ? t('xchange.attachments.invalidDates', { count: invalidDates }) : null,
    unreadable > 0 ? t('xchange.attachments.unreadable', { count: unreadable }) : null,
  ];
}

function attributeLines(t: ImportText, report: XChangeAttributeImportReport): (string | null)[] {
  const { products, imported, otherClasses, otherClassProducts, unmappedFeatures, rangeFeatures, declaredNoValue, extraTradeItems } = report;
  // ADR-934 Σ1γ: απόντα στις αναφορές πριν από τη φάση ⇒ 0.
  const extraGtins = report.extraGtins ?? 0;
  const brandFromManufacturer = report.brandFromManufacturer ?? 0;
  return [
    t('xchange.imported', { imported, products }),
    otherClassProducts > 0 ? t('xchange.otherClass', { count: otherClassProducts, classes: codesOf(otherClasses) }) : null,
    unmappedFeatures.length > 0 ? t('xchange.unmapped', { count: unmappedFeatures.length, codes: codesOf(unmappedFeatures) }) : null,
    rangeFeatures.length > 0 ? t('xchange.ranges', { codes: codesOf(rangeFeatures) }) : null,
    declaredNoValue > 0 ? t('xchange.noValue', { count: declaredNoValue }) : null,
    extraTradeItems > 0 ? t('xchange.tradeItems', { count: extraTradeItems }) : null,
    extraGtins > 0 ? t('xchange.extraGtins', { count: extraGtins }) : null,
    brandFromManufacturer > 0 ? t('xchange.brandFromManufacturer', { count: brandFromManufacturer }) : null,
    ...attachmentLines(t, report.attachments),
  ];
}

function priceLines(t: ImportText, report: XChangePriceImportReport): (string | null)[] {
  const { products, imported, onRequest, amountMissing, entryIncomplete, validityUncovered, validityAmbiguous, currencyAssumed, allowanceSurcharges, extraTradeItems } = report;
  return [
    t('xchange.pricesImported', { imported, products }),
    currencyAssumed ? t('xchange.currencyAssumed', { currency: MONEY_CURRENCY }) : null,
    onRequest > 0 ? t('xchange.onRequest', { count: onRequest }) : null,
    amountMissing > 0 ? t('xchange.amountMissing', { count: amountMissing }) : null,
    entryIncomplete > 0 ? t('xchange.entryIncomplete', { count: entryIncomplete }) : null,
    validityUncovered.length > 0 ? t('xchange.validityUncovered', { codes: codesOf(validityUncovered) }) : null,
    validityAmbiguous.length > 0 ? t('xchange.validityAmbiguous', { codes: codesOf(validityAmbiguous) }) : null,
    allowanceSurcharges > 0 ? t('xchange.allowanceSurcharges', { count: allowanceSurcharges }) : null,
    extraTradeItems > 0 ? t('xchange.tradeItems', { count: extraTradeItems }) : null,
  ];
}

export function XChangeReportNote({ report }: { readonly report: XChangeImportReport }) {
  const { t } = useImportText();
  // Οι αναφορές που αποθηκεύτηκαν πριν από την εισαγωγή τιμών δεν έχουν `purpose`: τότε υπήρχε μόνο ο σκοπός «ιδιότητες».
  const lines = report.purpose === 'priceLines' ? priceLines(t, report) : attributeLines(t, report);
  return (
    <section className="rounded-md border border-border p-3 text-sm" aria-label={t('xchange.title')}>
      <h3 className="m-0 mb-1 font-medium">{t('xchange.title')}</h3>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-muted-foreground">
        {lines.flatMap((line) => (line === null ? [] : [<li key={line}>{line}</li>]))}
      </ul>
    </section>
  );
}
