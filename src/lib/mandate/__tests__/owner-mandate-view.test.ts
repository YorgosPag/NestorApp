/**
 * ADR-834 §5 — ΑΓΚΥΡΕΣ της **πρώτης προβολής της ακμής**.
 *
 * 🔴 **ΤΟ ΕΛΑΤΤΩΜΑ**: η σχέση **ταξίδευε ήδη** στον φυλλομετρητή του ιδιώτη και
 * **καμία γραμμή δεν τη ζωγράφιζε** (grep `mandatesOf` σε `owner-property` + `demand`
 * + `private-space` ⇒ 0 αποτελέσματα, 2026-08-30).
 *
 *   Π-0  🔑 **ΤΟ ΖΩΝΤΑΝΟ ΣΧΗΜΑ** — ενικό `mandate`, **χωρίς** τα τρία πεδία του ADR-832
 *   Π-1  Χωρίς εντολή ⇒ **κενό**, ποτέ γραμμή «δεν έχετε»
 *   Π-2  🔴 Ο ταξινομητής είναι **Ο ΙΔΙΟΣ** με του καταλόγου του γραφείου
 *   Π-3  🔴 **ΔΕΝ φιλτράρει σαν `bindingMandates`**: η εντολή που **δήλωσε το γραφείο**
 *        και ο ιδιοκτήτης δεν επιβεβαίωσε είναι ακριβώς αυτή που **οφείλει** να δει
 *   Π-4  🔴 **ΔΕΝ φιλτράρει σαν `occupancyNotice`**: η **ληγμένη** εμφανίζεται
 *   Π-5  Σειρά: ό,τι **δεν έκλεισε** πρώτο, μετά κατά λήξη
 *   Π-6  Τα κληροδοτημένα κενά γίνονται `null` **με όνομα**, ποτέ `undefined` στην οθόνη
 */

import { brokeredMandate } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import { mandateStandingOf } from '@/lib/mandate/mandate-standing';
import {
  ownerMandateViewOf,
  ownerMandateViews,
} from '@/lib/mandate/owner-mandate-view';
import { AGENCY_ATTESTATION, type BrokeredListingMandate } from '@/types/owner-property-mandate';

const NOW = '2026-08-30T12:00:00.000Z';

/**
 * 🔴 **ΤΟ ΜΟΝΑΔΙΚΟ ΕΓΓΡΑΦΟ ΕΝΤΟΛΗΣ ΤΗΣ ΖΩΝΤΑΝΗΣ ΒΑΣΗΣ**, αντιγραμμένο πεδίο-πεδίο
 * (`owner_properties/ownp_bc548607…`, 2026-08-30). Γράφτηκε **πριν** το ADR-832, άρα
 * **δεν έχει** `agencyCompanyId`, `scope`, `startsAt` — ενώ ο τύπος τα δηλώνει
 * υποχρεωτικά. Το `as` είναι η **ειλικρίνεια** εδώ: το σχήμα του δίσκου δεν είναι ο
 * τύπος, και η προβολή είναι το σημείο όπου αυτό σταματά να πονάει.
 */
const LIVE_LEGACY = {
  kind: 'brokered',
  clientContactId: 'cont_da84f8c4-2344-4f0f-b161-d1f795d25d2f',
  confirmation: 'confirmed',
  confirmedByUserId: 'WKBWEg3DSfcdSbLNJfzGEW3vkct1',
  proof: { via: 'owner-consent' },
  agreement: 'exclusive-agency',
  compensation: { type: 'percentage', percentage: 2, vatIncluded: false },
  decidedAt: '2026-08-30T06:27:46.094Z',
  notifiedAt: null,
  notifyOutcome: null,
  viewedAt: null,
  consentNonce: null,
  expiresAt: '2027-04-30T23:59:59.999Z',
  agencyRevokedAt: null,
} as unknown as BrokeredListingMandate;

