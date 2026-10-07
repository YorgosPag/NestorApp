/**
 * Η μπάρα ενοτήτων της αγγελίας (ADR-907 Φ2β-1).
 *
 * ⚠️ Το jsdom δεν έχει διάταξη: εδώ οι θέσεις των ενοτήτων **δίνονται** (`getBoundingClientRect`), ώστε να ελέγχεται η
 * σύνδεση μέτρηση → τρέχων σύνδεσμος. Το ότι η μπάρα πράγματι **κολλά** το βλέπει μόνο ο browser (ADR-907 §7).
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { LISTING_SECTIONS, ListingSectionAnchor, ListingSectionNav, listingSectionId } from '../ListingSectionNav';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function rect(top: number, bottom = top): DOMRect {
  return { top, bottom, left: 0, right: 0, width: 0, height: bottom - top, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
}

/** Η σελίδα: μπάρα + μία άγκυρα ανά ενότητα, με τις κορυφές που δίνει το test. */
function renderPage(tops: Readonly<Record<string, number>>) {
  const view = render(
    <>
      <ListingSectionNav />
      {LISTING_SECTIONS.map((section) => (
        <ListingSectionAnchor key={section} section={section}>{section}</ListingSectionAnchor>
      ))}
    </>,
  );
  jest.spyOn(screen.getByRole('navigation'), 'getBoundingClientRect').mockReturnValue(rect(0, 44));
  for (const section of LISTING_SECTIONS) {
    const element = document.getElementById(listingSectionId(section));
    if (element !== null) jest.spyOn(element, 'getBoundingClientRect').mockReturnValue(rect(tops[section] ?? 9999));
  }
  return view;
}

function scrollPage(): void {
  act(() => {
    document.dispatchEvent(new Event('scroll'));
    jest.runOnlyPendingTimers();
  });
}

function currentLabel(): string | null {
  return document.querySelector('[aria-current="location"]')?.textContent ?? null;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => window.setTimeout(() => callback(0), 0));
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => window.clearTimeout(handle));
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('ListingSectionNav', () => {
  it('Ν1 ένας σύνδεσμος ανά ενότητα, και ο καθένας δείχνει σε στόχο που ΥΠΑΡΧΕΙ', () => {
    renderPage({});
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(LISTING_SECTIONS.length);
    for (const link of links) {
      const href = link.getAttribute('href') ?? '';
      expect(href.startsWith('#')).toBe(true);
      expect(document.getElementById(href.slice(1))).not.toBeNull();
    }
  });

  it('Ν2 η μπάρα έχει όνομα και ΑΚΡΙΒΩΣ έναν τρέχοντα σύνδεσμο', () => {
    renderPage({ media: 120, price: 600, details: 1200, location: 2000, market: 2800, legal: 3600 });
    scrollPage();
    expect(screen.getByRole('navigation', { name: 'listing-detail:sections.label' })).toBeInTheDocument();
    expect(document.querySelectorAll('[aria-current]')).toHaveLength(1);
    expect(currentLabel()).toBe('listing-detail:sections.media');
  });

  it('🔴 Ν3 η κύλιση αλλάζει τον τρέχοντα σύνδεσμο — η γραμμή ανάγνωσης είναι κάτω από τη μπάρα', () => {
    const tops: Record<string, number> = { media: -900, price: -300, details: 60, location: 800, market: 1600, legal: 2400 };
    renderPage(tops);
    scrollPage();
    // Η ενότητα «στοιχεία» κάθεται στα 60px: πίσω από τη γραμμή (44 + 24), άρα είναι η τρέχουσα.
    expect(currentLabel()).toBe('listing-detail:sections.details');
  });

  it('🔴 Ν4 το πάτημα ΔΕΝ αλλάζει τη διεύθυνση και μεταφέρει την εστίαση στην ενότητα', () => {
    renderPage({ media: 120 });
    const before = window.location.href;
    const historyLength = window.history.length;
    fireEvent.click(screen.getByRole('link', { name: 'listing-detail:sections.market' }));
    expect(window.location.href).toBe(before);
    expect(window.history.length).toBe(historyLength);
    expect(document.activeElement).toBe(document.getElementById(listingSectionId('market')));
  });

  it('Ν5 Ctrl+κλικ μένει στον browser (νέα καρτέλα) — καμία μεταφορά εστίασης', () => {
    renderPage({ media: 120 });
    const link = screen.getByRole('link', { name: 'listing-detail:sections.legal' });
    const notPrevented = fireEvent.click(link, { ctrlKey: true });
    expect(notPrevented).toBe(true);
    expect(document.activeElement).not.toBe(document.getElementById(listingSectionId('legal')));
  });

  it('🔴 Ν7 ενότητα που ΚΟΛΛΑ (σύνοψη τιμής σε δύο στήλες) δεν γίνεται ποτέ «τρέχουσα»', () => {
    // Βρέθηκε στον browser στα 1440px: μέσα και τιμή έχουν την ίδια κορυφή, και η μπάρα τόνιζε «Τιμή» στην κορυφή της σελίδας.
    const realStyle = window.getComputedStyle.bind(window);
    jest.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
      const style = realStyle(element, pseudo);
      return (element as HTMLElement).id === listingSectionId('price') ? { ...style, position: 'sticky' } as CSSStyleDeclaration : style;
    });
    renderPage({ media: 262, price: 262, details: 1400, location: 2300, market: 2900, legal: 3100 });
    jest.spyOn(screen.getByRole('navigation'), 'getBoundingClientRect').mockReturnValue(rect(196, 245));
    scrollPage();
    expect(currentLabel()).toBe('listing-detail:sections.media');
  });

  it('Ν6 οι στόχοι δέχονται εστίαση χωρίς να μπαίνουν στη σειρά του Tab', () => {
    renderPage({});
    for (const section of LISTING_SECTIONS) {
      expect(document.getElementById(listingSectionId(section))?.getAttribute('tabindex')).toBe('-1');
    }
  });
});
