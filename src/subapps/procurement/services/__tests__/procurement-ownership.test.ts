/**
 * Ο φύλακας ιδιοκτησίας των προμηθειών — ADR-742 Ομάδα 2
 *
 * Τι αποδεικνύει (και τι **δεν** αρκεί να αποδείξει):
 *
 * - Η ερώτηση δεν είναι σκέτο `===`: το κενό `companyId` είναι **απουσία**
 *   tenant, όχι tenant που τυχαίνει να ταιριάζει (§4 / §7.5).
 * - Το γνήσιο «δεν βρέθηκε» και το μεταμφιεσμένο βγαίνουν από το **ίδιο**
 *   εργοστάσιο — άρα δεν μπορούν να αποκλίνουν χωρίς να αλλάξει ο κώδικας που
 *   τα παράγει (§7.1). Ελέγχεται με `toEqual`, όχι «μοιάζει».
 * - Η άρνηση κουβαλά **δομημένη** αλήθεια, ώστε το σύνορο να μη διαβάζει ποτέ
 *   κείμενο για να πάρει απόφαση ασφαλείας (§7.4).
 */

import {
  PROCUREMENT_RESOURCE,
  ProcurementCrossTenantError,
  ProcurementNotFoundError,
  assertOwnedProcurementDoc,
  procurementNotFound,
} from '../procurement-ownership';

const SUBJECT = {
  resource: PROCUREMENT_RESOURCE.MATERIAL,
  resourceId: 'mat_abc123',
} as const;

describe('procurementNotFound — το ένα εργοστάσιο', () => {
  it('παράγει το ίδιο ακριβώς μήνυμα που έγραφαν οι υπηρεσίες με το χέρι', () => {
    expect(procurementNotFound(SUBJECT).message).toBe('Material mat_abc123 not found');
  });

  it('δύο κλήσεις με τα ίδια ορίσματα δίνουν ταυτόσημο αποτέλεσμα', () => {
    const genuine = procurementNotFound(SUBJECT);
    const disguised = procurementNotFound(SUBJECT);
    // Η ταυτότητα είναι δομική: ίδιος constructor, ίδια ορίσματα.
    expect({ name: disguised.name, message: disguised.message }).toEqual({
      name: genuine.name,
      message: genuine.message,
    });
  });

  it('κρατά τον πόρο σε δομημένα πεδία, ώστε το σύνορο να μη διαβάζει κείμενο', () => {
    const err = procurementNotFound(SUBJECT);
    expect(err).toBeInstanceOf(ProcurementNotFoundError);
    expect(err.resource).toBe('Material');
    expect(err.resourceId).toBe('mat_abc123');
  });

  it('κάθε πόρος κρατά το δικό του όνομα — κοινή σταθερά θα πρόδιδε τη διαφορά', () => {
    expect(
      procurementNotFound({ resource: PROCUREMENT_RESOURCE.RFQ_LINE, resourceId: 'ln1' }).message,
    ).toBe('RfqLine ln1 not found');
    expect(
      procurementNotFound({ resource: PROCUREMENT_RESOURCE.SOURCING_EVENT, resourceId: 'se1' })
        .message,
    ).toBe('SourcingEvent se1 not found');
  });
});

describe('assertOwnedProcurementDoc — η ερώτηση', () => {
  it('περνά όταν το έγγραφο ανήκει στον καλούντα', () => {
    expect(() =>
      assertOwnedProcurementDoc({ companyId: 'co1' }, 'co1', SUBJECT),
    ).not.toThrow();
  });

  it('ρίχνει τυποποιημένο σφάλμα όταν ανήκει σε άλλον πελάτη', () => {
    expect(() => assertOwnedProcurementDoc({ companyId: 'co2' }, 'co1', SUBJECT)).toThrow(
      ProcurementCrossTenantError,
    );
  });

  it('η άρνηση κουβαλά ποιος ζήτησε και ποιος έχει', () => {
    try {
      assertOwnedProcurementDoc({ companyId: 'co2' }, 'co1', SUBJECT);
      throw new Error('έπρεπε να ρίξει');
    } catch (error) {
      expect(error).toBeInstanceOf(ProcurementCrossTenantError);
      const denial = error as ProcurementCrossTenantError;
      expect(denial.expectedCompanyId).toBe('co1');
      expect(denial.actualCompanyId).toBe('co2');
      expect(denial.procurementSubject).toEqual(SUBJECT);
    }
  });

  it('🔴 το μήνυμα μένει `Forbidden` — ταυτόσημο με τα 14 χειρόγραφα throw', () => {
    try {
      assertOwnedProcurementDoc({ companyId: 'co2' }, 'co1', SUBJECT);
      throw new Error('έπρεπε να ρίξει');
    } catch (error) {
      expect((error as Error).message).toBe('Forbidden');
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 🔴 Η παγίδα του κενού (ADR-742 §4) — αυτό σκοτώνει την επιστροφή στο `===`
  // ──────────────────────────────────────────────────────────────────────────
  describe('η παγίδα του κενού — το κενό είναι απουσία tenant', () => {
    it.each([
      ['κενό και στα δύο', { companyId: '' }, ''],
      ['κενό στον καλούντα', { companyId: 'co1' }, ''],
      ['κενό στο έγγραφο', { companyId: '' }, 'co1'],
      ['απόν στο έγγραφο', {}, 'co1'],
      ['null στο έγγραφο', { companyId: null }, 'co1'],
    ])('αρνείται: %s', (_label, doc, caller) => {
      expect(() => assertOwnedProcurementDoc(doc, caller, SUBJECT)).toThrow(
        ProcurementCrossTenantError,
      );
    });
  });
});
