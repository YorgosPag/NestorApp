/**
 * @fileoverview **Το ίχνος της αλλαγής επωνυμίας** — καθαρός κριτής (ADR-841 §7 Α23, Φ3.2 Γ).
 * @related subapps/accounting/services/audit/company-legal-name-audit.ts
 */

import { legalNameChangeAudit } from '../company-legal-name-audit';

describe('legalNameChangeAudit (ADR-841 Α23)', () => {
  it('🔴 ίδια αποθηκευμένη επωνυμία ⇒ `null` (τίποτα να καταγραφεί)', () => {
    expect(legalNameChangeAudit({ from: 'ΠΑΓΩΝΗΣ ΑΕ', to: 'ΠΑΓΩΝΗΣ ΑΕ', source: 'profile' })).toBeNull();
  });

  it('🔴 αλλαγή ΜΟΝΟ ορθογραφίας ⇒ καταγράφεται (ακριβής σύγκριση, όχι `sameLegalName`)', () => {
    expect(legalNameChangeAudit({ from: 'Παγώνης Α.Ε.', to: 'ΠΑΓΩΝΗΣ ΑΕ', source: 'profile' })).not.toBeNull();
  });

  it('🔑 υιοθέτηση ΓΕΜΗ ⇒ από/προς + πηγή + απόδειξη μητρώου, επίπεδα metadata', () => {
    const audit = legalNameChangeAudit({
      from: null,
      to: 'ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ',
      source: 'gemi-adoption',
      registry: { registrationNumber: '123456789000', checkedAt: '2026-09-14T09:00:00.000Z' },
    });

    expect(audit?.metadata).toEqual({
      previousLegalName: null,
      legalName: 'ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ',
      source: 'gemi-adoption',
      registrationNumber: '123456789000',
      registryCheckedAt: '2026-09-14T09:00:00.000Z',
    });
    expect(audit?.details).toContain('ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ');
  });

  it('🔑 αλλαγή από το προφίλ ⇒ ΚΑΜΙΑ απόδειξη μητρώου', () => {
    const audit = legalNameChangeAudit({ from: 'Α', to: 'Β', source: 'profile' });

    expect(audit?.metadata).toMatchObject({ source: 'profile', registrationNumber: null, registryCheckedAt: null });
  });
});
