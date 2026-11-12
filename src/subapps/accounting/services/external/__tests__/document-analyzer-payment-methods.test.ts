/**
 * ADR-ACC-030 §3 — ο AI αναλυτής παραστατικών διαβάζει ΚΑΘΕ τρόπο πληρωμής του τύπου `PaymentMethod` (εκτός από το
 * `non_cash` του συστήματος). Πριν, η χειρόγραφη λίστα του σχήματος δεν είχε `iris`: παραστατικό πληρωμένο με IRIS
 * δεν μπορούσε να αναγνωριστεί (το strict schema το απαγόρευε).
 */

import { EXPENSE_EXTRACT_SCHEMA } from '../document-analyzer.schemas';

describe('EXPENSE_EXTRACT_SCHEMA.paymentMethod', () => {
  const allowed = EXPENSE_EXTRACT_SCHEMA.schema.properties.paymentMethod.enum;

  it('περιέχει iris και όλους τους τρόπους πληρωμής παραστατικού, και null', () => {
    expect([...allowed].sort((a, b) => String(a).localeCompare(String(b)))).toEqual(
      ['bank_transfer', 'card', 'cash', 'check', 'credit', 'iris', 'mixed', null].sort((a, b) => String(a).localeCompare(String(b))),
    );
  });

  it('ΔΕΝ περιέχει τον μη ταμειακό τρόπο του συστήματος', () => {
    expect(allowed).not.toContain('non_cash');
  });
});
