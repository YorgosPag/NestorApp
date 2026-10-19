'use client';

/**
 * =============================================================================
 * SALES LIST PAGE SHELL — SSoT για τον σκελετό των σελίδων-λιστών πωλήσεων
 * =============================================================================
 *
 * Οι 4 σελίδες πωλήσεων (properties / sold / parking / storage) ήταν δομικά
 * δίδυμες: ίδιο loading gate, ίδιος header, ίδιο dashboard, ίδιο responsive
 * φίλτρο, ίδιος διακόπτης λίστας/πλέγματος — το jscpd σήμανε 105 διπλές γραμμές
 * στο ζεύγος properties↔sold, αλλά το ίδιο μοτίβο κουβαλούσαν και τα άλλα δύο.
 *
 * Εδώ ζει ΜΟΝΟ αυτό το μηχανικό κοινό. Κάθε σελίδα κρατά δηλωτικά ό,τι την
 * διαφοροποιεί (hook κατάστασης, στατιστικά, φίλτρα, sidebar, κάρτα) και το
 * περνά ως δεδομένα ή slots — ΟΧΙ ως `if (kind === 'sold')` μέσα σε ένα
 * god-component. Ίδιο σχήμα με το `band-stack-preview-renderer.ts` (ADR-412/414):
 * ο κοινός ιδιοκτήτης + ό,τι πραγματικά διαφέρει, και τίποτε άλλο.
 *
 * ⚠️ `renderSplit` / `renderGrid` είναι συναρτήσεις, όχι έτοιμα elements: έτσι
 * χτίζεται ΜΟΝΟ η ενεργή προβολή — το πλέγμα δεν παράγει κάρτες όσο η σελίδα
 * είναι σε λίστα.
 *
 * 🔴 ADR-912 §12.20 — **το πλέγμα ζει ΜΕΣΑ στο πλαίσιο λίστας + λεπτομερειών, όχι δίπλα του.**
 * Ως 2026-10-19 ο σκελετός απέδιδε `renderList()` **ή** `renderGrid()`: οι λεπτομέρειες ζούσαν μόνο
 * μέσα στο sidebar της λίστας, άρα στο πλέγμα το κλικ σε κάρτα άλλαζε την επιλογή χωρίς κανένα
 * πάνελ — σε **κάθε** πλάτος και στις **4** σελίδες. Τώρα ο κανόνας ζει εδώ, μία φορά: στο πλέγμα το
 * sidebar παίρνει το πλέγμα ως `grid` και ανοίγει τις λεπτομέρειες ως side peek / φύλλο κινητού.
 *
 * @module components/sales/shared/sales-list-page-shell
 * @see SalesCardGrid.tsx — ο καμβάς της προβολής πλέγματος
 * @see lib/listings/listing-price-label.ts — `priceTotalsView`: οι τιμές του dashboard ανά ρόλο (ADR-777 §8.60.14.13)
 * @see docs/centralized-systems/reference/adrs/ADR-197-sales-pages-implementation-plan.md
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { SalesAvailableHeader } from '@/components/sales/page/SalesAvailableHeader';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { ResponsiveFiltersPanel } from '@/components/core/AdvancedFilters';
import type { FilterPanelConfig, GenericFilterState } from '@/components/core/AdvancedFilters/types';
import { ListContainer, PageContainer } from '@/core/containers';
import { PageLoadingState } from '@/core/states';
import type { ListGridHeaderProps } from '@/core/headers';

/** Το dashboard κάθε σελίδας πωλήσεων είναι μία σειρά από 4 πλακίδια. */
const SALES_DASHBOARD_COLUMNS = 6;

/**
 * Ό,τι επιστρέφει κάθε sales viewer-state hook για τη «διακόσμηση» της σελίδας.
 * Ορίζεται πάνω στο `ListGridHeaderProps` (SSoT των headers) — η αναζήτηση
 * λείπει επειδή την κατέχει ο ίδιος ο σκελετός, όχι η σελίδα.
 */
