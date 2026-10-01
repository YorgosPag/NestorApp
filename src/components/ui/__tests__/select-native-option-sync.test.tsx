/**
 * @fileoverview **ΤΟ ΚΡΥΦΟ `<option>` ΛΕΕΙ ΟΤΙ ΚΑΙ Η ΟΡΑΤΗ ΕΤΙΚΕΤΑ;** — ADR-001 · ADR-744 §25.
 * @related components/ui/select.tsx (`useItemTextGeneration`)
 *
 * 🔴 ΤΟ ΕΥΡΗΜΑ (Chrome, 2026-10-01, καρτέλα ακινήτου): η ορατή λίστα έλεγε
 * «Δημόσια αγγελία», το κρυφό native `<select>` της Radix έλεγε `audience.publicListing`
 * — **μόνιμα**. Το `SelectItemText` *(`@radix-ui/react-select@2.2.6`, dist/index.mjs:913)*
 * διαβάζει `textContent` κατά το render, δηλαδή το κείμενο του **προηγούμενου** commit.
 *
 * ⚠️ Ρωτά το **αποδοθέν DOM** του native option — όχι τα props: ένα test πάνω στα
 * props θα ήταν πράσινο πάνω από το ελάττωμα, γιατί τα props **είναι** σωστά.
 */
import React from 'react';
import { render } from '@testing-library/react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select';

/** Μέσα σε `<form>`: μόνο τότε η Radix αποδίδει το native `<select>`. */
function AudienceSelect({ label }: { readonly label: string }): React.ReactElement {
  return (
    <form>
      <Select value="public-listing" onValueChange={() => undefined}>
        <SelectTrigger aria-label="audience"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="public-listing">{label}</SelectItem>
          <SelectItem value="project-team">project-team</SelectItem>
        </SelectContent>
      </Select>
    </form>
  );
}

const nativeOptionText = (container: HTMLElement, value: string): string | null =>
  container.querySelector(`select option[value="${value}"]`)?.textContent ?? null;

describe('Select — το native option ακολουθεί την ετικέτα', () => {
  it('προϋπόθεση: η Radix αποδίδει native option με την αρχική ετικέτα', () => {
    const { container } = render(<AudienceSelect label="Δημόσια αγγελία" />);
    expect(nativeOptionText(container, 'public-listing')).toBe('Δημόσια αγγελία');
  });

  it('🔴 ΑΓΚΥΡΑ — ωμό κλειδί → μετάφραση: το native option ΔΕΝ μένει με το ωμό', () => {
    const { container, rerender } = render(<AudienceSelect label="audience.publicListing" />);
    rerender(<AudienceSelect label="Δημόσια αγγελία" />);
    expect(nativeOptionText(container, 'public-listing')).toBe('Δημόσια αγγελία');
  });

  it('αλλαγή γλώσσας (δεύτερη αλλαγή) — ακολουθεί κάθε φορά, όχι μόνο την πρώτη', () => {
    const { container, rerender } = render(<AudienceSelect label="audience.publicListing" />);
    rerender(<AudienceSelect label="Δημόσια αγγελία" />);
    rerender(<AudienceSelect label="Public listing" />);
    expect(nativeOptionText(container, 'public-listing')).toBe('Public listing');
  });

  it('η ορατή τιμή του trigger μένει σωστή μετά το ξαναστήσιμο του ItemText', () => {
    const { getByRole, rerender } = render(<AudienceSelect label="audience.publicListing" />);
    rerender(<AudienceSelect label="Δημόσια αγγελία" />);
    expect(getByRole('combobox').textContent).toContain('Δημόσια αγγελία');
  });
});
