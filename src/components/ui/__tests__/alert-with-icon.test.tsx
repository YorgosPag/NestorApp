/**
 * ADR-771 · ADR-900 §8 #2 (βήμα 2γ) — το κεντρικό `Alert` δίνει το ΔΕΥΤΕΡΟ κανάλι της κατάστασης (εικονίδιο) μόνο του.
 *
 * Πριν (μετρημένο 2026-10-05): το εικονίδιο ήταν ευθύνη κάθε καλούντα ⇒ 17 από τα 31 `variant="destructive"` δεν
 * είχαν κανένα, και τα μηνύματα αποτυχίας της ουράς επαληθεύσεων ήταν σκέτο `text-foreground` (WCAG 1.4.1).
 *
 * Μεταλλάξεις (2026-10-05): `withIcon` αγνοείται ⇒ Ε1 · πάντα εικονίδιο ⇒ Ε2 · ίδιο εικονίδιο σε κάθε παραλλαγή ⇒ Ε3.
 * ⚠️ Ισοδύναμος μεταλλαγμένος: η αφαίρεση του ρητού `aria-hidden` ΕΠΙΖΕΙ — το lucide το βάζει μόνο του όταν λείπει
 * `aria-label`. Το Ε1 καρφώνει το αποτέλεσμα (το εικονίδιο είναι κρυφό από την προσβασιμότητα), όχι ποιος το έγραψε.
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import { Alert, AlertDescription } from '../alert';

const iconOf = (alert: HTMLElement): SVGElement | null => alert.querySelector(':scope > svg');

describe('Alert · withIcon', () => {
  it('Ε1 — `withIcon` ⇒ ένα διακοσμητικό εικονίδιο ΠΡΙΝ από το κείμενο, μέσα στο `role="alert"`', () => {
    render(<Alert variant="destructive" withIcon><AlertDescription>αποτυχία</AlertDescription></Alert>);
    const alert = screen.getByRole('alert');
    const icon = iconOf(alert);

    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(alert.firstElementChild).toBe(icon);
    // Το όνομα της ειδοποίησης μένει το κείμενο — το εικονίδιο δεν προσθέτει λέξεις.
    expect(alert).toHaveTextContent(/^αποτυχία$/);
  });

  it('Ε2 — χωρίς `withIcon` τίποτα δεν αλλάζει (14 καλούντες περνούν δικό τους εικονίδιο ως παιδί)', () => {
    render(<Alert variant="destructive"><AlertDescription>αποτυχία</AlertDescription></Alert>);
    expect(iconOf(screen.getByRole('alert'))).toBeNull();
  });

  it('Ε3 — κάθε παραλλαγή έχει ΔΙΚΟ της σχήμα: η διαφορά δεν είναι μόνο χρώμα', () => {
    const { unmount } = render(<Alert variant="destructive" withIcon>α</Alert>);
    const destructive = iconOf(screen.getByRole('alert'))?.innerHTML;
    unmount();
    render(<Alert withIcon>β</Alert>);
    const neutral = iconOf(screen.getByRole('alert'))?.innerHTML;

    expect(destructive).toBeTruthy();
    expect(neutral).toBeTruthy();
    expect(destructive).not.toBe(neutral);
  });
});
