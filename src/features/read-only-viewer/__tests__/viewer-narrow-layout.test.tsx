/**
 * 🔴 **ΟΙ ΑΓΚΥΡΕΣ ΤΟΥ ΘΕΑΤΗ ΣΕ ΣΤΕΝΗ ΟΘΟΝΗ** — ADR-777 §8.20 · SPEC-777D §26.8.
 *
 * Χωρίς αυτές, η επιστροφή στις **τρεις καθηλωμένες στήλες** περνά **πράσινη**: μέχρι τις
 * 2026-08-11 ολόκληρο το `features/read-only-viewer/` είχε **μηδέν** άγκυρα διάταξης, και το
 * ελάττωμα (κεντρικό πάνελ **ακριβώς 0 px** στα 515 px) έζησε αόρατο επειδή **κανείς δεν
 * ρωτούσε**.
 *
 * ⚠️ **ΤΙ ΑΠΟΔΕΙΚΝΥΟΥΝ ΚΑΙ ΤΙ ΟΧΙ — δηλωμένο, όχι υπονοούμενο.** Το jsdom **δεν έχει
 * διάταξη**: δεν εφαρμόζει `@media`, δεν λύνει `flex`, κάθε πλάτος είναι 0. Άρα εδώ
 * αποδεικνύεται η **απόφαση** — ποιο πάνελ δηλώνεται ορατό, τι αναφέρει η οθόνη, ποιος
 * φτάνει τι — **όχι** η γεωμετρία, που είναι του περιηγητή εξ ορισμού. Τη γεωμετρία την
 * απέδειξε **ζωντανή** μέτρηση σε πραγματικό στενό παράθυρο (SPEC-777D §26.8.4).
 */

import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render } from '@testing-library/react';
import '@testing-library/jest-dom';

import { MOBILE_BREAKPOINT } from '@/constants/layout';
import {
  VIEWER_DETAIL_HISTORY_KEY,
  VIEWER_PANE_ATTRIBUTE,
  VIEWER_PANES,
  reportedViewerPane,
} from '../viewer-panes';

// ── Μίμηση των βαρέων παιδιών ────────────────────────────────────────────────
// Κρατιούνται **ελάχιστα επίτηδες**: το ερώτημα εδώ είναι «ποιο πάνελ δηλώνεται ορατό», όχι
// «τι ζωγραφίζει ο προβολέας κατόψεων».

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
}));

jest.mock('@/lib/design-system', () => ({}), { virtual: true });

jest.mock('@/hooks/useLayoutClasses', () => ({
  useLayoutClasses: () => ({ listGapResponsive: 'gap-1', listPaddingResponsive: 'px-1' }),
}));

jest.mock('@/hooks/useSpacingTokens', () => ({
  useSpacingTokens: () => ({ padding: { sm: 'p-2', none: 'p-0' } }),
}));

