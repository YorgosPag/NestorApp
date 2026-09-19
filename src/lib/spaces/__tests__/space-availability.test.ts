/**
 * ⚓ ADR-777 §8.60.20 — η ΔΙΑΘΕΣΙΜΟΤΗΤΑ χώρων: φίλτρα, μετρήσεις, πρόχειρο — από ΜΙΑ αλήθεια.
 *
 * Ομάδες: Α — ο κουβάς · Β — τα φίλτρα · Γ — οι μετρήσεις (η «κατοίκηση» παράγεται) ·
 * Δ — οι κατανομές των αναφορών · Ε — το πρόχειρο λειτουργικής κατάστασης.
 */

import { COMMERCIAL_STATUSES } from '@/constants/commercial-statuses';
import {
  countSpaceStatuses,
  matchesAnySpaceAvailability,
  matchesSpaceAvailability,
  matchesSpaceStatusFilters,
  spaceAvailabilityBucket,
  spaceAvailabilityRank,
  spaceStatusDistributions,
  SPACE_AVAILABILITY_BUCKETS,
} from '../space-availability';
import { operationalDraftOf, operationalPatchOf, parseOperationalDraft } from '../space-operational-draft';

const listed = { commercialStatus: 'for-rent' };
const sold = { commercialStatus: 'sold' };
const legacySold = { status: 'sold' };
const incident = { status: 'available', commercialStatus: 'sold' };

describe('Α. Ο ΚΟΥΒΑΣ — ΑΠΟ ΤΟ `commercialStatus`', () => {
  it('🔴 Α1 — το περιστατικό: παλιό `available` + πώληση ⇒ «sold», ΟΧΙ «listed»', () => {
    expect(spaceAvailabilityBucket(incident)).toBe('sold');
  });

  it('Α2 — κάθε εμπορική κατάσταση πέφτει σε ΕΝΑΝ κουβά (εξαντλητικό)', () => {
    for (const status of COMMERCIAL_STATUSES) {
      expect(SPACE_AVAILABILITY_BUCKETS).toContain(spaceAvailabilityBucket({ commercialStatus: status }));
    }
    expect(spaceAvailabilityBucket({ commercialStatus: 'for-sale-and-rent' })).toBe('listed');
  });

  it('Α3 — αδήλωτη διάθεση ⇒ «εκτός αγοράς», ΠΟΤΕ «στην αγορά»', () => {
    expect(spaceAvailabilityBucket({})).toBe('unavailable');
    expect(spaceAvailabilityBucket({ status: 'available' })).toBe('unavailable');
  });

  it('Α4 — «read both»: παλιό `status: sold` χωρίς νέο πεδίο μετρά ως πωλημένο', () => {
    expect(spaceAvailabilityBucket(legacySold)).toBe('sold');
  });
});

describe('Β. ΤΑ ΦΙΛΤΡΑ', () => {
  it('Β1 — μονή επιλογή· `all` ή άγνωστη τιμή ⇒ όλοι', () => {
    expect(matchesSpaceAvailability(listed, 'listed')).toBe(true);
    expect(matchesSpaceAvailability(sold, 'listed')).toBe(false);
    expect(matchesSpaceAvailability(sold, 'all')).toBe(true);
    expect(matchesSpaceAvailability(sold, 'occupied')).toBe(true);
  });

  it('Β2 — πολλαπλή επιλογή: κενή ⇒ όλοι· αλλιώς ο κουβάς ανάμεσα στους επιλεγμένους', () => {
    expect(matchesAnySpaceAvailability(sold, [])).toBe(true);
    expect(matchesAnySpaceAvailability(sold, ['listed', 'sold'])).toBe(true);
    expect(matchesAnySpaceAvailability(incident, ['listed'])).toBe(false);
  });

  it('Β3 — δύο όψεις: διάθεση ΚΑΙ λειτουργία (και παλιό `maintenance`)', () => {
    const repair = { status: 'maintenance', commercialStatus: 'for-sale' };
    expect(matchesSpaceStatusFilters(repair, { status: ['listed'], operationalStatus: ['maintenance'] })).toBe(true);
    expect(matchesSpaceStatusFilters(repair, { status: ['listed'], operationalStatus: ['ready'] })).toBe(false);
    expect(matchesSpaceStatusFilters(repair, { status: ['sold'] })).toBe(false);
    expect(matchesSpaceStatusFilters(repair, { status: ['all'], operationalStatus: ['all'] })).toBe(true);
  });

  it('Β4 — η ταξινόμηση «κατά κατάσταση» ακολουθεί τη σειρά των κουβάδων', () => {
    expect(spaceAvailabilityRank(listed)).toBeLessThan(spaceAvailabilityRank(sold));
  });
});

