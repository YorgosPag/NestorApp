/**
 * Τα προθέματα αναζήτησης: ό,τι γράφει ο γραφέας πρέπει να το βρίσκει το ερώτημα (ADR-923 §5.12 τμήμα 4).
 */

import { catalogSearchPlan, catalogSearchPrefixes, catalogSearchText, matchesCatalogSearch } from '../search-prefixes';

const finds = (label: string, identifier: string | null, term: string): boolean => {
  const { seed, tokens } = catalogSearchPlan(term);
  return seed !== null && catalogSearchPrefixes(label, identifier).includes(seed) && matchesCatalogSearch(catalogSearchText(label, identifier), tokens);
};

describe('από τον γραφέα στο ερώτημα', () => {
  it.each([
    ['δεύτερη λέξη', 'Πλακάκι Δαπέδου', null, 'δαπέδου'],
    ['χωρίς τόνους', 'Πλακάκι Δαπέδου', null, 'πλακακι'],
    ['🔴 κεφαλαίο τελικό σίγμα', 'ΣΩΛΗΝΑΣ', null, 'σωλήνας'],
    ['πεζά τελικό σίγμα σε κεφαλαία ετικέτα', 'σωλήνας', null, 'ΣΩΛΗΝΑΣ'],
    ['κωδικός', 'Βίδα', 'MFP-3400', 'mfp-3400'],
    ['κομμάτι κωδικού μετά από παύλα', 'Βίδα', 'MFP-3400', '3400'],
    ['στίξη στα άκρα του όρου', 'Βίδα Inox', null, '(inox)'],
    ['μακρύτερη λέξη από το πρόθεμα', 'Θερμομόνωση', null, 'θερμομονωση'],
    ['όλες οι λέξεις', 'Σωλήνας Χαλκού 16mm', null, 'χαλκου σωληνας'],
  ])('%s', (_name, label, identifier, term) => {
    expect(finds(label, identifier, term)).toBe(true);
  });

  it('🔴 μία λέξη που λείπει ⇒ τίποτα', () => {
    expect(finds('Σωλήνας Χαλκού', null, 'σωλήνας αλουμινίου')).toBe(false);
  });

  it('🔴 κρίνεται ΚΑΘΕ λέξη, ακόμη κι αν ο σπόρος ταιριάζει', () => {
    expect(matchesCatalogSearch('σωληνασ χαλκου', ['σωληνασ', 'χρυσο'])).toBe(false);
  });

  it('το πρόθεμα είναι της μακρύτερης λέξης', () => {
    expect(catalogSearchPlan('16 σωλήνας').seed).toBe('σωλην');
  });

  it('όρος χωρίς αρκετά γράμματα ⇒ κανένα ερώτημα λέξεων', () => {
    expect(catalogSearchPlan('16 mm').seed).toBeNull();
    expect(catalogSearchPlan('   ').seed).toBeNull();
  });

  it('🔴 ίδιο SKU ⇒ ίδιος πίνακας: ο επανυπολογισμός δεν γράφει χωρίς λόγο', () => {
    expect(catalogSearchPrefixes('Βίδα Inox', 'B-1')).toEqual(catalogSearchPrefixes('ΒΙΔΑ inox', 'B-1'));
  });

  it('χωρίς ετικέτα και κωδικό ⇒ κενός πίνακας', () => {
    expect(catalogSearchPrefixes(null, null)).toEqual([]);
  });
});
