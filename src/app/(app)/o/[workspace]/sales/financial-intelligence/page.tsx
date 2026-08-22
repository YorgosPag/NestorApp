'use client';

/**
 * Financial Intelligence Page — SPEC-242C
 * @lazy ADR-294 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const FinancialIntelligence = LazyRoutes.FinancialIntelligence;

export default function FinancialIntelligencePage() {
  return <FinancialIntelligence />;
}
