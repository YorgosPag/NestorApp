/**
 * @fileoverview **Η ΦΟΡΜΑ ΤΟΥ ΙΔΙΩΤΗ** — τι λείπει, και τι ταξιδεύει (ADR-832 §5).
 * @related lib/mandate/mandate-request-form-values.ts
 *
 * 🔴 **ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΔΕΝ ΥΠΗΡΧΕ, ΚΑΙ ΤΟ ΚΕΝΟ ΗΤΑΝ ΜΕΤΡΗΣΙΜΟ**: ο κριτής της φόρμας
 * και ο μεταφραστής της σε όρους είχαν **μηδέν** άγκυρες, ενώ και οι δύο κρίνουν
 * **νομιμότητα** (άρθρο 200 §3/§4). Η προσθήκη της κατάληψης (`scope` · `startsAt`)
 * θα είχε περάσει χωρίς κανένα κόκκινο.
 *
 * ⚠️ **Κανένα ρολόι** — η στιγμή περνιέται, ώστε τα άκρα να είναι δοκιμάσιμα.
 */

import {
  emptyMandateRequestForm,
  mandateRequestFormBlockers,
  proposedTermsFrom,
  MANDATE_REQUEST_FORM_BLOCKERS,
  type MandateRequestFormValues,
} from '@/lib/mandate/mandate-request-form-values';
import { EXCLUSIVE_AGENCY } from '@/types/listing-agreement';

const TODAY = '2026-08-30T09:00:00.000Z';

/** Μια φόρμα όπου **όλα** στέκουν — κάθε άγκυρα χαλάει ΕΝΑ πράγμα. */
function values(over: Partial<MandateRequestFormValues> = {}): MandateRequestFormValues {
  return {
    ...emptyMandateRequestForm(TODAY),
    ownerPropertyId: 'ownp_0001',
    scope: ['sell'],
    agreement: EXCLUSIVE_AGENCY,
    ...over,
  };
}

describe('Φ — τι λείπει από τη φόρμα', () => {
  it('🔑 Φ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: πλήρης φόρμα δεν έχει κανένα εμπόδιο', () => {
    expect(mandateRequestFormBlockers(values(), TODAY)).toEqual([]);
  });

  it('🔴 Φ1 — Η ΚΕΝΗ ΦΟΡΜΑ ΓΕΝΝΙΕΤΑΙ ΧΩΡΙΣ ΠΡΑΞΕΙΣ, ΚΑΙ ΕΙΝΑΙ ΣΚΟΠΙΜΟ', () => {
    // 🔴 Μια προεπιλογή `['sell']` θα **έδινε δικαίωμα που ο άνθρωπος δεν έδωσε** —
    //    ακριβώς η μετάλλαξη που το `mandate-scope-empty` υπάρχει για να αποκλείσει.
    //    Το εμπόδιο εδώ είναι το τίμημα, και το πληρώνουμε συνειδητά.
    expect(emptyMandateRequestForm(TODAY).scope).toEqual([]);
    expect(mandateRequestFormBlockers(values({ scope: [] }), TODAY)).toContain(
      'request-scope-unset',
    );
  });

  it('Φ2 — η κενή φόρμα ΕΧΕΙ έναρξη: «από τώρα» δεν αφαιρεί τίποτα από κανέναν', () => {
    expect(emptyMandateRequestForm(TODAY).startsOn).toBe('2026-08-30');
    expect(mandateRequestFormBlockers(values(), TODAY)).not.toContain('request-start-unset');
  });

  it('🔴 Φ3 — ΑΝΑΠΟΔΟ ΔΙΑΣΤΗΜΑ έχει ΔΙΚΟ ΤΟΥ κωδικό, όχι «περασμένη λήξη»', () => {
    // ⚠️ Τα δύο στέλνουν τον άνθρωπο σε **διαφορετικό πεδίο**. Ένας κοινός κωδικός
    //    θα του έλεγε να διορθώσει τη λήξη ενώ το λάθος είναι στην έναρξη.
    const found = mandateRequestFormBlockers(
      values({ startsOn: '2027-06-01', expiresOn: '2027-01-01' }),
      TODAY,
    );
    expect(found).toContain('request-start-after-expiry');
    expect(found).not.toContain('request-expiry-past');
  });

  it('🔴 Φ4 — ΑΝΑΠΟΔΟ ΔΙΑΣΤΗΜΑ ΣΙΩΠΑ ΤΟΝ ΝΟΜΟ, ΚΑΙ ΓΙ᾽ ΑΥΤΟ ΣΤΑΜΑΤΑΜΕ', () => {
    // 🔴 Με αρνητική διάρκεια το `exceedsStatutoryTerm` απαντά **πάντα** «νόμιμο» —
    //    δηλαδή θα ήταν αδρανής φρουρός. Η άγκυρα χαρακτηρίζει το ότι δεν
    //    **ισχυριζόμαστε** ότι κρίναμε κάτι που δεν κρίναμε (N.12).
    expect(
      mandateRequestFormBlockers(values({ startsOn: '2030-01-01', expiresOn: '2027-01-01' }), TODAY),
    ).not.toContain('request-term-illegal');
  });

  it('🏆 Φ5 — ΠΡΟΓΡΑΜΜΑΤΙΣΜΕΝΗ ΕΝΤΟΛΗ ΔΕΝ ΕΙΝΑΙ ΠΑΡΑΝΟΜΗ (§5.8)', () => {
    // 🏆 Εξάμηνη αποκλειστική που **αρχίζει σε έξι μήνες**. Μετρημένη από «σήμερα»
    //    ήταν δωδεκάμηνη ⇒ η φόρμα εμπόδιζε **νόμιμη** συμφωνία. Μετρημένη από την
    //    **έναρξη**, στέκει — και είναι η δυνατότητα που κανένα MLS δεν προσφέρει.
    expect(
      mandateRequestFormBlockers(
        values({ startsOn: '2027-03-01', expiresOn: '2027-08-31' }),
        TODAY,
      ),
    ).toEqual([]);
  });

  it('🔴 Φ6 — ΚΑΙ ΤΟ ΟΡΙΟ ΕΞΑΚΟΛΟΥΘΕΙ ΝΑ ΠΙΑΝΕΙ: υπερβολική διάρκεια ΑΠΟ ΤΗΝ ΕΝΑΡΞΗ', () => {
    // ⚠️ Ο παρονομαστής της Φ5: χωρίς αυτήν, «μέτρα από την έναρξη» θα μπορούσε να
    //    σημαίνει «μη μετράς καθόλου».
    expect(
      mandateRequestFormBlockers(
        values({ startsOn: '2027-03-01', expiresOn: '2029-03-01' }),
        TODAY,
      ),
    ).toContain('request-term-illegal');
  });

  it('Φ7 — επιστρέφει ΟΛΑ όσα βρίσκει, όχι το πρώτο', () => {
    const found = mandateRequestFormBlockers(
      values({ ownerPropertyId: '  ', scope: [], compensation: { type: 'percentage', percentage: 0, vatIncluded: false } }),
      TODAY,
    );
    expect(found).toContain('request-listing-unset');
    expect(found).toContain('request-scope-unset');
    expect(found).toContain('request-compensation-invalid');
  });

  it('Φ8 — κάθε δηλωμένο εμπόδιο είναι ΠΡΑΓΜΑΤΙ παραγώγιμο (κανένα νεκρό)', () => {
    const reachable = new Set<string>([
      ...mandateRequestFormBlockers(
        values({
          ownerPropertyId: '',
          scope: [],
          compensation: { type: 'fixed', amountEUR: 0, vatIncluded: false },
        }),
        TODAY,
      ),
      ...mandateRequestFormBlockers(values({ expiresOn: 'χχχ' }), TODAY),
      ...mandateRequestFormBlockers(values({ startsOn: 'χχχ' }), TODAY),
      ...mandateRequestFormBlockers(values({ expiresOn: '2020-01-01' }), TODAY),
      ...mandateRequestFormBlockers(values({ startsOn: '2028-01-01', expiresOn: '2027-01-01' }), TODAY),
      ...mandateRequestFormBlockers(values({ expiresOn: '2030-01-01' }), TODAY),
    ]);

    for (const blocker of MANDATE_REQUEST_FORM_BLOCKERS) {
      expect(reachable).toContain(blocker);
    }
  });
});

