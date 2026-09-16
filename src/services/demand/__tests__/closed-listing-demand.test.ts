/**
 * @fileoverview **Κλειστή διάθεση × ζήτηση — οι άγκυρες της Φ2** (επίπεδο Γ).
 * @related ADR-864 §7 (Α6) · §16 (Γ1-Γ4) · ADR-777 SPEC-777B §12.6
 *
 * Η **πραγματική** αλυσίδα από το ακίνητο ως την απόφαση «ανακοινώνεται;»:
 *
 *   ακίνητο → `ownerPropertyFactsOf` / `companyPropertyFactsOf` → `discloseInterest`
 *           → `announceIfNewsworthy` → `announceOnePlace`
 *
 * Μοκάρονται **μόνο** οι δύο ραφές που αγγίζουν τον κόσμο: η αποστολή (`announceOnePlace`)
 * και η αλυσίδα κτίριο → έργο του γραφείου (`collectPlaceKnowledge`). Η κρίση δεν μοκάρεται
 * πουθενά — αλλιώς η άγκυρα θα απαντούσε για τον μοκ, όχι για τη μηχανή.
 */

import * as fs from 'fs';
import * as path from 'path';

const announceOnePlace = jest.fn();
jest.mock('@/services/demand/interest-notifier.service', () => ({
  announceOnePlace: (...args: unknown[]) => announceOnePlace(...args),
}));
jest.mock('@/services/listings/publish-public-listing', () => ({
  collectPlaceKnowledge: async () => ({ candidates: [], ref: null }),
}));

import { COMMERCIAL_STATUSES } from '@/constants/commercial-statuses';
import { MARKETING_AUDIENCES } from '@/constants/marketing-audiences';
import { discloseInterest } from '@/lib/demand/demand-interest';
import { demand } from '@/lib/demand/__tests__/demand-fixtures';
import {
  offerOf,
  validOwnerProperty,
} from '@/lib/owner-property/__tests__/owner-property-fixtures';
import {
  announceIfNewsworthy,
  createAnnouncementTally,
  type AnnouncementCandidate,
} from '@/services/demand/announcement-pass';
import {
  companyPropertyFactsOf,
  ownerPropertyFactsOf,
} from '@/services/demand/place-interest.service';
import {
  offerStateOf,
  projectListingShape,
  type ProjectableProperty,
} from '@/services/listings/public-listing-projection';
import type { OwnerProperty } from '@/types/owner-property';
import type { PropertyDemand } from '@/types/property-demand';

const AT = '2026-08-11T00:00:00.000Z';
const MOMENT = { nowIso: AT, todayDate: '2026-08-11' };
const NO_PLACE = { candidates: [], ref: null };

/** Πέντε ζητήσεις που ταιριάζουν σε **δηλωμένο** διαμέρισμα προς πώληση. */
const SEEKERS: readonly PropertyDemand[] = Array.from({ length: 5 }, (_, index) =>
  demand({ id: `dmnd_${index}`, authorUserId: `seeker_${index}` }),
);

function stanceOf(property: OwnerProperty): string {
  return discloseInterest(ownerPropertyFactsOf(property, AT), SEEKERS, AT, MOMENT.todayDate)
    .interest.stance;
}

function candidateOf(property: OwnerProperty): AnnouncementCandidate {
  return {
    propertyId: property.id,
    propertyTitle: property.title,
    recipientId: property.authorUserId,
    tenantId: property.authorUserId,
    source: 'owner-property',
    holderId: property.authorUserId,
    facts: ownerPropertyFactsOf(property, AT),
  };
}

/** Ένα πέρασμα ανακοίνωσης για **ένα** ακίνητο — η λογιστική του, κλεισμένη. */
async function passOver(property: OwnerProperty) {
  const tally = createAnnouncementTally();
  await announceIfNewsworthy(tally, candidateOf(property), SEEKERS, MOMENT);
  return tally.snapshot(1, 500);
}

