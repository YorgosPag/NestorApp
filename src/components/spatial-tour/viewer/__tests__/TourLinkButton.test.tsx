/**
 * @jest-environment jsdom
 */
/**
 * ADR-884 Φ2στ · §4.12 — το βελάκι κρύβεται με το χαρακτηριστικό `hidden` (η σκηνή το γράφει ανά καρέ).
 *
 * 🔴 Ζωντανά 2026-09-27: η κλάση του βελακιού πατώματος είχε `flex` ⇒ το `display: flex` **νικά** το `[hidden] { display:
 * none }` του browser ⇒ το βελάκι εκτός κάδρου έμενε ορατό στο (0,0). Το jsdom δεν εφαρμόζει Tailwind, άρα ελέγχεται η
 * **κλάση του σφάλματος**: κουμπί που κρύβεται με `hidden` δεν φέρει βοηθητική κλάση display (χωρίς πρόθεμα παραλλαγής).
 */

import { render } from '@testing-library/react';

import { TourLinkButton } from '../TourLinkButton';

const DISPLAY_UTILITIES = new Set(['block', 'inline-block', 'inline', 'flex', 'inline-flex', 'grid', 'inline-grid', 'table', 'contents', 'flow-root']);
const displayClassesOf = (el: HTMLElement) => [...el.classList].filter((c) => DISPLAY_UTILITIES.has(c));

const LABEL = { text: 'Κουζίνα', aria: 'Μετάβαση: Κουζίνα' };

describe('TourLinkButton — κρύβεται πραγματικά με hidden', () => {
  it.each([
    ['βελάκι πατώματος (θέαση)', {}],
    ['συρόμενο βελάκι (επεξεργαστής)', { onDrop: jest.fn() }],
  ])('%s: ξεκινά hidden και ΚΑΜΙΑ κλάση display στο κουμπί', (_label, extra) => {
    const { container } = render(<TourLinkButton label={LABEL} onGo={jest.fn()} register={jest.fn()} {...extra} />);
    // Κρυμμένο ⇒ χωρίς προσβάσιμο όνομα· το ζητούμενο είναι ΑΚΡΙΒΩΣ ότι είναι κρυμμένο.
    const button = container.querySelector('button') as HTMLButtonElement;
    expect(button).toHaveAttribute('hidden');
    expect(displayClassesOf(button)).toEqual([]);
  });
});
