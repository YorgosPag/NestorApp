/**
 * 🔴 **«ΦΟΡΤΩΝΕΙ» ΧΩΡΙΣ ΜΕΤΑΤΟΠΙΣΗ** — άγκυρα του `ListMapPending` (ADR-896 §7Α.7).
 *
 * Το jsdom δεν έχει διάταξη: εδώ κλειδώνεται η **υπόσχεση** — η κράτηση ύψους είναι η κλάση του
 * SSoT (`LIST_MAP_PENDING`), ο σκελετός είναι κρυφός από την προσβασιμότητα, και ο αναγνώστης
 * οθόνης ακούει μία φράση. Το CLS μετριέται ζωντανά (`/pro`: 0,0891 πριν).
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ListMapMapPending, ListMapPending } from '../ListMapPending';
import { LIST_MAP_MAP_PANE, LIST_MAP_PENDING } from '../list-map-layout';

describe('ListMapPending — κράτηση θέσης λίστας', () => {
  it('🔴 κρατά το ύψος της πρώτης οθόνης από το SSoT — όχι δικό του αριθμό', () => {
    render(<ListMapPending label="loading-pros" />);
    const status = screen.getByRole('status');
    for (const token of LIST_MAP_PENDING.split(' ')) expect(status).toHaveClass(token);
  });

  it('🔴 ΙΔΙΟ ύψος με το sticky πάνελ του χάρτη — μία απάντηση στο «πόση πρώτη οθόνη;»', () => {
    const height = (classes: string, prefix: string) =>
      classes.split(' ').find((token) => token.startsWith(prefix))?.slice(prefix.length);
    expect(height(LIST_MAP_PENDING, 'min-h-')).toBe(height(LIST_MAP_MAP_PANE, 'h-'));
  });

  it('♿ μία φράση για τον αναγνώστη οθόνης· οι σκελετοί είναι κρυφοί', () => {
    const { container } = render(<ListMapPending label="loading-pros" />);
    expect(screen.getByRole('status')).toHaveTextContent('loading-pros');
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(container.querySelectorAll('[aria-hidden="true"] li').length).toBeGreaterThan(0);
  });
});

describe('ListMapMapPending — κράτηση θέσης χάρτη (ένα SSoT για /pro και /offers)', () => {
  it('γεμίζει τον περιέκτη του χάρτη και λέει τη δική του ετικέτα', () => {
    render(<ListMapMapPending label="loading-map" />);
    const pending = screen.getByText('loading-map');
    expect(pending).toHaveClass('h-full');
    expect(pending).toHaveAttribute('aria-busy', 'true');
  });
});
