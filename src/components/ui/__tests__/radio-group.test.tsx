/**
 * ⚓ ADR-777 §8.96.5 — το radio είναι **κύκλος**. Το `useBorderTokens().radius` δίνει **τιμές** CSS (`'9999px'`), όχι
 * κλάσεις· μπαίνοντας στο `className` δεν στρογγύλευαν τίποτα, και κάθε radio της εφαρμογής φαινόταν checkbox.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import { Label } from '../label';
import { RadioGroup, RadioGroupItem } from '../radio-group';

describe('RadioGroupItem — σχήμα', () => {
  it('φέρει την κλάση στρογγύλευσης, ποτέ ωμή τιμή token', () => {
    render(
      <RadioGroup defaultValue="a" aria-label="σχήμα">
        <RadioGroupItem value="a" aria-label="α" />
      </RadioGroup>,
    );
    const item = screen.getByRole('radio', { name: 'α' });
    expect(item.className.split(/\s+/)).toContain('rounded-full');
    expect(item.className).not.toMatch(/(?:^|\s)\d[\d.]*(?:px|rem)(?:\s|$)/);
  });
});

/**
 * ⚓ ADR-928 §5.24.5 #8 — «radio χωρίς προσβάσιμο όνομα». Ο ζωντανός έλεγχος μέτρησε **χαρακτηριστικά**
 * (`aria-label`/`aria-labelledby`/`label[for]`), όχι το **υπολογισμένο** όνομα (accname). Το `<button role=radio>` είναι
 * labelable στοιχείο: το `<label>` που το τυλίγει το ονομάζει (HTML-AAM· στο Chrome μετρήθηκε `button.labels.length === 1`).
 * Τα δύο σχήματα του έργου κλειδώνονται εδώ — και η ομάδα ονομάζεται από το legend, γιατί το `radiogroup` ≠ `fieldset`.
 */
describe('RadioGroupItem — όνομα', () => {
  it('ονομάζεται και από τυλιγμένο <Label> και από ρητό htmlFor· η ομάδα από το legend', () => {
    render(
      <fieldset>
        <legend id="scope-legend">Εμβέλεια</legend>
        <RadioGroup defaultValue="master" aria-labelledby="scope-legend">
          <Label><RadioGroupItem value="project" />Συμφωνητικό έργου</Label>
          <RadioGroupItem id="scope-master" value="master" />
          <Label htmlFor="scope-master">Κύρια σύμβαση</Label>
        </RadioGroup>
      </fieldset>,
    );
    expect(screen.getByRole('radiogroup', { name: 'Εμβέλεια' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Συμφωνητικό έργου' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Κύρια σύμβαση' })).toBeChecked();
  });
});
