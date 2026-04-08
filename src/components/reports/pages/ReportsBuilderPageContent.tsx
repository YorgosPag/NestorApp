'use client';

/**
 * @module reports/builder
 * @enterprise ADR-268 — Dynamic Report Builder
 * @lazy ADR-294 Batch 2 — Extracted for dynamic import
 */

import { ReportBuilder } from '@/components/reports/builder/ReportBuilder';

export function ReportsBuilderPageContent() {
  return <ReportBuilder />;
}

export default ReportsBuilderPageContent;