export type SalesListPageChrome = Omit<ListGridHeaderProps, 'searchTerm' | 'setSearchTerm'> &
  Required<Pick<ListGridHeaderProps, 'showFilters' | 'setShowFilters'>>;

/** Τα κείμενα της σελίδας — ήδη μεταφρασμένα (N.11: τα κλειδιά ζουν στα locales). */
export interface SalesListPageLabels {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
}

export interface SalesListPageShellProps<TFilters extends GenericFilterState> {
  labels: SalesListPageLabels;
  loading: boolean;
  loadingIcon: LucideIcon;
  /** Ήδη μεταφρασμένο μήνυμα φόρτωσης. */
  loadingMessage: string;
  chrome: SalesListPageChrome;
  stats: DashboardStat[];
  /** Καλείται όποτε αλλάζει ο όρος αναζήτησης — η σελίδα τον προωθεί στα φίλτρα της. */
  onSearchChange: (searchTerm: string) => void;
  filtersConfig: FilterPanelConfig;
  filters: TFilters;
  onFiltersChange: (filters: TFilters) => void;
  /**
   * Το πλαίσιο «λίστα + λεπτομέρειες» της σελίδας (το sidebar της). Στην προβολή πλέγματος δέχεται το πλέγμα και
   * το βάζει στη θέση της λίστας (`grid`) — οι λεπτομέρειες ανοίγουν τότε ως side peek (ADR-912 §12.20).
   */
  renderSplit: (grid?: React.ReactNode) => React.ReactNode;
  renderGrid: () => React.ReactNode;
}

export function SalesListPageShell<TFilters extends GenericFilterState>({
  labels,
  loading,
  loadingIcon,
  loadingMessage,
  chrome,
  stats,
  onSearchChange,
  filtersConfig,
  filters,
  onFiltersChange,
  renderSplit,
  renderGrid,
}: SalesListPageShellProps<TFilters>) {
  const [searchTerm, setSearchTerm] = React.useState('');

  // Ο σκελετός κρατά τον όρο αναζήτησης, αλλά ΔΕΝ κρατά την ταυτότητα του
  // callback: οι σελίδες τον περνούν inline, οπότε αν έμπαινε στα deps το effect
  // θα έτρεχε σε κάθε render → βρόχος. Το ref κρατά πάντα τον φρέσκο callback.
  const onSearchChangeRef = React.useRef(onSearchChange);
  React.useEffect(() => {
    onSearchChangeRef.current = onSearchChange;
  });

  React.useEffect(() => {
    onSearchChangeRef.current(searchTerm);
  }, [searchTerm]);

  if (loading) {
    return (
      <PageContainer ariaLabel={labels.title}>
        <PageLoadingState icon={loadingIcon} message={loadingMessage} layout="contained" />
      </PageContainer>
    );
  }

  return (
    <PageContainer ariaLabel={labels.title}>
      <SalesAvailableHeader
        viewMode={chrome.viewMode}
        setViewMode={chrome.setViewMode}
        showDashboard={chrome.showDashboard}
        setShowDashboard={chrome.setShowDashboard}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        showFilters={chrome.showFilters}
        setShowFilters={chrome.setShowFilters}
        titleOverride={labels.title}
        subtitleOverride={labels.subtitle}
        searchPlaceholderOverride={labels.searchPlaceholder}
      />

      {chrome.showDashboard && <UnifiedDashboard stats={stats} columns={SALES_DASHBOARD_COLUMNS} />}

      <ResponsiveFiltersPanel
        config={filtersConfig}
        filters={filters}
        onFiltersChange={onFiltersChange}
        showMobile={chrome.showFilters}
      />

      <ListContainer>{renderSplit(chrome.viewMode === 'list' ? undefined : renderGrid())}</ListContainer>
    </PageContainer>
  );
}
