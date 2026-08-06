/**
 * ADR-763 §5 — **τι γράφεται στο κελί όταν πατηθεί το «OK»**.
 *
 * @see bim/table/formula/catalog/formula-insert-text.ts
 */

import { insertFunctionCall } from '../formula/catalog/formula-insert-text';

describe('ADR-763 §5 — εισαγωγή κλήσης συνάρτησης', () => {
  it('κενό κελί ⇒ ξεκινά καθαρό τύπο, κέρσορας μέσα στις παρενθέσεις', () => {
    const result = insertFunctionCall({ draft: '', functionName: 'SUM' });
    expect(result.draft).toBe('=SUM()');
    expect(result.draft.slice(result.caretIndex)).toBe(')');
  });

  it('κελί με κείμενο ⇒ ΑΝΤΙΚΑΘΙΣΤΑΤΑΙ — το `Σκυρόδεμα=SUM()` δεν είναι τίποτα', () => {
    const result = insertFunctionCall({
      draft: 'Σκυρόδεμα',
      caretIndex: 4,
      functionName: 'SUM',
    });
    expect(result.draft).toBe('=SUM()');
    expect(result.caretIndex).toBe(5);
  });

  it('τύπος υπό συγγραφή ⇒ ΕΜΦΥΤΕΥΕΤΑΙ στη θέση του κέρσορα', () => {
    const result = insertFunctionCall({ draft: '=B2*', caretIndex: 4, functionName: 'SUM' });
    expect(result.draft).toBe('=B2*SUM()');
    expect(result.caretIndex).toBe(8);
    expect(result.draft.slice(result.caretIndex)).toBe(')');
  });

  it('κέρσορας στη ΜΕΣΗ του τύπου — το υπόλοιπο μένει δεξιά, δεν σβήνεται', () => {
    const result = insertFunctionCall({ draft: '=1++2', caretIndex: 3, functionName: 'ABS' });
    expect(result.draft).toBe('=1+ABS()+2');
    expect(result.draft.slice(result.caretIndex)).toBe(')+2');
  });

  it('χωρίς δείκτη κέρσορα ⇒ στο τέλος, η μόνη θέση που δεν μπορεί να είναι λάθος', () => {
    const result = insertFunctionCall({ draft: '=A1+', functionName: 'MAX' });
    expect(result.draft).toBe('=A1+MAX()');
  });

  it('μπαγιάτικος δείκτης πέρα από το κείμενο ⇒ περιορίζεται, δεν κόβει σε ανύπαρκτη θέση', () => {
    const result = insertFunctionCall({ draft: '=A1', caretIndex: 999, functionName: 'MIN' });
    expect(result.draft).toBe('=A1MIN()');
  });

  it('αρνητικός ή μη πεπερασμένος δείκτης δεν παράγει σκουπίδια', () => {
    expect(insertFunctionCall({ draft: '=A1', caretIndex: -5, functionName: 'MIN' }).draft)
      .toBe('MIN()=A1');
    expect(insertFunctionCall({ draft: '=A1', caretIndex: Number.NaN, functionName: 'MIN' }).draft)
      .toBe('=A1MIN()');
  });

  it('όνομα με τελεία γράφεται ΟΛΟΚΛΗΡΟ — ο λεξικογράφος δέχεται τελεία σε όνομα', () => {
    const result = insertFunctionCall({ draft: '=', caretIndex: 1, functionName: 'CEILING.MATH' });
    expect(result.draft).toBe('=CEILING.MATH()');
    expect(result.draft.slice(result.caretIndex)).toBe(')');
  });

  it('τύπος με κενό πριν το `=` μετράει ως τύπος — ίδιος ορισμός με τον λεξικογράφο', () => {
    const result = insertFunctionCall({ draft: '  =A1', caretIndex: 5, functionName: 'SUM' });
    expect(result.draft).toBe('  =A1SUM()');
  });
});