beforeEach(() => {
  announceOnePlace.mockReset();
  announceOnePlace.mockResolvedValue('announced');
});

// =============================================================================
// Α6 — «ταιριάζει;» κρίνεται ΜΟΝΟ από τη μία μηχανή· το κοινό δεν μπαίνει ποτέ
// =============================================================================

describe('🏆 Α6 — το κοινό ΔΕΝ είναι άξονας ταιριάσματος', () => {
  it.each(MARKETING_AUDIENCES)('κοινό «%s» ⇒ ίδια ετυμηγορία με το δημόσιο', (audience) => {
    const open = validOwnerProperty();
    const closed = validOwnerProperty({ marketingAudience: audience });
    const judge = (property: OwnerProperty) =>
      discloseInterest(ownerPropertyFactsOf(property, AT), SEEKERS, AT, MOMENT.todayDate);

    expect(judge(closed)).toEqual(judge(open));
    expect(judge(closed).interest).toEqual({
      stance: 'offered',
      disclosure: expect.objectContaining({ count: 5 }),
    });
  });

  it('🔴 καμία διαδρομή ζήτησης δεν ρωτά την πύλη δημοσίευσης ή το κοινό', () => {
    // Ο δεύτερος κριτής θα γεννιόταν **εδώ**: ένα `isPubliclyListed`/`marketingAudience`
    // σε αρχείο της κρίσης ζήτησης = φίλτρο κοινού δίπλα στη μηχανή (ADR-864 §5.3).
    const JUDGES = [
      'src/lib/demand/demand-interest.ts',
      'src/services/demand/announcement-pass.ts',
      'src/services/demand/interest-notifier.service.ts',
      'src/services/demand/company-interest-notifier.service.ts',
      'src/services/demand/place-interest.service.ts',
    ];
    for (const file of JUDGES) {
      const code = fs
        .readFileSync(path.join(process.cwd(), file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      expect({ file, hits: code.match(/isPubliclyListed|buildPublicListing|marketingAudience/g) })
        .toEqual({ file, hits: null });
    }
  });
});

// =============================================================================
// Γ1 — κλειστή διάθεση ζωντανή ⇒ πλήθος στον κάτοχο· αποσυρμένη ⇒ ΔΟΛΩΜΑ, όχι «αυτό»
// =============================================================================

describe('🏆 Γ1 — ο κάτοχος κλειστής διάθεσης λαμβάνει πλήθος', () => {
  it('custodians + ζωντανή ⇒ «αυτό ακριβώς», και ανακοινώνεται', async () => {
    const closed = validOwnerProperty({ marketingAudience: 'custodians' });
    // ⚠️ Η στάση **πριν** το πλήθος: το δόλωμα (`dormant`) θα έδινε κι αυτό 5 — με τη
    //    φωνή «κάτι σαν το δικό σας», δηλαδή ψευδώς ταπεινό για ζωντανή διάθεση.
    expect(stanceOf(closed)).toBe('offered');
    const report = await passOver(closed);

    expect(report.announced).toBe(1);
    expect(announceOnePlace).toHaveBeenCalledWith(expect.objectContaining({ count: 5 }));
  });

  it('⚠️ αποσυρμένη ⇒ `dormant` («κάτι σαν το δικό σας»), ΠΟΤΕ `offered`', () => {
    // ADR-864 §2.3 Φ0.1 **διορθώθηκε**: η απόσυρση δεν σιωπά — πέφτει στο δόλωμα του
    // §12.6 (Compass Buyer Demand · Idealista: ζήτηση για **οποιοδήποτε** ακίνητο).
    const withdrawn = validOwnerProperty({ lifecycle: 'withdrawn', marketingAudience: 'custodians' });
    expect(stanceOf(withdrawn)).toBe('dormant');
  });
});

// =============================================================================
// Γ2 — ολοκληρωμένη συναλλαγή ⇒ ΚΑΜΙΑ ανακοίνωση (θεραπεία Φ0.1β)
// =============================================================================

describe('🏆 Γ2 — πουλημένο/ενοικιασμένο ⇒ κανένας αριθμός, καμία ειδοποίηση', () => {
  it.each([
    ['sell', 210_000],
    ['leaseOut', 900],
  ] as const)('ιδιώτης με ΚΛΕΙΣΜΕΝΗ διάθεση «%s» ⇒ settled', async (kind, amount) => {
    const settled = validOwnerProperty({ offers: [offerOf(kind, amount, 'closed')] });

    expect(stanceOf(settled)).toBe('settled');
    const report = await passOver(settled);
    expect(report).toEqual(expect.objectContaining({ settled: 1, noNews: 0, announced: 0 }));
    expect(announceOnePlace).not.toHaveBeenCalled();
  });

  it.each(['sold', 'rented'])('γραφείο με `%s` ⇒ settled, χωρίς αριθμό', async (status) => {
    const company: ProjectableProperty = { id: 'prop_1', type: 'apartment', commercialStatus: status };
    const facts = await companyPropertyFactsOf({} as never, company, AT);

    expect(discloseInterest(facts, SEEKERS, AT, MOMENT.todayDate)).toEqual({
      interest: { stance: 'settled' },
      census: { interested: 0, notCountable: 0, mismatch: 0, considered: 0, undeclaredAxes: [] },
    });
  });
});

// =============================================================================
// Γ3 — καμία ταυτότητα ζητούντος φεύγει προς τον κάτοχο (πρόδρομος Α4)
// =============================================================================

describe('🏆 Γ3 — η ανακοίνωση δεν κουβαλά ταυτότητα ζητούντος', () => {
  it('κλειστό σύνολο πεδίων· κανένα `seeker_*`/`dmnd_*` πουθενά', async () => {
    await passOver(validOwnerProperty({ marketingAudience: 'custodians' }));
    const [payload] = announceOnePlace.mock.calls[0] as [Record<string, unknown>];

    expect(Object.keys(payload).sort()).toEqual([
      'band', 'count', 'holderId', 'propertyId', 'propertyTitle', 'recipientId', 'source', 'tenantId',
    ]);
    expect(JSON.stringify(payload)).not.toMatch(/seeker_|dmnd_/);
  });
});

// =============================================================================
// Γ4 — ο ΕΝΑΣ ορισμός του «διατίθεται» είναι αναλλοίωτος στην προβολή
// =============================================================================

describe('🏆 Γ4 — offerStateOf(ακίνητο) === offerStateOf(προβολή του)', () => {
  const KIND_SETS = [null, [], ['sell'], ['exchange'], ['leaseShort', 'leaseOut'], ['bogus']];
  const TYPES = ['apartment', null];

  it('εξαντλητικά: 7 καταστάσεις × 6 σύνολα διαθέσεων × 2 είδη', () => {
    let checked = 0;
    for (const commercialStatus of COMMERCIAL_STATUSES) {
      for (const offerKinds of KIND_SETS) {
        for (const type of TYPES) {
          const property: ProjectableProperty = { id: 'p', type, commercialStatus, offerKinds };
          const shape = projectListingShape(property, NO_PLACE, AT);
          expect({ commercialStatus, offerKinds, type, state: offerStateOf(shape) })
            .toEqual({ commercialStatus, offerKinds, type, state: offerStateOf(property) });
          checked += 1;
        }
      }
    }
    expect(checked).toBe(COMMERCIAL_STATUSES.length * KIND_SETS.length * TYPES.length);
  });

  it('κάθε κατάσταση έχει απόδειξη ζωής', () => {
    expect(offerStateOf({ type: 'apartment', commercialStatus: 'for-sale' })).toBe('offered');
    expect(offerStateOf({ type: 'apartment', commercialStatus: 'sold', offerKinds: ['sell'] })).toBe('settled');
    expect(offerStateOf({ type: 'apartment', commercialStatus: 'unavailable' })).toBe('unoffered');
  });
});
