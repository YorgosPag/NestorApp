/**
 * Άγκυρες του διαλόγου συρσίματος — «Μόνο η θέση» και το ΟΡΑΤΟ σβήσιμο (2026-09-10, ADR-332 D27).
 *
 * 🔴 Χωρίς αυτά, για να διορθώσεις πινέζα σε δρόμο που το OSM ξέρει χωρίς αριθμούς
 * («Σαμοθράκης 16» → reverse geocode «Σαμοθράκης»), έπρεπε να **θυσιάσεις τον αριθμό** —
 * και ο διάλογος δεν το έλεγε: έδειχνε «Δεν υπάρχουν αλλαγές».
 *
 * 🔴 Βήμα Β: σύρσιμο **χωρίς** κείμενο (404 / timeout) δεν έφτανε καν στον διάλογο. Τώρα φτάνει,
 * και ο διάλογος πρέπει να ξέρει ότι δεν υπάρχει τι να «ενημερωθεί» (Δ6–Δ7).
 *
 * ⚠️ Χωρίς mock στη σύγκριση: οι διαφορές βγαίνουν από τον **πραγματικό** κριτή, ώστε
 * το «τι βλέπει ο άνθρωπος» να κρίνεται πάνω στον ίδιο κριτή που τρέχει στην οθόνη.
 */

/* global describe, it, expect, jest */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { AddressDragConfirmDialog } from '../editor/components/AddressDragConfirmDialog';
import type { ResolvedAddressFields } from '../editor/types';
import { storedAddressToResolved } from '@/utils/address/administrative-hierarchy';

const DECLARED = storedAddressToResolved(
  { street: 'Σαμοθράκης', number: '16', city: 'Ελευθέριο-Κορδελιό', postalCode: '56334' },
  'projectAddress',
);
const REVERSE = storedAddressToResolved(
  { street: 'Σαμοθράκης', city: 'Ελευθέριο-Κορδελιό', postalCode: '56334' },
  'projectAddress',
);
const MOVED = storedAddressToResolved(
  { street: 'Σαμοθράκης', number: '18', city: 'Ελευθέριο-Κορδελιό', postalCode: '56334' },
  'projectAddress',
);
const POSITION_ONLY = 'editor.dragConfirm.positionOnly';
const CONFIRM = 'editor.dragConfirm.confirm';
const KEEP_POSITION = 'editor.dragConfirm.noText.keepPosition';

const resolved = (address: ResolvedAddressFields) => ({ kind: 'resolved' as const, address });

function renderDialog(props: Partial<React.ComponentProps<typeof AddressDragConfirmDialog>> = {}) {
  const handlers = { onConfirm: jest.fn(), onCancel: jest.fn(), onConfirmPositionOnly: jest.fn() };
  render(
    <AddressDragConfirmDialog
      open
      currentAddress={DECLARED}
      proposal={resolved(REVERSE)}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe('Δ — ο διάλογος συρσίματος λέει τι ΘΑ ΓΙΝΕΙ', () => {
  it('Δ1 — «16 → κενό» ⇒ «Μόνο η θέση» υπάρχει και καλεί ΜΟΝΟ τον δικό της χειριστή', () => {
    const { onConfirm, onConfirmPositionOnly } = renderDialog();

    fireEvent.click(screen.getByText(POSITION_ONLY));

    expect(onConfirmPositionOnly).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Δ2 — ΠΑΡΟΝΟΜΑΣΤΗΣ: καλών που ΔΕΝ τη δίνει ⇒ δεν εμφανίζεται', () => {
    renderDialog({ onConfirmPositionOnly: undefined });
    expect(screen.queryByText(POSITION_ONLY)).not.toBeInTheDocument();
  });

  it('Δ3 — ΙΔΙΟ κείμενο ⇒ δεν εμφανίζεται (θα ήταν η ίδια πράξη με την «ενημέρωση»)', () => {
    renderDialog({ proposal: resolved(DECLARED) });
    expect(screen.queryByText(POSITION_ONLY)).not.toBeInTheDocument();
  });

  it('Δ4 — το ΣΒΗΣΙΜΟ φαίνεται με λέξη, και η εστίαση πάει στην ΑΣΦΑΛΗ επιλογή', () => {
    renderDialog();

    // Πριν: «Δεν υπάρχουν αλλαγές» — και το Enter έσβηνε τον αριθμό.
    expect(screen.getByText('editor.diff.cleared')).toBeInTheDocument();
    expect(screen.queryByText('editor.diff.noChanges')).not.toBeInTheDocument();
    expect(screen.getByText(POSITION_ONLY).closest('button')).toHaveFocus();
  });

  it('Δ5 — ΠΑΡΟΝΟΜΑΣΤΗΣ: αλλαγή ΧΩΡΙΣ σβήσιμο (16 → 18) ⇒ η εστίαση μένει στην «ενημέρωση»', () => {
    renderDialog({ proposal: resolved(MOVED) });

    expect(screen.queryByText('editor.diff.cleared')).not.toBeInTheDocument();
    expect(screen.getByText(CONFIRM).closest('button')).toHaveFocus();
  });
});

describe('Δ — Βήμα Β: θέση ΧΩΡΙΣ κείμενο («Dropped pin»)', () => {
  it('Δ6 — 404 ⇒ ΚΑΝΕΝΑ «Ναι, ενημέρωσε» (δεν υπάρχει τι)· «Μόνο η θέση» με εστίαση + εξήγηση', () => {
    const { onConfirmPositionOnly } = renderDialog({ proposal: { kind: 'not-found' } });

    expect(screen.queryByText(CONFIRM)).not.toBeInTheDocument();
    expect(screen.getByText('editor.dragConfirm.noText.notFound')).toBeInTheDocument();
    expect(screen.getByText(KEEP_POSITION)).toBeInTheDocument();
    const keep = screen.getByText(POSITION_ONLY).closest('button');
    expect(keep).toHaveFocus();
    fireEvent.click(keep as HTMLButtonElement);
    expect(onConfirmPositionOnly).toHaveBeenCalledTimes(1);
  });

  it('Δ7 — ΠΑΡΟΝΟΜΑΣΤΗΣ: καλών που ΔΕΝ αποθηκεύει θέση ⇒ μόνο «Ακύρωση», χωρίς ψεύτικη υπόσχεση', () => {
    renderDialog({ proposal: { kind: 'unavailable' }, onConfirmPositionOnly: undefined });

    expect(screen.getByText('editor.dragConfirm.noText.unavailable')).toBeInTheDocument();
    expect(screen.queryByText(CONFIRM)).not.toBeInTheDocument();
    expect(screen.queryByText(POSITION_ONLY)).not.toBeInTheDocument();
    expect(screen.queryByText(KEEP_POSITION)).not.toBeInTheDocument();
    expect(screen.getByText('editor.dragConfirm.cancel')).toBeInTheDocument();
  });
});
