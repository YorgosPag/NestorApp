/**
 * ADR-912 §12.18 — κάρτες ⇒ ενότητες μέσα σε επιφάνεια που είναι ήδη επιφάνεια (Apple / Google Maps place sheet).
 *
 * Το jsdom δεν εφαρμόζει CSS, άρα εδώ κλειδώνεται το ΣΥΜΒΟΛΑΙΟ ανάμεσα στα τρία κομμάτια — η απόδοση μετρήθηκε ζωντανά
 * (390×844, 12/12 ενότητες χωρίς πλαίσιο, γραμμή 1px από πάνω):
 *   (α) κάθε `Card` φορά το σήμα · (β) το CSS διαβάζει ΑΚΡΙΒΩΣ αυτό το σήμα · (γ) μόνο οι ενότητες πρώτου επιπέδου παίρνουν γραμμή.
 */
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import { Card, CARD_SECTIONS_SCOPE, CARD_SURFACE_MARKER } from '@/components/ui/card';

const MARKER = Object.keys(CARD_SURFACE_MARKER)[0];
const css = readFileSync(join(__dirname, '..', 'card-sections.module.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('card-sections — κάρτα ⇒ ενότητα μέσα σε δηλωμένο πεδίο', () => {
  it('Α1: κάθε `Card` φορά το σήμα — και με `asChild` (η επιφάνεια ΕΙΝΑΙ το `Card`)', () => {
    const { container } = render(
      <>
        <Card>div</Card>
        <Card asChild><section>section</section></Card>
      </>,
    );
    expect(container.querySelectorAll(`[${MARKER}]`)).toHaveLength(2);
    expect(container.querySelector('section')).toHaveAttribute(MARKER);
  });

  it('Α2: 🔴 το CSS διαβάζει το ΙΔΙΟ σήμα που γράφει το `Card` — αλλιώς πράσινο που δεν σβήνει κανένα πλαίσιο', () => {
    expect(css).toContain(`.scope [${MARKER}] {`);
    expect(css).toMatch(/border-width:\s*0/);
    expect(css).toMatch(/background-color:\s*transparent/);
    expect(css).toMatch(/box-shadow:\s*none/);
  });

  it('Α3: γραμμή ΜΟΝΟ στις ενότητες πρώτου επιπέδου, και ΑΠΟ ΠΑΝΩ (οι μη-κάρτες φέρνουν δικό τους `Separator` από πάνω)', () => {
    expect(css).toContain(`.scope [${MARKER}]:not([${MARKER}] [${MARKER}]) {`);
    expect(css).toMatch(/border-top:\s*1px solid hsl\(var\(--border\)\)/);
    expect(css).not.toMatch(/border-bottom/);
  });

  it('Α4: 🔴 ο διακόπτης είναι η ΕΠΙΦΑΝΕΙΑ — χωρίς πεδίο η κάρτα μένει κάρτα (καμία κλάση από μόνη της)', () => {
    const { container } = render(<Card className="x">c</Card>);
    expect(container.firstElementChild).not.toHaveClass(CARD_SECTIONS_SCOPE);
    expect(CARD_SECTIONS_SCOPE).toBe('scope');
  });
});