jest.mock('@/hooks/useIconSizes', () => ({
  useIconSizes: () => ({ sm: 'h-4 w-4' }),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

// Το φύλλο μιμείται **τη μοναδική ιδιότητα που κρίνεται**: προσαρτά περιεχόμενο μόνο όταν
// είναι ανοιχτό — ακριβώς όπως το Radix.
jest.mock('@/components/ui/sheet', () => ({
  Sheet: ({ open, children }: { open?: boolean; children?: React.ReactNode }) =>
    open ? <div data-testid="details-sheet">{children}</div> : null,
  SheetContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/property-viewer/PropertyList', () => ({
  PropertyList: () => <div data-testid="property-list" />,
}));

jest.mock('@/components/property-viewer/PropertyDetailsPanel', () => ({
  PropertyDetailsPanel: () => <div data-testid="details-panel" />,
}));

jest.mock('@/components/property-viewer/PropertyHoverInfo', () => ({
  PropertyHoverInfo: () => <div data-testid="hover-info" />,
}));

jest.mock('@/components/property-viewer/PropertyStatusLegend', () => ({
  PropertyStatusLegend: () => <div data-testid="legend" />,
}));

jest.mock('../components/ReadOnlyMediaViewer', () => ({
  ReadOnlyMediaViewer: () => <div data-testid="media-viewer" />,
  MEDIA_TAB_PARAM: 'mediaTab',
  parseMediaTabParam: () => 'floorplans',
}));

// eslint-disable-next-line import/first -- τα mocks οφείλουν να δηλωθούν πριν την εισαγωγή
import { ListLayout } from '../components/ListLayout';

const PROPERTY = { id: 'p1', name: 'Διαμέρισμα Α1', floorId: 'f1' } as never;

function mount(viewport: 'measuring' | 'narrow' | 'wide', selectedIds: string[], onSelect = jest.fn()) {
  const view = render(
    <ListLayout
      isLoading={false}
      filteredProperties={[PROPERTY]}
      selectedPropertyIds={selectedIds}
      handlePolygonSelect={onSelect}
      hoveredPropertyId={null}
      viewport={viewport}
      viewerProps={{ properties: [PROPERTY], onSelectFloor: jest.fn() }}
    />
  );
  const root = view.container.querySelector<HTMLElement>(`[${VIEWER_PANE_ATTRIBUTE}]`);
  if (!root) throw new Error('Το δοχείο των πάνελ δεν αποδόθηκε.');
  return { view, root, onSelect, panes: Array.from(root.children) as HTMLElement[] };
}

/**
 * ⚠️ **Κρίνεται η ΔΗΛΩΣΗ, όχι η γεωμετρία** — το jsdom δεν εφαρμόζει `@media`. Το «φαίνεται
 * στη στενή;» σημαίνει «η κλάση `hidden` **λείπει**», και το «επανέρχεται στην ευρεία;»
 * σημαίνει «υπάρχει `md:flex`». Ο περιηγητής κάνει το υπόλοιπο, και το απέδειξε η ζωντανή
 * μέτρηση.
 */
const visibleInNarrow = (el: HTMLElement): boolean => !/\bhidden\b/.test(el.className);
const returnsAtMd = (el: HTMLElement): boolean => el.className.includes('md:flex');

describe('Θ — Ένας αριθμός, και κανένα δεύτερο κατώφλι', () => {
  it('Θ1: το `md` του Tailwind ΕΙΝΑΙ το MOBILE_BREAKPOINT', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires -- CommonJS-only εσωτερικά του Tailwind
    const { loadConfig } = require('tailwindcss/lib/lib/load-config');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const resolveConfig = require('tailwindcss/resolveConfig');

    const resolved = resolveConfig(loadConfig(join(process.cwd(), 'tailwind.config.ts')));

    // Αν αποκλίνουν, υπάρχει ζώνη πλάτους όπου το CSS δείχνει **τρεις στήλες** ενώ η
    // συμπεριφορά νομίζει «στενή»: πίσω κουμπί που καθαρίζει επιλογή χωρίς λόγο.
    expect(resolved.theme.screens.md).toBe(`${MOBILE_BREAKPOINT}px`);
  });

  it('Θ2: ο θεατής δεν κρατά ΔΕΥΤΕΡΟ κατώφλι διάταξης, ούτε ωμό pixel', () => {
    // 🔴 Τα σχόλια στρίβονται ΠΡΙΝ τη σάρωση: αλλιώς κάθε αρχείο που **εξηγεί** το λάθος
    // γίνεται το λάθος (Π2 του handoff· ίδιο μάθημα με το `Κ7β` του CHECK 3.50).
    const withoutComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    const sources = ['components/ListLayout.tsx', 'components/ViewerNarrowBar.tsx', 'components/ViewerDetailsSheet.tsx']
      .map((f) => withoutComments(readFileSync(join(__dirname, '..', f), 'utf8')))
      .join('\n');

    expect(sources).not.toMatch(/\blg:/);
    expect(sources).not.toMatch(/\bsm:(flex|hidden|grid|w-)/);
    expect(sources).not.toMatch(/max-width:\s*\d/);
    // Το `md:` **πρέπει** να υπάρχει — αλλιώς δεν υπάρχει καθόλου ευρεία διάταξη.
    expect(sources).toMatch(/\bmd:/);
  });
});

describe('Θ — Η αναφορά λέει «δεν ξέρω» όταν δεν ξέρει', () => {
  it('Θ3: το λεξιλόγιο περιέχει το `measuring` και τις τρεις πραγματικές καταστάσεις', () => {
    expect(new Set(VIEWER_PANES)).toEqual(new Set(['measuring', 'list', 'media', 'columns']));
  });

  it('Θ4: το `measuring` ΔΕΝ συμπτύσσεται — ούτε σε «στήλες», ούτε σε «λίστα»', () => {
    // Το ελάττωμα που έπιασε μόνο η ζωντανή επαλήθευση στο §26.7: η αναφορά έλεγε «στήλη»
    // στον διακομιστή **κάθε** συσκευής, χωρίς να έχει μετρήσει τίποτα.
    expect(reportedViewerPane('measuring', false)).toBe('measuring');
    expect(reportedViewerPane('measuring', true)).toBe('measuring');

    expect(reportedViewerPane('wide', false)).toBe('columns');
    expect(reportedViewerPane('wide', true)).toBe('columns');
    expect(reportedViewerPane('narrow', false)).toBe('list');
    expect(reportedViewerPane('narrow', true)).toBe('media');
  });

  it('Θ5: η οθόνη αναφέρει στο DOM ό,τι λέει η αυθεντία', () => {
    for (const [viewport, ids, expected] of [
      ['measuring', [], 'measuring'],
      ['narrow', [], 'list'],
      ['narrow', ['p1'], 'media'],
      ['wide', ['p1'], 'columns'],
    ] as const) {
      const { root, view } = mount(viewport, [...ids]);
      expect(root.getAttribute(VIEWER_PANE_ATTRIBUTE)).toBe(expected);
      view.unmount();
    }
  });
});

describe('Θ — Ένα πάνελ τη φορά στη στενή· τρία στην ευρεία', () => {
  it('Θ6: ΧΩΡΙΣ επιλογή φαίνεται Η ΛΙΣΤΑ, και μόνο αυτή', () => {
    const { panes } = mount('narrow', []);
    const [list, media, details] = panes;

    expect(visibleInNarrow(list)).toBe(true);
    expect(visibleInNarrow(media)).toBe(false);
    expect(visibleInNarrow(details)).toBe(false);
    // …και τα δύο που υποχώρησαν επανέρχονται στην ευρεία — δεν διαγράφηκαν, μετακινήθηκαν.
    expect(returnsAtMd(media)).toBe(true);
    expect(returnsAtMd(details)).toBe(true);
  });

  it('Θ7: ΜΕ επιλογή, η λίστα υποχωρεί και ο προβολέας παίρνει τη θέση της', () => {
    const { panes } = mount('narrow', ['p1']);
    const [list, media] = panes;

    // Material 3: «selection of a list item displays the detail **in place of** the list».
    expect(visibleInNarrow(list)).toBe(false);
    expect(returnsAtMd(list)).toBe(true);
    expect(visibleInNarrow(media)).toBe(true);
  });

  it('Θ7β: η στήλη λεπτομερειών λείπει από τη στενή ΑΝΕΞΑΡΤΗΤΑ από την επιλογή', () => {
    // Είναι το **βοηθητικό** πάνελ: στη στενή ταξιδεύει στο φύλλο, ποτέ δεν γίνεται στήλη.
    for (const ids of [[], ['p1']]) {
      const { panes, view } = mount('narrow', ids);
      expect(visibleInNarrow(panes[2])).toBe(false);
      expect(returnsAtMd(panes[2])).toBe(true);
      view.unmount();
    }
  });

  it('Θ8: 🔴 ο προβολέας ΔΕΝ συνυπάρχει ΠΟΤΕ με δύο καθηλωμένες πλευρές στη στενή', () => {
    // Αυτή είναι η άγκυρα του ίδιου του ελαττώματος: `flex-1` ανάμεσα σε δύο `shrink-0`
    // των 360 px δίνει **ακριβώς 0 px**. Όποτε ο προβολέας δηλώνεται ορατός στη στενή,
    // **καμία** πλευρά δεν επιτρέπεται να είναι ταυτόχρονα ορατή εκεί.
    const { panes } = mount('narrow', ['p1']);
    const [list, media, details] = panes;

    expect(visibleInNarrow(media)).toBe(true);
    for (const side of [list, details]) {
      expect(visibleInNarrow(side)).toBe(false);
      // Οι δύο πλευρές είναι **ακριβώς** αυτές που καθήλωναν 720 px.
      expect(side.className).toMatch(/w-\[360px\]/);
    }
  });

  it('Θ9: στην ευρεία και τα τρία πάνελ μένουν, ό,τι κι αν είναι επιλεγμένο', () => {
    for (const ids of [[], ['p1']]) {
      const { panes, view } = mount('wide', ids);
      // Κανένα δεν είναι κρυφό **χωρίς** επαναφορά στο `md` — δηλαδή κανένα δεν χάθηκε.
      for (const pane of panes.slice(0, 3)) {
        expect(visibleInNarrow(pane) || returnsAtMd(pane)).toBe(true);
      }
      view.unmount();
    }
  });
});

describe('Θ — Η επιστροφή στη λίστα, και η ταυτοδυναμία της', () => {
  it('Θ10: το ορατό «πίσω» καθαρίζει την επιλογή — ΠΟΤΕ δεν την εναλλάσσει', () => {
    const onSelect = jest.fn();
    const { root } = mount('narrow', ['p1'], onSelect);

    const back = root.querySelector<HTMLButtonElement>('nav button');
    if (!back) throw new Error('Το κουμπί επιστροφής δεν αποδόθηκε.');
    fireEvent.click(back);
    fireEvent.click(back);

    // 🔴 Η ταυτοδυναμία **είναι** το συμβόλαιο του `useSheetBackDismiss`: τη φωνάζουν δύο
    // δρόμοι. Αν περνούσε το επιλεγμένο id, ο μοναδικός γραφέας θα **εναλλάσσε** — δηλαδή
    // η δεύτερη κλήση θα ξανα-επέλεγε αυτό που μόλις έκλεισε.
    expect(onSelect).toHaveBeenCalledTimes(2);
    for (const call of onSelect.mock.calls) expect(call[0]).toBe('');
  });

  it('Θ11: κάθε επιφάνεια φέρνει ΔΙΚΟ της κλειδί ιστορικού — ποτέ κοινό', () => {
    const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    const resultsSheet = strip(
      readFileSync(join(process.cwd(), 'src/components/search-results/ResultsSheet.tsx'), 'utf8')
    );
    const hook = strip(
      readFileSync(join(process.cwd(), 'src/hooks/media/useSheetBackDismiss.ts'), 'utf8')
    );

    // Ο **μηχανισμός** είναι κοινός· η **ταυτότητα** όχι. Το κλειδί δεν επιτρέπεται να ζει
    // ξανά μέσα στον κοινό μηχανισμό, αλλιώς ο δεύτερος καταναλωτής το κληρονομεί σιωπηλά.
    expect(hook).not.toMatch(/__resultsSheetExpanded|__readOnlyViewerDetail/);
    expect(hook).toMatch(/historyKey/);
    expect(resultsSheet).toMatch(/__resultsSheetExpanded/);
    expect(VIEWER_DETAIL_HISTORY_KEY).not.toBe('__resultsSheetExpanded');
  });
});

describe('Θ — Το βοηθητικό πάνελ ανοίγει μόνο όπου υπάρχει', () => {
  it('Θ12: το φύλλο μένει κλειστό μέχρι να ζητηθεί', () => {
    const { view } = mount('narrow', ['p1']);
    expect(view.queryByTestId('details-sheet')).toBeNull();
  });

  it('Θ13: το κουμπί «Στοιχεία» το ανοίγει στη στενή', () => {
    const { root, view } = mount('narrow', ['p1']);
    const buttons = root.querySelectorAll<HTMLButtonElement>('nav button');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(view.queryByTestId('details-sheet')).not.toBeNull();
  });

  it('Θ14: 🔴 στην ευρεία ΔΕΝ ανοίγει ΠΟΤΕ — ακόμη κι αν πατηθεί η σκανδάλη', () => {
    // Το `SheetContent` φέρει `md:hidden`, αλλά το σκοτεινό στρώμα του Radix **όχι**: ένα
    // φύλλο «κρυμμένο» σε desktop θα άφηνε επικάλυψη πάνω σε τρεις κανονικές στήλες. Γι' αυτό
    // το άνοιγμα κρίνεται από τη **μέτρηση**, όχι μόνο από την πρόθεση του χρήστη.
    const { root, view } = mount('wide', ['p1']);
    const buttons = root.querySelectorAll<HTMLButtonElement>('nav button');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(view.queryByTestId('details-sheet')).toBeNull();
  });

  it('Θ14β: η γραμμή της στενής αποδίδεται ΠΑΝΤΑ και κρύβεται με CSS — ποτέ μετά τη μέτρηση', () => {
    // Το μάθημα του §26.7: χρώμιο που προσγειώνεται μόλις επιβεβαιωθεί «στενή» **σπρώχνει**
    // το περιεχόμενο. Άρα οφείλει να υπάρχει στο DOM και στις τρεις κλάσεις πλάτους.
    for (const viewport of ['measuring', 'narrow', 'wide'] as const) {
      const { root, view } = mount(viewport, ['p1']);
      const nav = root.querySelector<HTMLElement>('nav');
      expect(nav).not.toBeNull();
      expect(nav?.className).toContain('md:hidden');
      view.unmount();
    }
  });
});

describe('Θ — Τα κλειδιά υπάρχουν και στις δύο γλώσσες', () => {
  it('Θ15: κάθε ετικέτα της στενής οθόνης έχει el ΚΑΙ en', () => {
    const read = (lang: string) =>
      JSON.parse(
        readFileSync(join(process.cwd(), `src/i18n/locales/${lang}/properties-viewer.json`), 'utf8')
      ).viewer?.narrow ?? {};

    const el = read('el');
    const en = read('en');
    const expected = ['backToList', 'showDetails', 'detailsTitle', 'closeDetails'];

    for (const key of expected) {
      expect(typeof el[key]).toBe('string');
      expect(typeof en[key]).toBe('string');
      expect(el[key].length).toBeGreaterThan(0);
      expect(en[key].length).toBeGreaterThan(0);
    }
    // Καμία περισσότερη: ένα κλειδί χωρίς καταναλωτή είναι μετάφραση που δεν φτάνει πουθενά.
    expect(new Set(Object.keys(el))).toEqual(new Set(expected));
    expect(new Set(Object.keys(en))).toEqual(new Set(expected));
  });
});
