/**
 * @fileoverview Άγκυρα του σειριοποιητή Excel: το MIME του Blob είναι αυτό που λέει το μητρώο τύπων αρχείου για την
 *   προέκταση που δηλώνει ο ίδιος ο σειριοποιητής (ADR-296, CHECK 3.7) — όχι δεύτερη, χειρόγραφη σταθερά.
 */

import { canonicalMimeForFilename } from '@/config/file-types/classification-registry';

import { excelReportSerializer } from '../excel-exporter';
import type { ReportDocument } from '../report-export';

const DOC: ReportDocument = {
  title: 'Trial balance',
  periodLine: '2026-01-01 – 2026-12-31',
  t: (key) => key,
  table: {
    columns: [
      { header: 'Account', kind: 'label' },
      { header: 'Value', kind: 'value' },
    ],
    rows: [{ cells: ['Cash', 1250.5], format: 'currency', section: false }],
    summaryMetrics: [],
  },
};

describe('excelReportSerializer', () => {
  it('δηλώνει την προέκταση xlsx', () => {
    expect(excelReportSerializer.extension).toBe('xlsx');
  });

  it('το MIME του Blob είναι το κανονικό του μητρώου για αυτή την προέκταση', async () => {
    const blob = await excelReportSerializer.serialize(DOC);
    expect(blob.type).toBe(canonicalMimeForFilename(`.${excelReportSerializer.extension}`));
    expect(blob.type).toMatch(/spreadsheetml\.sheet$/);
    expect(blob.size).toBeGreaterThan(0);
  });
});
