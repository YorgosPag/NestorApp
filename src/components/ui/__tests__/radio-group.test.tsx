/**
 * ⚓ ADR-777 §8.96.5 — το radio είναι **κύκλος**. Το `useBorderTokens().radius` δίνει **τιμές** CSS (`'9999px'`), όχι
 * κλάσεις· μπαίνοντας στο `className` δεν στρογγύλευαν τίποτα, και κάθε radio της εφαρμογής φαινόταν checkbox.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

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
