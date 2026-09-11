/**
 * @jest-environment jsdom
 *
 * ADR-241 · ADR-711 — **Κάθε πλωτό πάνελ είναι συνοδός της πλήρους οθόνης.**
 *
 * Όσο είναι ενεργή η πλήρης οθόνη, ό,τι βρίσκεται έξω της γίνεται `inert` (`@/lib/a11y/inert-outside`). Τα πλωτά πάνελ
 * όμως ζωγραφίζονται **πάνω** της (η παλέτα του DXF αιωρείται σκόπιμα πάνω από την πλήρη οθόνη — μετρημένο ζωντανά
 * 2026-09-11: 1050 > 1045) — και ένα πάνελ που φαίνεται αλλά δεν απαντά είναι το χειρότερο δυνατό αποτέλεσμα.
 * Το σήμα ζει στη ρίζα του `FloatingPanel`, μία φορά: αν λείψει, **κάθε** πλωτό πάνελ νεκρώνει σε πλήρη οθόνη.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

import { FloatingPanel } from '../FloatingPanel';
import { INERT_COMPANION_SELECTOR, inertOutside } from '@/lib/a11y/inert-outside';

describe('Συνοδός — η ρίζα κάθε FloatingPanel', () => {
  test('φέρει το σήμα που εξαιρεί από την αδράνεια', async () => {
    render(
      <FloatingPanel defaultPosition={{ x: 10, y: 10 }} data-testid="panel">
        <button type="button">εργαλείο</button>
      </FloatingPanel>,
    );
    const panel = await waitFor(() => screen.getByTestId('panel'));
    expect(panel.matches(INERT_COMPANION_SELECTOR)).toBe(true);
  });

  test('μέσα σε πλήρη οθόνη μένει ζωντανό — και το κουμπί του πατιέται', async () => {
    const surface = document.createElement('section');
    document.body.appendChild(surface);
    render(
      <FloatingPanel defaultPosition={{ x: 10, y: 10 }} data-testid="panel">
        <button type="button">εργαλείο</button>
      </FloatingPanel>,
    );
    const panel = await waitFor(() => screen.getByTestId('panel'));
    const release = inertOutside([surface]);
    try {
      expect(panel.closest('[inert]')).toBeNull();
      expect(screen.getByText('εργαλείο').closest('[inert]')).toBeNull();
    } finally {
      release();
      surface.remove();
    }
  });
});
