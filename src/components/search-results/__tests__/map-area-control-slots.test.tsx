/**
 * ADR-777 §8.85 — **ΤΑ ΧΕΙΡΙΣΤΗΡΙΑ ΤΟΥ ΧΑΡΤΗ ΖΟΥΝ ΣΤΗ ΘΕΣΗ ΤΟΥ ΡΟΛΟΥ ΤΟΥΣ**, όχι σε μία στοίβα στο κέντρο.
 *
 * 🔴 Η βλάβη που φρουρείται (στιγμιότυπο του Giorgio, 2026-10-02): τέσσερα κουμπιά σε μία κεντραρισμένη
 * στήλη σκέπαζαν τον χάρτη, επειδή κάθε ADR πρόσθετε μια σειρά. Εδώ ελέγχεται **η δομή** που το κάνει αδύνατο:
 * στη θέση `status` ζει **ΕΝΑ** στοιχείο, τα εργαλεία ζουν στην μπάρα (`nav` «Εργαλεία χάρτη»), και η
 * αποθήκευση **δεν** έχει πια υποδοχή στον χάρτη.
 */

import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import { TooltipProvider } from '@/components/ui/tooltip';
import { MapToolbarButton } from '@/subapps/geo-canvas/components/map-overlays/MapToolbar';
import { MAP_OVERLAY_SLOT } from '@/subapps/geo-canvas/components/map-overlays/map-overlay-slots';
import { MapAreaControl } from '../MapAreaControl';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

type Props = React.ComponentProps<typeof MapAreaControl>;

const DRAW = <MapToolbarButton label="draw" icon={<span />} onClick={() => undefined} />;
const LAYERS = <MapToolbarButton label="layers" icon={<span />} pressed={false} onClick={() => undefined} />;

function renderControl(overrides: Partial<Props> = {}) {
  const props: Props = {
    followMap: false,
    onFollowMapChange: jest.fn(),
    hasPendingArea: false,
    onSearchHere: jest.fn(),
    drawButton: DRAW,
    layerControl: LAYERS,
    ...overrides,
  };
  render(
    <TooltipProvider>
      <MapAreaControl {...props} />
    </TooltipProvider>
  );
  return props;
}

const toolbar = () => screen.getByRole('navigation', { name: 'search-results:area.tools' });
const pill = () => screen.getByRole('region', { name: 'search-results:area.followMap' });

describe('Α — δύο θέσεις, ποτέ μία στοίβα', () => {
  it('τα εργαλεία ζουν στην μπάρα του δεξιού άκρου, ΟΧΙ στη θέση status', () => {
    renderControl();
    expect(toolbar()).toHaveClass(...MAP_OVERLAY_SLOT.tools.split(' '));
    expect(within(toolbar()).getByRole('button', { name: 'draw' })).toBeInTheDocument();
    expect(within(toolbar()).getByRole('button', { name: 'layers' })).toBeInTheDocument();
    expect(within(pill()).queryByRole('button', { name: 'draw' })).toBeNull();
  });

  it('η θέση status κρατά ΕΝΑ στοιχείο — το χάπι', () => {
    renderControl();
    const slot = pill().parentElement;
    expect(slot).toHaveClass(...MAP_OVERLAY_SLOT.status.split(' '));
    expect(slot?.children).toHaveLength(1);
  });

  it('χωρίς κανένα εργαλείο δεν αποδίδεται άδεια μπάρα', () => {
    renderControl({ drawButton: null, layerControl: null });
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});

describe('Β — «Αναζήτηση εδώ» και διακόπτης: ΕΝΑ χάπι', () => {
  it('🔑 με εκκρεμή περιοχή το κουμπί μπαίνει ΜΕΣΑ στο χάπι — και ο διακόπτης ΜΕΝΕΙ', () => {
    const props = renderControl({ hasPendingArea: true });
    const button = within(pill()).getByRole('button', { name: 'search-results:area.searchHere' });
    expect(within(pill()).getByRole('switch')).toBeInTheDocument();
    fireEvent.click(button);
    expect(props.onSearchHere).toHaveBeenCalledTimes(1);
  });

  it('χωρίς εκκρεμή περιοχή δεν υπάρχει κουμπί — δεν έχει τι να πει', () => {
    renderControl();
    expect(screen.queryByRole('button', { name: 'search-results:area.searchHere' })).toBeNull();
    expect(within(pill()).getByRole('switch')).toBeInTheDocument();
  });

  it('ο διακόπτης είναι ονομασμένος από την ετικέτα του (στόχος κλικ)', () => {
    const props = renderControl();
    fireEvent.click(screen.getByRole('switch', { name: 'search-results:area.followMap' }));
    expect(props.onFollowMapChange).toHaveBeenCalledWith(true);
  });
});

describe('Γ — με όριο, το chip παίρνει τη θέση του χαπιού', () => {
  it('chip ⇒ ούτε διακόπτης ούτε χάπι· τα εργαλεία που δόθηκαν μένουν', () => {
    renderControl({ regionChip: <p>chip</p>, drawButton: null });
    expect(screen.getByText('chip')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(within(toolbar()).getByRole('button', { name: 'layers' })).toBeInTheDocument();
    expect(within(toolbar()).queryByRole('button', { name: 'draw' })).toBeNull();
  });
});

describe('Ε 🔴 — τίποτα στη θέση δεν ΚΟΒΕΙ το πάνελ που ξεχειλίζει (κινητό, βρέθηκε ζωντανά)', () => {
  /*
   * Το globals.css δίνει σε ≤640px `:where(.flex, .grid) { overflow-x: clip }`. Η θέση και η μπάρα είναι `.flex`,
   * άρα χωρίς ρητό `overflow-visible` το πάνελ τιμών (352px) φαινόταν ως στήλη 50px κάτω από την μπάρα. Το jsdom δεν
   * έχει διάταξη — γι' αυτό η άγκυρα ρωτά τη ΔΗΛΩΣΗ που νικά τον καθολικό κανόνα, σε κάθε `.flex` πρόγονο του πάνελ.
   */
  it('η θέση tools και η μπάρα δηλώνουν overflow-visible', () => {
    renderControl();
    const nav = toolbar();
    const ul = within(nav).getByRole('list');
    for (const el of [nav, ul]) {
      expect(el).toHaveClass('flex');
      expect(el).toHaveClass('overflow-visible');
    }
  });
});

describe('Δ — η μπάρα: όνομα σταθερό, κατάσταση στο aria-pressed', () => {
  it('εργαλείο με κατάσταση ⇒ aria-pressed· απλή πράξη ⇒ καθόλου', () => {
    renderControl({ layerControl: <MapToolbarButton label="layers" icon={<span />} pressed onClick={() => undefined} /> });
    expect(screen.getByRole('button', { name: 'layers' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'draw' })).not.toHaveAttribute('aria-pressed');
  });
});
