/**
 * @fileoverview Cash Flow Statement Generator (Phase 2c)
 * @description Ταμειακές Ροές — Operating / Investing / Financing classification
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md Q6 (Report #6)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { JournalEntry } from '../../types/journal';
import type { AccountCategory } from '../../types/common';
import type {
  ReportGeneratorDeps,
  ResolvedPeriods,
  ReportResult,
  CashFlowData,
  CashFlowSection,
  CashFlowItem,
} from '../../types/reports';
import { getCategoryByCode } from '../../config/account-categories';
import { buildComparative, buildNumericComparative } from './comparative-engine';

const REPORT_PAGE_SIZE = 10000;

/** Generate Cash Flow Statement with comparative analysis */
export async function generateCashFlow(
  deps: ReportGeneratorDeps,
  periods: ResolvedPeriods
): Promise<ReportResult<CashFlowData>> {
  const [current, previous, yoy] = await Promise.all([
    fetchCashFlowSnapshot(deps, periods.current),
    fetchCashFlowSnapshot(deps, periods.previousPeriod),
    fetchCashFlowSnapshot(deps, periods.yearOverYear),
  ]);

  const sectionNet = (s: CashFlowSection) => s.net;

  return {
    reportType: 'cash_flow',
    generatedAt: new Date().toISOString(),
    period: periods,
    data: {
      operating: buildComparative(
        current.operating, previous.operating, yoy.operating, sectionNet
      ),
      investing: buildComparative(
        current.investing, previous.investing, yoy.investing, sectionNet
      ),
      financing: buildComparative(
        current.financing, previous.financing, yoy.financing, sectionNet
      ),
      netCashFlow: buildNumericComparative(
        current.netCashFlow, previous.netCashFlow, yoy.netCashFlow
      ),
    },
  };
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

interface CashFlowSnapshot {
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
  netCashFlow: number;
}

type CashFlowClassification = 'operating' | 'investing' | 'financing' | 'exclude';

// ============================================================================
// CATEGORY CLASSIFICATION
// ============================================================================

/**
 * Classify an accounting category into cash flow sections.
 *
 * - Operating: Standard income/expense (services, rent, utilities, etc.)
 * - Investing: Capital expenditure and asset sales
 * - Financing: EFKA, tax, bank fees (mandatory obligations)
 * - Exclude: Non-cash items (depreciation)
 */
function classifyCategory(category: AccountCategory): CashFlowClassification {
  switch (category) {
    // Investing
    case 'equipment':
    case 'asset_sale_income':
      return 'investing';
    // Financing (mandatory obligations)
    case 'efka':
    case 'professional_tax':
    case 'bank_fees':
      return 'financing';
    // Non-cash — exclude
    case 'depreciation':
      return 'exclude';
    // Everything else is operating
    default:
      return 'operating';
  }
}

// ============================================================================
// SNAPSHOT FETCHING
// ============================================================================

async function fetchCashFlowSnapshot(
  deps: ReportGeneratorDeps,
  period: { from: string; to: string }
): Promise<CashFlowSnapshot> {
  const result = await deps.repository.listJournalEntries(
    { period },
    REPORT_PAGE_SIZE
  );
  const active = result.items.filter((e) => e.status === 'ACTIVE');
  return buildCashFlowFromEntries(active);
}

function buildCashFlowFromEntries(entries: JournalEntry[]): CashFlowSnapshot {
  const buckets: Record<CashFlowClassification, JournalEntry[]> = {
    operating: [], investing: [], financing: [], exclude: [],
  };

  for (const entry of entries) {
    const classification = classifyCategory(entry.category);
    buckets[classification].push(entry);
  }

  const operating = buildSection(buckets.operating);
  const investing = buildSection(buckets.investing);
  const financing = buildSection(buckets.financing);
  const netCashFlow = operating.net + investing.net + financing.net;

  return { operating, investing, financing, netCashFlow };
}

function buildSection(entries: JournalEntry[]): CashFlowSection {
  const itemMap = new Map<string, number>();

  for (const entry of entries) {
    const catDef = getCategoryByCode(entry.category);
    const label = catDef?.label ?? entry.category;
    const amount = entry.type === 'income' ? entry.netAmount : -entry.netAmount;
    itemMap.set(label, (itemMap.get(label) ?? 0) + amount);
  }

  const items: CashFlowItem[] = [...itemMap.entries()]
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  const inflows = items
    .filter((i) => i.amount > 0)
    .reduce((sum, i) => sum + i.amount, 0);
  const outflows = Math.abs(
    items.filter((i) => i.amount < 0).reduce((sum, i) => sum + i.amount, 0)
  );

  return { inflows, outflows, net: inflows - outflows, items };
}
