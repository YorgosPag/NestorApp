/**
 * Άγκυρες **του ίδιου του πάνελ** — τι ζωγραφίζει, ανά ακροατήριο (ADR-777 §2.2).
 *
 * 🔴 **ΓΙΑΤΙ ΔΕΝ ΑΡΚΕΙ ΤΟ `map-chrome.test.ts`.** Εκείνο αποδεικνύει ότι ο **πίνακας**
 * λέει «χωρίς συντεταγμένες». Αυτό εδώ αποδεικνύει ότι ο **ζωγράφος τον ακούει**.
 * Είναι το ακριβές μάθημα της Φ.1 του ADR-771: όταν άλλαξε η γωνία του σημαδιού,
 * **και τα 170** υπάρχοντα tests έμειναν πράσινα, γιατί καμία άγκυρα δεν κλείδωνε
 * **τι** ζωγραφίζεται. Μια πύλη χωρίς άγκυρα ζωγράφου δεν είναι πύλη.
 *
 * ⚠️ Το `t` επιστρέφει το **κλειδί**: η άγκυρα κλειδώνει *ποια ερωτήματα κάνει η
 * οθόνη*, όχι τη διατύπωση — που αλλιώς θα χαλάρωνε σε κάθε διόρθωση κειμένου.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { GeoCoordinateDisplay } from '../GeoCoordinateDisplay';
import { MAP_CHROME } from '../../../config/map-chrome';
import type { GeoCoordinate } from '../../../types';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}::${JSON.stringify(params)}` : key,
  }),
}));

// Ο δείκτης μεγεθών είναι εντελώς πλευρικός για το ερώτημα «τι φαίνεται;».
jest.mock('@/hooks/useIconSizes', () => ({
  useIconSizes: () => ({ xs: 'h-3 w-3', sm: 'h-4 w-4', lg: 'h-6 w-6' }),
}));

/**
 * ⚠️ Το Radix `Tooltip` απαιτεί `TooltipProvider` και δεν προσφέρει τίποτα στο ερώτημα.
 * Αντικαθίσταται με **διάφανο** wrapper: το κουμπί μένει **ακριβώς** ό,τι αποδίδει ο
 * ζωγράφος, ώστε η μέτρηση κουμπιών να μη μετρά κέλυφος βιβλιοθήκης.
 */
jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}));

const HOVERED: GeoCoordinate = { lat: 40.6401, lng: 22.9444, alt: 12 } as GeoCoordinate;

function renderPanel(
  preset: keyof typeof MAP_CHROME,
  overrides?: { hoveredCoordinate?: GeoCoordinate | null; clickMode?: 'off' | 'add_geo' }
) {
  const capabilities = MAP_CHROME[preset];
  // ⚠️ ΟΧΙ `??`: το `null` **είναι** έγκυρη τιμή εδώ («δεν υπάρχει hover») και το `??`
  // θα το κατάπινε, οπότε η άγκυρα «χωρίς hover» θα έτρεχε **με** hover — δηλαδή θα
  // απέτυχε για λάθος λόγο, ή χειρότερα θα περνούσε για λάθος λόγο.
  const hovered = overrides && 'hoveredCoordinate' in overrides
    ? overrides.hoveredCoordinate
    : HOVERED;

  return render(
    <GeoCoordinateDisplay
      hoveredCoordinate={hovered ?? null}
      currentMapStyle="osm"
      onMapStyleChange={() => {}}
      clickMode={overrides?.clickMode ?? 'off'}
      basemaps={capabilities.basemaps}
      basemapSwitcher={capabilities.basemapSwitcher}
      coordinateReadout={capabilities.coordinateReadout}
    />
  );
}

// =============================================================================
// Κ1 — 🔴 ΤΟ ΔΗΜΟΣΙΟ ΠΑΝΕΛ
// =============================================================================

