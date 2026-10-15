'use client';

/**
 * @fileoverview AccountingListBody — το σώμα μιας σελίδας λίστας λογιστικής (ADR-ACC-010 §2.1.1 Φάση 3β)
 * @description Κάρτες σύνοψης (αν είναι ανοιχτές) → πάνελ φίλτρων → περιοχή περιεχομένου. Ήταν η ίδια αλυσίδα σε
 *   τιμολόγια / τράπεζα / πάγια· εδώ ζει μία φορά. Το πάνελ δένεται με το `useAccountingFilterPanel`.
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import type { ReactNode } from 'react';

import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { AdvancedFiltersPanel } from '@/components/core/AdvancedFilters/AdvancedFiltersPanel';
import type { GenericFilterState } from '@/components/core/AdvancedFilters/types';

import type { AccountingFilterPanelBinding } from '../../hooks/useAccountingFilterPanel';

interface AccountingListBodyProps<T extends GenericFilterState> {
  readonly showDashboard: boolean;
  readonly stats: DashboardStat[];
  readonly filterPanel: AccountingFilterPanelBinding<T>;
  readonly children: ReactNode;
}

export function AccountingListBody<T extends GenericFilterState>({
  showDashboard,
  stats,
  filterPanel,
  children,
}: AccountingListBodyProps<T>) {
  return (
    <>
      {showDashboard && <UnifiedDashboard stats={stats} columns={4} />}
      <AdvancedFiltersPanel
        config={filterPanel.config}
        filters={filterPanel.filters}
        onFiltersChange={filterPanel.onFiltersChange}
        defaultFilters={filterPanel.defaultFilters}
      />
      <section className="p-6">{children}</section>
    </>
  );
}