// ============================================================================
describe('Π — η προβολή της ακμής', () => {
  it('Π-0 🔑 ΤΟ ΖΩΝΤΑΝΟ ΕΓΓΡΑΦΟ: ενικό `mandate`, τρία πεδία λείπουν, ΜΙΑ προβολή', () => {
    const views = ownerMandateViews({ mandate: LIVE_LEGACY }, NOW);

    expect(views).toHaveLength(1);
    expect(views[0].standing).toBe('unannounced-live');
    expect(views[0].agreement).toBe('exclusive-agency');
    expect(views[0].compensation).toEqual({
      type: 'percentage',
      percentage: 2,
      vatIncluded: false,
    });
    expect(views[0].expiresAt).toBe('2027-04-30T23:59:59.999Z');
    expect(views[0].proofVia).toBe('owner-consent');
  });

  it('Π-6 🔴 τα κληροδοτημένα κενά γίνονται `null`/`[]` ΜΕ ΟΝΟΜΑ, ποτέ `undefined`', () => {
    const [view] = ownerMandateViews({ mandate: LIVE_LEGACY }, NOW);

    // Η οθόνη λέει «δεν καταγράφηκε ποιο γραφείο» — δεν ζωγραφίζει κενό.
    expect(view.agencyCompanyId).toBeNull();
    expect(view.startsAt).toBeNull();
    expect(view.scope).toEqual([]);
  });

  it('Π-1 χωρίς εντολή ⇒ ΚΕΝΟ (ο ιδιώτης χωρίς μεσίτη δεν διαβάζει για μεσιτεία)', () => {
    expect(ownerMandateViews({ mandate: { kind: 'self' } }, NOW)).toEqual([]);
    expect(ownerMandateViews({}, NOW)).toEqual([]);
    expect(ownerMandateViews({ mandates: [] }, NOW)).toEqual([]);
  });

  it('Π-2 🔴 Ο ΤΑΞΙΝΟΜΗΤΗΣ ΕΙΝΑΙ Ο ΙΔΙΟΣ — καμία δεύτερη κρίση για την ίδια ακμή', () => {
    // Αν εδώ γεννιόταν δεύτερος κριτής, η οθόνη του ιδιοκτήτη θα μπορούσε να λέει
    // «ισχύει» ενώ του γραφείου λέει «έληξε», για το ΙΔΙΟ έγγραφο (ADR-749 §5).
    const cases: readonly BrokeredListingMandate[] = [
      brokeredMandate({ confirmation: 'declined' }),
      brokeredMandate({ confirmation: 'confirmed', expiresAt: '2020-01-01T00:00:00.000Z' }),
      brokeredMandate({ confirmation: 'pending', notifiedAt: NOW, consentNonce: 'n' }),
      brokeredMandate({ confirmation: 'confirmed', notifiedAt: NOW }),
    ];

    for (const mandate of cases) {
      expect(ownerMandateViewOf(mandate, NOW).standing).toBe(mandateStandingOf(mandate, NOW));
    }
  });

  it('Π-3 🔴 Η ΔΗΛΩΜΕΝΗ-ΜΗ-ΕΠΙΒΕΒΑΙΩΜΕΝΗ ΕΜΦΑΝΙΖΕΤΑΙ (το `bindingMandates` θα την έκοβε)', () => {
    // 🔑 Είναι το **μόνο** σημείο όπου ο άνθρωπος μπορεί να πει «όχι» σε σχέση που
    //    δεν ξεκίνησε ο ίδιος. Ένα φίλτρο εδώ θα του την έκρυβε.
    const attested = brokeredMandate({
      confirmation: 'pending',
      proof: { via: AGENCY_ATTESTATION, attestedByUserId: 'u', attestedAt: NOW, documentPath: null },
      notifiedAt: NOW,
      consentNonce: 'nonce',
    });

    const views = ownerMandateViews({ mandates: [attested] }, NOW);
    expect(views).toHaveLength(1);
    expect(views[0].proofVia).toBe('agency-attestation');
  });

  it('Π-4 🔴 Η ΛΗΓΜΕΝΗ ΕΜΦΑΝΙΖΕΤΑΙ (το `occupancyNotice` θα απαντούσε «ελεύθερο»)', () => {
    const expired = brokeredMandate({
      confirmation: 'confirmed',
      notifiedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-02-01T00:00:00.000Z',
    });

    const views = ownerMandateViews({ mandates: [expired] }, NOW);
    expect(views).toHaveLength(1);
    expect(views[0].standing).toBe('expired');
    expect(views[0].daysLeft).toBeNull();
  });

  it('Π-5 σειρά: ό,τι ΔΕΝ έκλεισε πρώτο, και μέσα στην ομάδα κατά λήξη', () => {
    const closed = brokeredMandate({
      agencyCompanyId: 'comp_kleisto',
      confirmation: 'confirmed',
      notifiedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-02-01T00:00:00.000Z',
    });
    const openLate = brokeredMandate({
      agencyCompanyId: 'comp_arga',
      confirmation: 'confirmed',
      notifiedAt: NOW,
      expiresAt: '2027-12-01T00:00:00.000Z',
    });
    const openSoon = brokeredMandate({
      agencyCompanyId: 'comp_syntoma',
      confirmation: 'confirmed',
      notifiedAt: NOW,
      expiresAt: '2026-09-05T00:00:00.000Z',
    });

    const views = ownerMandateViews({ mandates: [closed, openLate, openSoon] }, NOW);
    expect(views.map((view) => view.agencyCompanyId)).toEqual([
      'comp_syntoma',
      'comp_arga',
      'comp_kleisto',
    ]);
  });
});