describe('Μ — φόρμα → όροι: τι ΤΑΞΙΔΕΥΕΙ στην πόρτα', () => {
  it('🔴 Μ1 — Η ΗΜΕΡΑ ΤΗΣ ΛΗΞΗΣ ΜΕΤΡΑΕΙ ΟΛΟΚΛΗΡΗ, Η ΗΜΕΡΑ ΤΗΣ ΕΝΑΡΞΗΣ ΕΠΙΣΗΣ', () => {
    // 🔴 **Ασύμμετρα, και επίτηδες.** «Ισχύει από 13/03 μέχρι 30/09» σημαίνει ότι
    //    **και οι δύο** ημέρες μετράνε ολόκληρες. Ένα `endOfDay` και στα δύο άκρα θα
    //    έτρωγε την πρώτη μέρα· ένα `startOfDay` και στα δύο θα έτρωγε την τελευταία.
    const terms = proposedTermsFrom(values({ startsOn: '2027-03-13', expiresOn: '2027-09-30' }));
    expect(terms.startsAt).toBe('2027-03-13T00:00:00.000Z');
    expect(terms.expiresAt).toBe('2027-09-30T23:59:59.999Z');
  });

  it('🔴 Μ2 — ΤΟ `scope` ΤΑΞΙΔΕΥΕΙ ΟΠΩΣ ΔΟΘΗΚΕ, χωρίς σιωπηλή συμπλήρωση', () => {
    expect(proposedTermsFrom(values({ scope: ['leaseOut'] })).scope).toEqual(['leaseOut']);
    // ⚠️ **Και το κενό μένει κενό**: ένα `?? OFFER_KINDS` εδώ θα έδινε στο γραφείο
    //    και τις τρεις πράξεις τη στιγμή που ο άνθρωπος δεν διάλεξε καμία.
    expect(proposedTermsFrom(values({ scope: [] })).scope).toEqual([]);
  });

  it('🔑 Μ3 — Η ΔΙΑΔΟΧΗ ΕΙΝΑΙ ΔΥΝΑΤΗ: έναρξη την επομένη δεν επικαλύπτεται', () => {
    // 🔑 Ημι-ανοιχτό `[από, ως)`: λήξη `2027-03-12T23:59:59.999` και έναρξη
    //    `2027-03-13T00:00:00.000` **δεν** τέμνονται. Αν το `startOfDay` γινόταν
    //    `endOfDay`, θα τέμνονταν — και ο προγραμματισμός θα απορριπτόταν για λόγο
    //    που κανείς δεν θα έβλεπε στην οθόνη.
    const previousEnd = Date.parse('2027-03-12T23:59:59.999Z');
    const mine = Date.parse(proposedTermsFrom(values({ startsOn: '2027-03-13' })).startsAt);
    expect(mine).toBeGreaterThan(previousEnd);
  });
});