describe('Κ1 — showcase: δύο κουμπιά με λέξεις, και τίποτα άλλο', () => {
  it('ακριβώς ΔΥΟ κουμπιά', () => {
    renderPanel('showcase');
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('τα κουμπιά ΛΕΝΕ τι είναι — ορατό κείμενο, όχι μόνο tooltip (Α8)', () => {
    renderPanel('showcase');
    expect(screen.getByRole('button', { name: 'map.basemap.map' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'map.basemap.satellite' })).toBeInTheDocument();
  });

  it('🔴 ΚΑΜΙΑ συντεταγμένη, ΚΑΝΕΝΑ υψόμετρο — ακόμη και με ενεργό hover', () => {
    renderPanel('showcase', { hoveredCoordinate: HOVERED });
    expect(screen.queryByText(/map\.coordinate\.longitude/)).not.toBeInTheDocument();
    expect(screen.queryByText(/map\.coordinate\.latitude/)).not.toBeInTheDocument();
    expect(screen.queryByText(/map\.coordinate\.altitude/)).not.toBeInTheDocument();
    // ⚠️ ΟΧΙ σκέτο `queryByRole('region')`: το ίδιο το `<section aria-label>` **είναι**
    // region. Ρωτάμε ονομαστικά την περιοχή των συντεταγμένων.
    expect(
      screen.queryByRole('region', { name: 'map.coordinate.currentPosition' })
    ).not.toBeInTheDocument();
  });

  it('καμία επικεφαλίδα «Στυλ:» — τα κουμπιά ήδη λένε τι είναι', () => {
    renderPanel('showcase');
    expect(screen.queryByText('map.styleSelector.style')).not.toBeInTheDocument();
  });

  it('🔑 η ομάδα κρατά ετικέτα για τον αναγνώστη οθόνης', () => {
    renderPanel('showcase');
    expect(screen.getByRole('group', { name: 'map.styleSelector.quickSwitcher' })).toBeInTheDocument();
  });

  it('το ενεργό υπόβαθρο δηλώνεται με `aria-pressed`, όχι μόνο με χρώμα (WCAG 1.4.1)', () => {
    renderPanel('showcase');
    expect(screen.getByRole('button', { name: 'map.basemap.map' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'map.basemap.satellite' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('🔴 και το ενεργό ξεχωρίζει με ΜΗ-ΧΡΩΜΑΤΙΚΟ κανάλι (βάρος + δακτύλιος)', () => {
    // Στο σκοτεινό θέμα `--primary` == `--card` ⇒ μόνο-χρωματική σήμανση θα ήταν 1,00:1.
    renderPanel('showcase');
    const active = screen.getByRole('button', { name: 'map.basemap.map' });
    expect(active.className).toContain('font-semibold');
    expect(active.className).toContain('ring-1');
    expect(active.className).not.toContain('bg-primary');
  });
});

// =============================================================================
// Κ2 — ΤΑ ΕΣΩΤΕΡΙΚΑ ΕΡΓΑΛΕΙΑ ΔΕΝ ΕΧΑΣΑΝ ΤΙΠΟΤΑ
// =============================================================================

describe('Κ2 — embedded / workspace: το εργαλείο μένει εργαλείο', () => {
  it.each(['workspace', 'embedded'] as const)('%s κρατά και τα 7 υπόβαθρα', (preset) => {
    renderPanel(preset);
    expect(screen.getAllByRole('button')).toHaveLength(7);
  });

  it.each(['workspace', 'embedded'] as const)('%s κρατά τις συντεταγμένες', (preset) => {
    renderPanel(preset);
    expect(screen.getByText(/map\.coordinate\.longitude/)).toBeInTheDocument();
    expect(screen.getByText(/map\.coordinate\.latitude/)).toBeInTheDocument();
    expect(screen.getByText(/map\.coordinate\.altitude/)).toBeInTheDocument();
  });

  it('η επικεφαλίδα «Στυλ:» μένει στην εικονική λειτουργία — τα εικονίδια δεν λένε', () => {
    renderPanel('workspace');
    expect(screen.getByText('map.styleSelector.style')).toBeInTheDocument();
  });

  it('χωρίς hover δεν εφευρίσκεται συντεταγμένη', () => {
    renderPanel('embedded', { hoveredCoordinate: null });
    expect(screen.queryByText(/map\.coordinate\.longitude/)).not.toBeInTheDocument();
  });

  it('χωρίς ενεργή επιλογή σημείου δεν υπάρχει προτροπή', () => {
    renderPanel('workspace', { clickMode: 'off' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('με ενεργή επιλογή σημείου η προτροπή εμφανίζεται', () => {
    renderPanel('workspace', { clickMode: 'add_geo' });
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

// =============================================================================
// Κ3 — Η ΕΠΙΦΑΝΕΙΑ: ΤΟ ΑΟΡΑΤΟ ΚΕΙΜΕΝΟ ΔΕΝ ΞΑΝΑΓΥΡΙΖΕΙ
// =============================================================================

describe('Κ3 — η επιφάνεια του πάνελ είναι θεματική', () => {
  it('🔴 ΚΑΝΕΝΑ `text-white` — έδινε 1,13:1 στο φωτεινό θέμα', () => {
    const { container } = renderPanel('showcase');
    expect(container.innerHTML).not.toContain('text-white');
  });

  it('🔴 ΚΑΝΕΝΑ `bg-opacity-` — ήταν αδρανές πάνω σε arbitrary bg (Tailwind 3.4)', () => {
    const { container } = renderPanel('showcase');
    expect(container.innerHTML).not.toContain('bg-opacity-');
  });

  it('σημασιολογικό ζεύγος `bg-card` / `text-card-foreground`', () => {
    renderPanel('showcase');
    const panel = screen.getByRole('region', { hidden: true }) ?? null;
    void panel;
    const section = document.querySelector('section');
    expect(section?.className).toContain('bg-card');
    expect(section?.className).toContain('text-card-foreground');
  });
});
