/**
 * `formatBuildingLabel` — η ετικέτα κτιρίου «κωδικός — όνομα» (ADR-233 §3.4).
 * Άγκυρα ADR-898 Φ4β: ένα όνομα « ΝΕΟ» με κενό μπροστά έδινε «Κτίριο Α —  ΝΕΟ» — αόρατο στο HTML, ορατό στο όνομα του
 * αρχείου XLSX και στο φύλλο «Παραδοχές» (βρέθηκε στη ζωντανή επαλήθευση της εξαγωγής).
 */

import { formatBuildingLabel } from '../entity-formatters';

describe('formatBuildingLabel', () => {
  it('κωδικός — όνομα, και μόνο ένα από τα δύο όταν συμπίπτουν ή λείπει το άλλο', () => {
    expect(formatBuildingLabel('Κτίριο Α', 'Πολυκατοικία')).toBe('Κτίριο Α — Πολυκατοικία');
    expect(formatBuildingLabel('Κτίριο Α', 'Κτίριο Α')).toBe('Κτίριο Α');
    expect(formatBuildingLabel(undefined, 'Πολυκατοικία')).toBe('Πολυκατοικία');
    expect(formatBuildingLabel(null, null, 'b-1')).toBe('b-1');
  });

  it('κενά από τη φόρμα δεν φτάνουν στην ετικέτα (ούτε κάνουν το «ίδιο» όνομα να φαίνεται διαφορετικό)', () => {
    expect(formatBuildingLabel('Κτίριο Α', ' ΝΕΟ')).toBe('Κτίριο Α — ΝΕΟ');
    expect(formatBuildingLabel('Κτίριο Α ', 'Κτίριο Α')).toBe('Κτίριο Α');
    expect(formatBuildingLabel('  ', ' ΝΕΟ ')).toBe('ΝΕΟ');
  });
});
