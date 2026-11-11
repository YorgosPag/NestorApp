/**
 * ⚓ Το εμβαδόν → ΚΕΙΜΕΝΟ, με το είδος του· και το €/m² με τη βάση του (ADR-777 §8.100).
 */

import {
  displayAreaLabel,
  pricePerDisplayAreaLabel,
  qualifiedAreaText,
} from '../display-area-label';
import { listingAreaLabel } from '@/lib/listings/listing-area-label';

/** Το `t` ξαναγράφει το ICU του locale `el` — κρίνουμε ΠΟΙΟ κλειδί ζητήθηκε και με ποιες τιμές. */
const EL: Readonly<Record<string, string>> = {
  'common:displayArea.sqm': '{value} m²',
  'common:displayArea.basis.gross': 'μικτά',
  'common:displayArea.basis.net': 'καθαρά',
  'common:displayArea.qualified': '{text} {basis}',
  'common:pricePerArea.sale': '{price}/m²',
  'common:pricePerArea.rent': '{price}/m²/μήνα',
  'search-results:listing.areaSqm': '{value} τ.μ.',
};
const t = (key: string, opts?: Record<string, unknown>): string =>
  (EL[key] ?? key).replace(/\{(\w+)\}/g, (_m, name: string) => String(opts?.[name] ?? `{${name}}`));

/** Μόνο τα ψηφία — ο διαχωριστής χιλιάδων εξαρτάται από τη locale του περιβάλλοντος. */
const digits = (text: string | null): string => (text ?? '').replace(/\D/g, '');

describe('Λ1 — το εμβαδόν λέει ΤΙ μετρά', () => {
  it.each([
    ['gross', '120 m² μικτά'],
    ['net', '120 m² καθαρά'],
    ['unspecified', '120 m²'],
  ] as const)('%s ⇒ «%s»', (kind, expected) => {
    expect(displayAreaLabel(t, { value: 120, kind })).toBe(expected);
  });

  it('η αγγελία κρατά τη ΔΙΚΗ της μονάδα, ο προσδιορισμός είναι ο ΙΔΙΟΣ', () => {
    expect(listingAreaLabel(t, { value: 95, kind: 'gross' })).toBe('95 τ.μ. μικτά');
    expect(listingAreaLabel(t, { value: 108, kind: 'net' })).toBe('108 τ.μ. καθαρά');
    expect(qualifiedAreaText(t, '95 τ.μ.', 'unspecified')).toBe('95 τ.μ.');
  });
});

describe('Λ2 — €/m² πάνω στο ΙΔΙΟ εμβαδόν, με τη βάση του όταν δεν είναι η σύμβαση', () => {
  it('βάση μικτό ⇒ σκέτο (σύμβαση της αγοράς)', () => {
    const text = pricePerDisplayAreaLabel(t, { role: 'sale', amount: 240_000 }, { value: 120, kind: 'gross' });
    expect(text).toMatch(/\/m²$/);
    expect(digits(text)).toBe('2000');
  });

  it('🔴 βάση καθαρό ⇒ το λέει («… €/m² καθαρά») — ποτέ σιωπηλή αλλαγή βάσης', () => {
    const text = pricePerDisplayAreaLabel(t, { role: 'sale', amount: 240_000 }, { value: 100, kind: 'net' });
    expect(text).toMatch(/\/m² καθαρά$/);
    expect(digits(text)).toBe('2400');
  });

  it('ο ρόλος κρατά τη μονάδα του (ενοίκιο ⇒ /μήνα), και η βάση μπαίνει μετά', () => {
    const text = pricePerDisplayAreaLabel(t, { role: 'rent', amount: 500 }, { value: 100, kind: 'net' });
    expect(text).toMatch(/\/m²\/μήνα καθαρά$/);
  });

  it('χωρίς εμβαδόν ή σε διανυκτέρευση ⇒ καμία γραμμή', () => {
    expect(pricePerDisplayAreaLabel(t, { role: 'sale', amount: 1 }, null)).toBeNull();
    expect(pricePerDisplayAreaLabel(t, { role: 'nightly', amount: 50 }, { value: 85, kind: 'gross' })).toBeNull();
  });
});
