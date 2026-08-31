/**
 * ADR-832 — ΑΓΚΥΡΕΣ **ΤΟΥ ΣΥΝΟΡΟΥ**: ό,τι στέλνει η φόρμα, φτάνει στον γραφέα.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ ΠΟΥ ΤΙΣ ΓΕΝΝΗΣΕ — ΒΡΕΘΗΚΕ ΣΕ **ΖΩΝΤΑΝΗ** ΕΠΑΛΗΘΕΥΣΗ, 2026-08-30
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Το ADR-832 πρόσθεσε `scope` και `startsAt` στους όρους. Η φόρμα τα έστελνε· το
 * σχήμα zod της πόρτας **δεν τα δήλωνε**· το zod τα **αφαιρούσε σιωπηλά**. Ζωντανό
 * αποτέλεσμα με πραγματικό λογαριασμό:
 *
 * > `POST /api/mandate-requests → 500`
 * > `TypeError: Cannot read properties of undefined (reading 'filter')`
 * > `at sharedResources (mandate-conflict.ts:170)` — `a.scope` του **υποψηφίου**
 *
 * 🔴 **ΚΑΙ ΟΛΑ ΤΑ TESTS ΗΤΑΝ ΠΡΑΣΙΝΑ**: 621 σε 42 σουίτες, 22/22 μεταλλάξεις
 * σκοτωμένες. Κανένα δεν κοίταξε **εδώ**, γιατί όλα φτιάχνουν `ProposedMandateTerms`
 * σε **TypeScript** — δηλαδή **παρακάμπτουν το σύνορο**. Ο μεταγλωττιστής δεν βλέπει
 * ποτέ το zod· το zod δεν βλέπει ποτέ τον τύπο. **Το κενό ήταν ανάμεσά τους.**
 *
 *   Σ-1  🔴 **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΟΥ ΣΥΝΟΡΟΥ**: κάθε όνομα των όρων **επιβιώνει**
 *   Σ-2  🔴 Το ακριβές ελάττωμα: `scope` και `startsAt` **δεν εξαφανίζονται**
 *   Σ-3  Οι τιμές φτάνουν **ακέραιες**, όχι απλώς «υπαρκτές»
 *   Σ-4  ⛔ **ΚΑΝΕΝΑ `min(1)` στο `scope`** — τη σιωπή την ονομάζει ο γραφέας
 *   Σ-5  Άγνωστη πράξη **απορρίπτεται** (το κλειστό σύνολο ισχύει και στο σύρμα)
 *   Σ-6  Το πλήρες σώμα περνά ολόκληρο
 */

import {
  mandateRequestBodySchema,
  mandateRequestTermsSchema,
} from '@/app/api/mandate-requests/mandate-request-body';
import { PROPOSED_MANDATE_TERM_FIELDS } from '@/types/mandate-request';
import type { ProposedMandateTerms } from '@/types/mandate-request';
import { EXCLUSIVE_AGENCY } from '@/types/listing-agreement';

/**
 * **Ακριβώς ό,τι στέλνει η φόρμα** — και ο τύπος το επιβάλλει: αν αύριο προστεθεί
 * έκτο πεδίο στους όρους, **αυτό το αντικείμενο δεν μεταγλωττίζεται** μέχρι κάποιος
 * να το βάλει εδώ, και τότε το `Σ-1` απαιτεί να επιβιώνει.
 */
const WIRE_TERMS: ProposedMandateTerms = {
  agreement: EXCLUSIVE_AGENCY,
  compensation: { type: 'percentage', percentage: 2, vatIncluded: false },
  expiresAt: '2027-04-30T23:59:59.999Z',
  scope: ['sell'],
  startsAt: '2026-08-30T00:00:00.000Z',
};

// ============================================================================
describe('Σ — το σύνορο δεν καταπίνει όρους', () => {
  it('Σ-1 🔴 ΠΑΡΟΝΟΜΑΣΤΗΣ: ΚΑΘΕ όνομα των όρων επιβιώνει του zod', () => {
    const parsed = mandateRequestTermsSchema.parse(WIRE_TERMS);

    // ⚠️ Βρόχος πάνω στο **κλειστό σύνολο**, ποτέ χειρόγραφη λίστα: έκτο πεδίο αύριο
    //    **κληρονομεί** τον έλεγχο αντί να τον σπάσει.
    expect(PROPOSED_MANDATE_TERM_FIELDS.length).toBeGreaterThan(0);
    for (const field of PROPOSED_MANDATE_TERM_FIELDS) {
      expect(Object.prototype.hasOwnProperty.call(parsed, field)).toBe(true);
    }

    // 🔑 Και ότι η λίστα **δεν έχει ξεχάσει** πεδίο: τα κλειδιά του πλήρους
    //    δείγματος και τα ονόματα του συνόλου είναι το ΙΔΙΟ σύνολο.
    expect([...PROPOSED_MANDATE_TERM_FIELDS].sort()).toEqual(Object.keys(WIRE_TERMS).sort());
  });

  it('Σ-2 🔴 ΤΟ ΑΚΡΙΒΕΣ ΕΛΑΤΤΩΜΑ: `scope` και `startsAt` ΔΕΝ εξαφανίζονται', () => {
    const parsed = mandateRequestTermsSchema.parse(WIRE_TERMS);

    // Αυτές οι δύο γραμμές είναι το HTTP 500 της 30/08, γραμμένο ως έλεγχος.
    expect(parsed.scope).not.toBeUndefined();
    expect(parsed.startsAt).not.toBeUndefined();
  });

  it('Σ-3 οι τιμές φτάνουν ΑΚΕΡΑΙΕΣ, όχι απλώς υπαρκτές', () => {
    expect(mandateRequestTermsSchema.parse(WIRE_TERMS)).toEqual(WIRE_TERMS);

    const both = { ...WIRE_TERMS, scope: ['sell', 'leaseOut'] as const };
    expect(mandateRequestTermsSchema.parse(both).scope).toEqual(['sell', 'leaseOut']);
  });

  it('Σ-4 ⛔ ΚΕΝΟ `scope` ΠΕΡΝΑ ΤΟ ΣΥΝΟΡΟ — τη σιωπή την ονομάζει ο ΓΡΑΦΕΑΣ', () => {
    // 🔑 Ένα `.min(1)` εδώ θα απαντούσε `MALFORMED_BODY` **πριν** μιλήσει ο κριτής,
    //    και θα έκανε το `request-scope-unset` **ανεκτέλεστο** — κάλυψη σε νεκρό
    //    κλάδο, ακριβώς ό,τι απαγορεύει η κεφαλίδα της διαδρομής (§5.16).
    expect(mandateRequestTermsSchema.parse({ ...WIRE_TERMS, scope: [] }).scope).toEqual([]);
  });

  it('Σ-5 άγνωστη πράξη ΑΠΟΡΡΙΠΤΕΤΑΙ — το κλειστό σύνολο ισχύει και στο σύρμα', () => {
    expect(() =>
      mandateRequestTermsSchema.parse({ ...WIRE_TERMS, scope: ['κάτι-που-κανείς-δεν-δήλωσε'] }),
    ).toThrow();
  });

  it('Σ-6 το πλήρες σώμα περνά ολόκληρο', () => {
    const body = {
      ownerPropertyId: 'ownp_0001',
      agencyCompanyId: 'comp_grafeio',
      terms: WIRE_TERMS,
    };
    expect(mandateRequestBodySchema.parse(body)).toEqual(body);
  });
});
