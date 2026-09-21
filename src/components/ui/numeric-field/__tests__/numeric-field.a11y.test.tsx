/**
 * ADR-598 G11 — axe στο ΕΝΑ πεδίο δεκαδικού της εφαρμογής (ADR-706), σε κάθε κατάσταση.
 *
 * Το πεδίο είναι `type="text"` με `role="spinbutton"` — δηλαδή δηλώνει ρόλο που το `<input>` δεν
 * έχει εγγενώς, και τότε το axe ελέγχει ότι φέρει ό,τι ο ρόλος υπόσχεται (`aria-valuenow`,
 * όνομα). Οι καταστάσεις που μετράνε: με ετικέτα-λαβή scrub, χωρίς ετικέτα (όνομα από
 * `aria-label`), **κενό** (χωρίς `aria-valuenow` = «απροσδιόριστο» κατά WAI-ARIA, όχι φάντασμα 0),
 * με όρια, disabled, και σε σφάλμα.
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';

import { expectNoA11yViolations } from '@/test-utils/a11y';

import { NumericField } from '../NumericField';

const noop = () => undefined;

describe('NumericField a11y', () => {
  it('με ετικέτα (που είναι και λαβή scrub)', async () => {
    await expectNoA11yViolations(
      <NumericField id="sd" label="Συντελεστής δόμησης" value={0.8} onValueChange={noop} step={0.01} />,
    );
    expect(screen.getByRole('spinbutton', { name: 'Συντελεστής δόμησης' })).toHaveAttribute('aria-valuenow', '0.8');
  });

  it('χωρίς ετικέτα, με aria-label', async () => {
    await expectNoA11yViolations(<NumericField id="h" aria-label="Ύψος" value={3} onValueChange={noop} />);
  });

  it('κενό: απροσδιόριστη τιμή, χωρίς aria-valuenow', async () => {
    const { container } = render(
      <NumericField
        id="price"
        label="Τιμή"
        value={0}
        blankValue={0}
        onValueChange={noop}
        placeholder="—"
      />,
    );
    expect(screen.getByRole('spinbutton', { name: 'Τιμή' })).not.toHaveAttribute('aria-valuenow');
    await expectNoA11yViolations(container);
  });

  it('με όρια', async () => {
    await expectNoA11yViolations(
      <NumericField id="pct" label="Ποσοστό" value={40} min={0} max={100} onValueChange={noop} />,
    );
    const field = screen.getByRole('spinbutton', { name: 'Ποσοστό' });
    expect(field).toHaveAttribute('aria-valuemin', '0');
    expect(field).toHaveAttribute('aria-valuemax', '100');
  });

  it('disabled', async () => {
    await expectNoA11yViolations(<NumericField id="d" label="Κλειδωμένο" value={1} disabled onValueChange={noop} />);
  });

  it('σε σφάλμα: aria-invalid + περιγραφή που δείχνει στο μήνυμα', async () => {
    const { container } = render(
      <>
        <NumericField
          id="area"
          label="Εμβαδόν"
          value={-5}
          onValueChange={noop}
          aria-invalid
          aria-describedby="area-error"
        />
        <p id="area-error">Το εμβαδόν δεν μπορεί να είναι αρνητικό</p>
      </>,
    );
    expect(screen.getByRole('spinbutton', { name: 'Εμβαδόν' })).toHaveAccessibleDescription(
      'Το εμβαδόν δεν μπορεί να είναι αρνητικό',
    );
    await expectNoA11yViolations(container);
  });
});
