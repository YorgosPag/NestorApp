/**
 * **Όσο το φύλλο του κινητού είναι ανοιχτό, η σελίδα από κάτω δεν υπάρχει** (ADR-912 §12.16).
 *
 * 🔴 **Η αφορμή, στιγμιότυπο Giorgio 2026-10-17 23:08 (390px)**: η κάτω μπάρα [⋯][Προσθήκη Αρχείων] φαινόταν πάνω
 *   από τον θεατή αρχείου. Το φύλλο απλώς σκέπαζε· η στρώση z ήταν η μόνη άμυνα. Drive / iOS: ο θεατής είναι modal.
 *
 * ⚠️ Το jsdom δεν έχει διάταξη: εδώ αποδεικνύεται η **συμπεριφορά** (αδράνεια · κύλιση · focus), όχι το z.
 */

/* global describe, it, expect, jest, afterEach */

import { useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MobileDetailsSlideIn } from '../MobileDetailsSlideIn';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function Page() {
  const [open, setOpen] = useState(false);
  return (
    <main>
      <button type="button" onClick={() => setOpen(true)}>
        Συμβόλαιο.pdf
      </button>
      <footer data-testid="bar">
        <button type="button">Προσθήκη Αρχείων</button>
      </footer>
      <MobileDetailsSlideIn isOpen={open} onClose={() => setOpen(false)} title="Συμβόλαιο.pdf">
        <p>θεατής</p>
      </MobileDetailsSlideIn>
    </main>
  );
}

const pageRoot = () => screen.getByTestId('bar').closest('[inert]');

afterEach(() => {
  document.head.querySelectorAll('style[data-test-md-hidden]').forEach((el) => el.remove());
});

describe('Μ — το φύλλο του κινητού ως modal επιφάνεια', () => {
  it('🔴 Μ1 — ανοιχτό φύλλο ⇒ η σελίδα (και η κάτω μπάρα) είναι `inert`, το `body` δεν κυλά, το focus είναι στο φύλλο', async () => {
    render(<Page />);
    await userEvent.click(screen.getByRole('button', { name: 'Συμβόλαιο.pdf' }));

    const dialog = screen.getByRole('dialog', { name: 'Συμβόλαιο.pdf' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(pageRoot()).not.toBeNull();
    expect(dialog.closest('[inert]')).toBeNull();
    expect(document.body.classList.contains('overflow-hidden')).toBe(true);
    expect(dialog).toHaveFocus();
  });

  it('🔴 Μ2 — κλείσιμο ⇒ η σελίδα ξαναζωντανεύει και το focus γυρνά σε ό,τι άνοιξε το φύλλο', async () => {
    render(<Page />);
    await userEvent.click(screen.getByRole('button', { name: 'Συμβόλαιο.pdf' }));
    await userEvent.click(screen.getByRole('button', { name: 'actions.close' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(pageRoot()).toBeNull();
    expect(document.body.classList.contains('overflow-hidden')).toBe(false);
    expect(screen.getByRole('button', { name: 'Συμβόλαιο.pdf' })).toHaveFocus();
  });

  it('✅ Μ3 — φύλλο ανοιχτό αλλά ΚΡΥΜΜΕΝΟ (`md:hidden`, φαρδιά οθόνη) ⇒ καμία αδράνεια: η σελίδα δεν παγώνει', async () => {
    const style = document.createElement('style');
    style.setAttribute('data-test-md-hidden', '');
    style.textContent = '.md\\:hidden { display: none; }';
    document.head.appendChild(style);
    render(<Page />);
    await userEvent.click(screen.getByRole('button', { name: 'Συμβόλαιο.pdf' }));

    expect(pageRoot()).toBeNull();
    expect(document.body.classList.contains('overflow-hidden')).toBe(false);

    // Η οθόνη στενεύει ⇒ το φύλλο φαίνεται ⇒ τώρα είναι modal.
    act(() => {
      style.remove();
      window.dispatchEvent(new Event('resize'));
    });
    expect(pageRoot()).not.toBeNull();
  });
});
