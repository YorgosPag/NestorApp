/**
 * ADR-923 §5.5.2 Β3 Γ11 — η αδελφή γραμμή: μία λέξη διαφορά, ίδια μονάδα, μία υποψήφια· ο κωδικός κατά τη σύμβαση της αδελφής.
 */

import { lineSiblingOf, relabelText, relabelWord, siblingCodeOf, type BoundLineOfTable } from '../line-sibling';
import type { ImportLineIdentity } from '../../types/catalog-import';

const identity = (printed: string, unitCode: string | null = 'm3_h'): ImportLineIdentity => ({ label: printed.toLowerCase(), unitCode, printed });
const bound = (printed: string, attributeId: string, unitCode: string | null = 'm3_h'): BoundLineOfTable => ({ identity: identity(printed, unitCode), attributeId });

describe('lineSiblingOf', () => {
  it('μία λέξη διαφορά, ίδια μονάδα ⇒ η ιδιότητα της αντιστοιχισμένης γραμμής', () => {
    const sibling = lineSiblingOf(identity('ΠΑΡΟΧΗ ΑΕΡΑ · M'), [bound('ΠΑΡΟΧΗ ΑΕΡΑ · H', 'cattr_h'), bound('ΨΥΚΤΙΚΗ ΙΣΧΥΣ · H', 'cattr_cool', 'kw')]);
    expect(sibling).toEqual({ attributeId: 'cattr_h', from: 'H', to: 'M' });
  });

  it('άλλη μονάδα ⇒ καμία αδελφή', () => {
    expect(lineSiblingOf(identity('ΠΑΡΟΧΗ ΑΕΡΑ · M'), [bound('ΠΑΡΟΧΗ ΑΕΡΑ · H', 'cattr_h', 'l_s')])).toBeNull();
  });

  it('δύο λέξεις διαφορά ή άλλο πλήθος λέξεων ⇒ καμία αδελφή', () => {
    expect(lineSiblingOf(identity('ΠΑΡ ΝΕΡΟΥ · M'), [bound('ΠΑΡΟΧΗ ΑΕΡΑ · H', 'cattr_h')])).toBeNull();
    expect(lineSiblingOf(identity('ΠΑΡΟΧΗ ΑΕΡΑ · M · ΜΕΣΑΙΑ'), [bound('ΠΑΡΟΧΗ ΑΕΡΑ · H', 'cattr_h')])).toBeNull();
  });

  it('δύο διαφορετικές υποψήφιες ⇒ καμία (ερώτηση για άνθρωπο, όχι πρόταση)', () => {
    expect(lineSiblingOf(identity('ΠΑΡΟΧΗ ΑΕΡΑ · M'), [bound('ΠΑΡΟΧΗ ΑΕΡΑ · H', 'cattr_h'), bound('ΠΑΡΟΧΗ ΑΕΡΑ · L', 'cattr_l')])).toBeNull();
  });

  it('η ίδια ιδιότητα σε δύο γραμμές μετρά ως μία υποψήφια', () => {
    const sibling = lineSiblingOf(identity('ΠΑΡΟΧΗ ΑΕΡΑ · M'), [bound('ΠΑΡΟΧΗ ΑΕΡΑ · H', 'cattr_h'), bound('ΠΑΡΟΧΗ ΑΕΡΑ · L', 'cattr_h')]);
    expect(sibling?.attributeId).toBe('cattr_h');
  });

  it('ετικέτα μίας λέξης ⇒ καμία αδελφή', () => {
    expect(lineSiblingOf(identity('M'), [bound('H', 'cattr_h')])).toBeNull();
  });
});

describe('siblingCodeOf', () => {
  it('airflow_h + H→L ⇒ airflow_l', () => {
    expect(siblingCodeOf('airflow_h', { from: 'H', to: 'L' })).toBe('airflow_l');
  });

  it('ελληνικό Ήτα στην πηγή ≡ λατινικό h στον κωδικό (όχι `i`)', () => {
    expect(siblingCodeOf('airflow_h', { from: 'Η', to: 'Μ' })).toBe('airflow_m');
  });

  it('η αδελφή δεν τελειώνει στη λέξη ⇒ null', () => {
    expect(siblingCodeOf('airflow_high', { from: 'H', to: 'L' })).toBeNull();
  });
});

describe('relabelWord / relabelText', () => {
  it('αλλάζει τη λέξη μόνο όταν γράφεται ακριβώς μία φορά', () => {
    expect(relabelWord('Παροχή αέρα H', { from: 'H', to: 'L' })).toBe('Παροχή αέρα L');
    expect(relabelWord('Airflow H', { from: 'Η', to: 'M' })).toBe('Airflow M');
    expect(relabelWord('Airflow high', { from: 'H', to: 'L' })).toBeNull();
    expect(relabelWord('H Airflow H', { from: 'H', to: 'L' })).toBeNull();
  });

  it('γλώσσα όπου η λέξη δεν αλλάζει με βεβαιότητα φεύγει', () => {
    expect(relabelText({ el: 'Παροχή αέρα H', en: 'Airflow high' }, { from: 'H', to: 'L' })).toEqual({ el: 'Παροχή αέρα L' });
  });
});
