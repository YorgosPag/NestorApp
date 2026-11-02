'use client';

/**
 * Τι έμεινε απέξω από ένα αρχείο ETIM xChange (ADR-923 Φάση 7). Γραμμή μόνο για ό,τι υπάρχει: καθαρή εισαγωγή δεν γράφει τίποτα πέρα από το πλήθος.
 * @module components/catalog/imports/XChangeReportNote
 */

import React from 'react';

import type { XChangeImportReport } from '@/subapps/catalog/interop/etim/xchange-report';
import { useImportText } from './import-text';

const codesOf = (codes: readonly string[]): string => codes.join(' · ');

export function XChangeReportNote({ report }: { readonly report: XChangeImportReport }) {
  const { t } = useImportText();
  const { products, imported, otherClasses, otherClassProducts, unmappedFeatures, rangeFeatures, declaredNoValue, extraTradeItems } = report;
  const lines = [
    t('xchange.imported', { imported, products }),
    otherClassProducts > 0 ? t('xchange.otherClass', { count: otherClassProducts, classes: codesOf(otherClasses) }) : null,
    unmappedFeatures.length > 0 ? t('xchange.unmapped', { count: unmappedFeatures.length, codes: codesOf(unmappedFeatures) }) : null,
    rangeFeatures.length > 0 ? t('xchange.ranges', { codes: codesOf(rangeFeatures) }) : null,
    declaredNoValue > 0 ? t('xchange.noValue', { count: declaredNoValue }) : null,
    extraTradeItems > 0 ? t('xchange.tradeItems', { count: extraTradeItems }) : null,
  ];
  return (
    <section className="rounded-md border border-border p-3 text-sm" aria-label={t('xchange.title')}>
      <h3 className="m-0 mb-1 font-medium">{t('xchange.title')}</h3>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-muted-foreground">
        {lines.flatMap((line) => (line === null ? [] : [<li key={line}>{line}</li>]))}
      </ul>
    </section>
  );
}