describe('Γ. ΟΙ ΜΕΤΡΗΣΕΙΣ', () => {
  it('🔴 Γ1 — πλακίδια: η πωλημένη θέση μετρά ως πωλημένη, όχι ως διαθέσιμη', () => {
    const counts = countSpaceStatuses([listed, incident, { commercialStatus: 'rented' }, { status: 'maintenance' }]);
    expect(counts.byAvailability).toEqual({ listed: 1, reserved: 0, sold: 1, rented: 1, unavailable: 1 });
    expect(counts.total).toBe(4);
  });

  it('Γ2 — η «κατοίκηση» ΠΑΡΑΓΕΤΑΙ (πώληση + μίσθωση)· η λειτουργική εξαίρεση μετρά χωριστά', () => {
    const counts = countSpaceStatuses([sold, { commercialStatus: 'rented' }, { status: 'maintenance' }, listed]);
    expect(counts.inUse).toBe(2);
    expect(counts.notReady).toBe(1);
    expect(counts.utilizationRate).toBe(50);
    expect(counts.availabilityRate).toBe(25);
  });

  it('Γ3 — κενή λίστα ⇒ μηδενικά ποσοστά, όχι NaN', () => {
    expect(countSpaceStatuses([]).utilizationRate).toBe(0);
  });
});

describe('Δ. ΟΙ ΚΑΤΑΝΟΜΕΣ ΤΩΝ ΑΝΑΦΟΡΩΝ', () => {
  it('Δ1 — ανά εμπορική (αδήλωτη ⇒ unavailable) και ανά λειτουργική (αδήλωτη ⇒ unknown)', () => {
    expect(spaceStatusDistributions([incident, listed, { status: 'maintenance' }])).toEqual({
      byCommercialStatus: { sold: 1, 'for-rent': 1, unavailable: 1 },
      byOperationalStatus: { unknown: 2, maintenance: 1 },
    });
  });
});

describe('Ε. ΤΟ ΠΡΟΧΕΙΡΟ ΛΕΙΤΟΥΡΓΙΚΗΣ ΚΑΤΑΣΤΑΣΗΣ', () => {
  it('Ε1 — αποθηκευμένο → πρόχειρο μέσω του αναγνώστη· αδήλωτο ⇒ κενό (placeholder)', () => {
    expect(operationalDraftOf({ status: 'maintenance' })).toBe('maintenance');
    expect(operationalDraftOf({ status: 'available' })).toBe('');
    expect(parseOperationalDraft('underConstruction')).toBe('under-construction');
    expect(parseOperationalDraft('sold')).toBe('');
  });

  it('Ε2 — ιδεμπότητα: ίδιο ή αδήλωτο πρόχειρο ⇒ κενό patch· αλλαγή ⇒ μόνο το πεδίο', () => {
    expect(operationalPatchOf('ready', { operationalStatus: 'ready' })).toEqual({});
    expect(operationalPatchOf('', { operationalStatus: 'ready' })).toEqual({});
    expect(operationalPatchOf('maintenance', { operationalStatus: 'ready' })).toEqual({ operationalStatus: 'maintenance' });
    expect(operationalPatchOf('maintenance', { status: 'maintenance' })).toEqual({});
  });
});
