/**
 * Π — **ΠΛΕΓΜΑ ΠΩΛΗΣΕΩΝ: ΚΛΙΚ ΣΕ ΚΑΡΤΑ ΑΝΟΙΓΕΙ ΤΙΣ ΛΕΠΤΟΜΕΡΕΙΕΣ** (ADR-912 §12.20).
 *
 * 🔴 **Η αφορμή** (στιγμιότυπο Giorgio 2026-10-19, 390×844, `/sales/available-properties`): στην προβολή πλέγματος το
 * κλικ σε κάρτα άλλαζε την επιλογή αλλά **κανένα** πάνελ δεν άνοιγε — σε κάθε πλάτος και στις 4 σελίδες πωλήσεων. Ο
 * σκελετός απέδιδε `renderList()` **ή** `renderGrid()`, και οι λεπτομέρειες ζούσαν μόνο μέσα στο sidebar της λίστας.
 *
 * Δύο κρίκοι, δύο άγκυρες:
 *   Π1 — ο σκελετός περνά το πλέγμα **μέσα** στο πλαίσιο (`renderSplit(grid)`), όχι στη θέση του.
 *   Π2/Π3 — το πλαίσιο με `grid` ανοίγει τις λεπτομέρειες: side peek στο desktop, φύλλο στο κινητό (`ListDetailsSplit`).
 * Το πλάτος το δίνει το `useIsMobile` (το jsdom δεν έχει διάταξη): ελέγχεται **ποιο δέντρο στήνεται**, όχι pixels.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Package } from 'lucide-react';
import { SalesListPageShell, type SalesListPageChrome } from '../sales-list-page-shell';
import { SalesSpaceSidebar } from '../SalesSpaceSidebar';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let mobile = false;
jest.mock('@/hooks/useMobile', () => ({ useIsMobile: () => mobile }));

// Ο σκελετός γύρω από το σώμα δεν είναι το θέμα εδώ — μόνο η απόφαση «τι αποδίδεται στο σώμα».
jest.mock('@/components/sales/page/SalesAvailableHeader', () => ({ SalesAvailableHeader: () => null }));
jest.mock('@/components/property-management/dashboard/UnifiedDashboard', () => ({ UnifiedDashboard: () => null }));
jest.mock('@/components/core/AdvancedFilters', () => ({ ResponsiveFiltersPanel: () => null }));
jest.mock('@/components/shared/audit/ActivityTab', () => ({ ActivityTab: () => null }));

const chrome = (viewMode: 'list' | 'grid'): SalesListPageChrome => ({
  viewMode,
  setViewMode: jest.fn(),
  showDashboard: false,
  setShowDashboard: jest.fn(),
  showFilters: false,
  setShowFilters: jest.fn(),
} as unknown as SalesListPageChrome);

function renderShell(viewMode: 'list' | 'grid', renderSplit: (grid?: React.ReactNode) => React.ReactNode) {
  return render(
    <SalesListPageShell
      labels={{ title: 'Τ', subtitle: 'Υ', searchPlaceholder: 'Α' }}
      loading={false}
      loadingIcon={Package}
      loadingMessage="…"
      chrome={chrome(viewMode)}
      stats={[]}
      onSearchChange={jest.fn()}
      filtersConfig={{ title: '', rows: [] } as never}
      filters={{} as never}
      onFiltersChange={jest.fn()}
      renderSplit={renderSplit}
      renderGrid={() => <section aria-label="πλέγμα" />}
    />,
  );
}

describe('Π1 — ο σκελετός βάζει το πλέγμα ΜΕΣΑ στο πλαίσιο λεπτομερειών', () => {
  it('πλέγμα ⇒ `renderSplit(πλέγμα)`· λίστα ⇒ `renderSplit()` χωρίς πλέγμα', () => {
    const grid = jest.fn<React.ReactNode, [React.ReactNode?]>((g) => g ?? <p>λίστα</p>);
    renderShell('grid', grid);
    expect(grid).toHaveBeenLastCalledWith(expect.anything());
    expect(screen.getByLabelText('πλέγμα')).toBeTruthy();

    const list = jest.fn<React.ReactNode, [React.ReactNode?]>((g) => g ?? <p>λίστα</p>);
    renderShell('list', list);
    expect(list).toHaveBeenLastCalledWith(undefined);
  });
});

interface Item { id: string; name: string }
const ITEM: Item = { id: 's1', name: 'Αποθήκη 1' };

function renderSidebar(selected: Item | null, grid?: React.ReactNode) {
  return render(
    <SalesSpaceSidebar<Item>
      items={[ITEM]}
      selectedItem={selected}
      selectedItemId={selected?.id ?? null}
      onSelectItem={jest.fn()}
      icon={Package}
      labels={{
        listLabel: 'λίστα', listTitle: 'Αποθήκες', noResults: '—', detailsTitle: 'Λεπτομέρειες',
        openInSpaces: 'άνοιγμα', infoTab: 'Στοιχεία', historyTab: 'Ιστορικό',
      }}
      redirectTabs={[]}
      entityType="storage"
      spacesHref={() => '/spaces/storage'}
      getTitle={(item) => item.name}
      getSubtitle={() => undefined}
      renderDetailPanel={() => <p>πάνελ-στοιχείων</p>}
      renderCard={(item) => <p>{item.name}</p>}
      quickFilters={null}
      grid={grid}
    />,
  );
}

const peekPanel = () => document.querySelector('[data-details-peek]');
const sheet = () => document.querySelector('[role="dialog"] [data-details-sheet]');

describe('Π2/Π3 — πλέγμα + επιλογή ⇒ οι λεπτομέρειες ΑΝΟΙΓΟΥΝ', () => {
  beforeEach(() => { mobile = false; });

  it('Π2 — desktop: το πλέγμα στη θέση της λίστας και side peek με τις λεπτομέρειες', () => {
    renderSidebar(ITEM, <section aria-label="πλέγμα" />);
    expect(screen.getByLabelText('πλέγμα')).toBeTruthy();
    expect(screen.queryByLabelText('λίστα')).toBeNull();
    expect(peekPanel()).not.toBeNull();
    expect(screen.getByText('πάνελ-στοιχείων')).toBeTruthy();
  });

  it('Π2β — desktop, χωρίς επιλογή: μόνο το πλέγμα, κανένα panel', () => {
    renderSidebar(null, <section aria-label="πλέγμα" />);
    expect(peekPanel()).toBeNull();
  });

  it('Π3 — κινητό: φύλλο λεπτομερειών', () => {
    mobile = true;
    renderSidebar(ITEM, <section aria-label="πλέγμα" />);
    expect(sheet()).not.toBeNull();
    expect(screen.getByText('πάνελ-στοιχείων')).toBeTruthy();
  });

  it('Π4 — χωρίς `grid` η λίστα μένει: στήλη λίστας + λεπτομέρειες, όχι peek', () => {
    renderSidebar(ITEM);
    expect(screen.getByLabelText('λίστα')).toBeTruthy();
    expect(peekPanel()).toBeNull();
    expect(screen.getByText('πάνελ-στοιχείων')).toBeTruthy();
  });
});
