'use client';

/**
 * @fileoverview **Η αναφορά εξαγωγής xChange** (ADR-923 §5.14 · Ζ5): από ποια λίστα και έκδοση βγήκαν οι τιμές, πόσα γράφτηκαν, και
 *   τι έμεινε εκτός ή χωρίς τιμή, ανά αιτία. Γραμμή μόνο για ό,τι υπάρχει.
 * @related components/catalog/imports/XChangeReportNote.tsx (η αναφορά της εισαγωγής)
 * @module components/catalog/interop/XChangeExportReport
 */

import React from 'react';

import { formatDate, formatDateTime } from '@/lib/intl-formatting';
import type { XChangeExportSummary } from '@/subapps/catalog/types/xchange-export';
import { XCHANGE_ON_REQUEST_REASONS } from '@/subapps/catalog/vocabulary/etim';
import { useCatalogText } from '../shared/catalog-ui-hooks';

const codesOf = (codes: readonly string[]): string => codes.join(' · ');

type Translate = ReturnType<typeof useCatalogText>['t'];

function priceSourceLine(summary: XChangeExportSummary, t: Translate, text: ReturnType<typeof useCatalogText>['text']): string {
  const source = summary.priceSource;
  if (source === null) return t('xchangeExport.report.noPriceList');
  const list = text(source.labels, source.code);
  if (source.version === null) return t('xchangeExport.report.priceSourceNoVersion', { list });
  return t('xchangeExport.report.priceSource', { list, version: source.version.number, date: formatDate(new Date(source.version.validFrom)) });
}

function onRequestLine(summary: XChangeExportSummary, t: Translate): string | null {
  const parts = XCHANGE_ON_REQUEST_REASONS.flatMap((reason) => {
    const count = summary.onRequest[reason] ?? 0;
    return count > 0 ? [{ count, text: t(`xchangeExport.reason.${reason}`, { count }) }] : [];
  });
  const count = parts.reduce((total, part) => total + part.count, 0);
  return count === 0 ? null : t('xchangeExport.report.onRequest', { count, reasons: parts.map((part) => part.text).join(' · ') });
}

function contentLines(summary: XChangeExportSummary, t: Translate): readonly (string | null)[] {
  const { withoutClass, unitUndeclared, optionUnmapped, typeUnsupported } = summary.content;
  return [
    withoutClass > 0 ? t('xchangeExport.report.withoutClass', { count: withoutClass }) : null,
    unitUndeclared.length > 0 ? t('xchangeExport.report.unitUndeclared', { codes: codesOf(unitUndeclared) }) : null,
    optionUnmapped.length > 0 ? t('xchangeExport.report.optionUnmapped', { codes: codesOf(optionUnmapped) }) : null,
    typeUnsupported.length > 0 ? t('xchangeExport.report.typeUnsupported', { codes: codesOf(typeUnsupported) }) : null,
  ];
}

export function XChangeExportReport({ summary }: { readonly summary: XChangeExportSummary }) {
  const { t, text } = useCatalogText();
  const lines = [
    t('xchangeExport.report.exported', { count: summary.exported, file: summary.fileName }),
    priceSourceLine(summary, t, text),
    t('xchangeExport.report.at', { date: formatDateTime(new Date(summary.at)) }),
    summary.hidden > 0 ? t('xchangeExport.report.hidden', { count: summary.hidden }) : null,
    summary.unfitIdentifier > 0 ? t('xchangeExport.report.unfitIdentifier', { count: summary.unfitIdentifier }) : null,
    onRequestLine(summary, t),
    ...contentLines(summary, t),
    t('xchangeExport.report.codesOnly'),
  ];
  return (
    <section className="rounded-md border border-border p-3 text-sm" aria-label={t('xchangeExport.report.title')} aria-live="polite">
      <h3 className="m-0 mb-1 font-medium">{t('xchangeExport.report.title')}</h3>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-muted-foreground">
        {lines.flatMap((line) => (line === null ? [] : [<li key={line}>{line}</li>]))}
      </ul>
    </section>
  );
}
