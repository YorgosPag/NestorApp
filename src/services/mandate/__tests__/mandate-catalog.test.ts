/**
 * @jest-environment node
 *
 * @fileoverview **Ο ΚΑΤΑΛΟΓΟΣ ΕΝΤΟΛΩΝ** — οι άγκυρες της ανάγνωσης (§8.34).
 * @related services/mandate/mandate-catalog.service.ts
 *
 * ⚠️ **Τίποτα δεν πλάθεται εκτός από τη βάση.** Ο ταξινομητής, ο κριτής δημοσίευσης
 * και η ανάγνωση ονομάτων τρέχουν **αληθινά**. Ένα test που έπλαθε τον
 * `mandateStandingOf` θα απεδείκνυε ότι ο κατάλογος καλεί ό,τι νομίζουμε — όχι ότι
 * λέει την αλήθεια (μάθημα Μ-Ζ: *τρέξε τη ΔΙΑΔΡΟΜΗ, όχι το ενδιάμεσο*).
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import {
  MANDATE_CATALOG_CAP,
  readMandateCatalog,
} from '@/services/mandate/mandate-catalog.service';
import { MANDATE_STANDINGS } from '@/lib/mandate/mandate-standing';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import type { OwnerProperty } from '@/types/owner-property';
import type { BrokeredListingMandate } from '@/types/owner-property-mandate';
import { OWNER_CONSENT } from '@/types/owner-property-mandate';

const NOW = '2026-08-21T10:00:00.000Z';
const OFFICE = 'comp_alfa';
const OTHER_OFFICE = 'comp_beta';

function daysFromNow(days: number): string {
  return new Date(Date.parse(NOW) + days * 24 * 60 * 60 * 1000).toISOString();
}

function brokeredMandate(over: Partial<BrokeredListingMandate> = {}): BrokeredListingMandate {
  return {
    kind: 'brokered',
    clientContactId: 'cont_kostas',
    confirmation: 'pending',
    confirmedByUserId: null,
    proof: { via: OWNER_CONSENT },
    decidedAt: null,
    notifiedAt: '2026-08-20T09:00:00.000Z',
    viewedAt: null,
    consentNonce: 'nonce-1',
    expiresAt: daysFromNow(300),
    ...over,
  };
}

function listing(id: string, over: Partial<OwnerProperty> = {}): OwnerProperty {
  return {
    id,
    authorUserId: 'user_maria',
    authorCompanyId: OFFICE,
    mandate: brokeredMandate(),
    title: `Ακίνητο ${id}`,
    type: 'plot',
    areaSqm: 500,
    floor: null,
    bedrooms: null,
    offers: [],
    place: { kind: 'declined' },
    media: [],
    lifecycle: 'listed',
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  } as OwnerProperty;
}

function dbWith(...listings: readonly OwnerProperty[]): {
  db: AdminFirestore;
  fake: FakeFirestore;
} {
  const fake = new FakeFirestore();
  // ⚠️ Ο διακριτής είναι `type`, **όχι** `contactType` — μετρημένο στο
  // `types/contacts/contracts.ts`. Η πρώτη γραφή αυτού του fixture είχε το λάθος
  // όνομα και **έριξε ολόκληρο τον κατάλογο**: έτσι βρέθηκε ότι το `as Contact` πάνω
  // σε ωμό έγγραφο μπορεί να δώσει `undefined` όνομα (δες `readClientNames`).
  fake.seed(COLLECTIONS.CONTACTS, 'cont_kostas', {
    type: 'individual',
    firstName: 'Κώστας',
    lastName: 'Παπαδόπουλος',
  });
  for (const item of listings) {
    fake.seed(COLLECTIONS.OWNER_PROPERTIES, item.id, item as unknown as Record<string, unknown>);
  }
  return { db: fake as unknown as AdminFirestore, fake };
}

// =============================================================================
// Τ — Η ΕΜΒΕΛΕΙΑ: ΤΟ ΓΡΑΦΕΙΟ, ΚΑΙ ΜΟΝΟ ΑΥΤΟ
// =============================================================================

describe('🔴 Τ — ο κατάλογος βλέπει ΜΟΝΟ τις εντολές αυτού του γραφείου', () => {
  it('Τ1 — ξένη εταιρεία ΔΕΝ εμφανίζεται', async () => {
    const { db } = dbWith(
      listing('ownp_mine'),
      listing('ownp_theirs', { authorCompanyId: OTHER_OFFICE }),
    );

    const catalog = await readMandateCatalog(db, OFFICE, NOW);
    expect(catalog.rows.map((row) => row.ownerPropertyId)).toEqual(['ownp_mine']);
  });

  it('Τ2 — αγγελία ΙΔΙΩΤΗ (χωρίς εντολή) δεν είναι γραμμή του καταλόγου', async () => {
    const { db } = dbWith(
      listing('ownp_self', {
        authorCompanyId: OFFICE,
        mandate: { kind: 'self' },
      }),
    );

    const catalog = await readMandateCatalog(db, OFFICE, NOW);
    expect(catalog.rows).toEqual([]);
  });

  it('Τ3 — κενό γραφείο δίνει κενό κατάλογο, όχι σφάλμα', async () => {
    const { db } = dbWith();
    const catalog = await readMandateCatalog(db, OFFICE, NOW);
    expect(catalog.rows).toEqual([]);
    expect(catalog.truncated).toBe(false);
  });
});

// =============================================================================
// Σ — Η ΣΕΙΡΑ ΕΙΝΑΙ ΤΟ ΠΡΟΪΟΝ
// =============================================================================

describe('🔴 Σ — ταξινόμηση κατά ΕΠΕΙΓΟΝ, όχι κατά ημερομηνία', () => {
  it('Σ1 — «περιμένουν εσάς» πρώτα, «ενεργές» τελευταίες', async () => {
    const { db } = dbWith(
      listing('ownp_live', {
        mandate: brokeredMandate({ confirmation: 'confirmed', expiresAt: daysFromNow(200) }),
      }),
      listing('ownp_waiting', { mandate: brokeredMandate() }),
      listing('ownp_silent', { mandate: brokeredMandate({ notifiedAt: null }) }),
    );

    const catalog = await readMandateCatalog(db, OFFICE, NOW);
    expect(catalog.rows.map((row) => row.ownerPropertyId)).toEqual([
      'ownp_silent',
      'ownp_waiting',
      'ownp_live',
    ]);
  });

  it('Σ2 — μέσα στην ίδια κατάσταση: ό,τι λήγει πρώτο, πρώτο', async () => {
    const { db } = dbWith(
      listing('ownp_far', { mandate: brokeredMandate({ expiresAt: daysFromNow(200) }) }),
      listing('ownp_near', { mandate: brokeredMandate({ expiresAt: daysFromNow(20) }) }),
    );

    const catalog = await readMandateCatalog(db, OFFICE, NOW);
    expect(catalog.rows.map((row) => row.ownerPropertyId)).toEqual(['ownp_near', 'ownp_far']);
  });

  it('Σ3 — οι ληγμένες πάνε ΤΕΛΟΣ μέσα στην ομάδα τους, δεν συγκρίνονται', async () => {
    const { db } = dbWith(
      listing('ownp_expired_a', {
        mandate: brokeredMandate({ confirmation: 'confirmed', expiresAt: daysFromNow(-2) }),
      }),
      listing('ownp_expired_b', {
        mandate: brokeredMandate({ confirmation: 'confirmed', expiresAt: daysFromNow(-40) }),
      }),
    );

    const catalog = await readMandateCatalog(db, OFFICE, NOW);
    expect(catalog.rows.every((row) => row.daysLeft === null)).toBe(true);
    expect(catalog.rows).toHaveLength(2);
  });
});

// =============================================================================
// Γ — Η ΓΡΑΜΜΗ ΛΕΕΙ ΤΗΝ ΑΛΗΘΕΙΑ
// =============================================================================

describe('🔴 Γ — τι κουβαλά κάθε γραμμή', () => {
  it('Γ1 — το όνομα του πελάτη βγαίνει από τον ΕΝΑ κανονικό τόπο', async () => {
    const { db } = dbWith(listing('ownp_a'));
    const [row] = (await readMandateCatalog(db, OFFICE, NOW)).rows;
    expect(row.clientName).toBe('Κώστας Παπαδόπουλος');
  });

  it('Γ2 — επαφή που ΔΕΝ υπάρχει δίνει `null`, όχι κενή συμβολοσειρά', async () => {
    // `null` σημαίνει «η εντολή δείχνει σε επαφή που χάθηκε» — δουλειά για το γραφείο.
    const { db } = dbWith(
      listing('ownp_a', { mandate: brokeredMandate({ clientContactId: 'cont_ghost' }) }),
    );
    const [row] = (await readMandateCatalog(db, OFFICE, NOW)).rows;
    expect(row.clientName).toBeNull();
  });

  it('Γ3 — το «είναι στον χάρτη;» ακολουθεί τον ΕΝΑ κριτή δημοσίευσης', async () => {
    const { db } = dbWith(
      listing('ownp_pending'),
      listing('ownp_confirmed', {
        mandate: brokeredMandate({ confirmation: 'confirmed', expiresAt: daysFromNow(200) }),
      }),
      listing('ownp_withdrawn', {
        lifecycle: 'withdrawn',
        mandate: brokeredMandate({ confirmation: 'confirmed', expiresAt: daysFromNow(200) }),
      }),
    );

    const byId = new Map(
      (await readMandateCatalog(db, OFFICE, NOW)).rows.map((row) => [row.ownerPropertyId, row]),
    );
    expect(byId.get('ownp_pending')?.onTheMarket).toBe(false);
    expect(byId.get('ownp_confirmed')?.onTheMarket).toBe(true);
    // 🔴 Αποσυρμένη ΑΛΛΑ εγκεκριμένη: αν το πεδίο ήταν ξαναγραμμένο στο χέρι με
    // «confirmed && !expired» θα έλεγε `true` για αγγελία που ΔΕΝ είναι στον χάρτη.
    expect(byId.get('ownp_withdrawn')?.onTheMarket).toBe(false);
  });

  it('Γ4 — η προέλευση ταξιδεύει πάντα', async () => {
    const { db } = dbWith(listing('ownp_a'));
    const [row] = (await readMandateCatalog(db, OFFICE, NOW)).rows;
    expect(row.proofVia).toBe(OWNER_CONSENT);
  });
});

// =============================================================================
// Λ — Η ΛΟΓΙΣΤΙΚΗ
// =============================================================================

describe('🔴 Λ — η λογιστική κλείνει και τυπώνει ΚΑΙ τα μηδενικά', () => {
  it('Λ1 — κάθε κατάσταση υπάρχει στον πίνακα, ακόμη και με 0', async () => {
    const { db } = dbWith(listing('ownp_a'));
    const { tally } = await readMandateCatalog(db, OFFICE, NOW);

    const absent = MANDATE_STANDINGS.filter((standing) => tally[standing] === undefined);
    expect(absent).toEqual([]);
  });

  it('Λ2 — το άθροισμα του πίνακα ΙΣΟΥΤΑΙ με τις γραμμές', async () => {
    const { db } = dbWith(
      listing('ownp_a'),
      listing('ownp_b', { mandate: brokeredMandate({ notifiedAt: null }) }),
      listing('ownp_c', { mandate: brokeredMandate({ confirmation: 'declined' }) }),
      listing('ownp_ignored', { authorCompanyId: OTHER_OFFICE }),
    );

    const catalog = await readMandateCatalog(db, OFFICE, NOW);
    const total = Object.values(catalog.tally).reduce((sum, count) => sum + count, 0);
    expect(total).toBe(catalog.rows.length);
    expect(total).toBe(3);
  });
});

// =============================================================================
// Ο — ΤΟ ΟΡΙΟ ΛΕΓΕΤΑΙ, ΔΕΝ ΚΡΥΒΕΤΑΙ
// =============================================================================

describe('🔴 Ο — το όριο ανάγνωσης', () => {
  it('Ο1 — κάτω από το όριο, `truncated` είναι ψευδές', async () => {
    const { db } = dbWith(listing('ownp_a'), listing('ownp_b'));
    expect((await readMandateCatalog(db, OFFICE, NOW)).truncated).toBe(false);
  });

  it('Ο2 — πάνω από το όριο, το ΛΕΕΙ και κόβει στο όριο', async () => {
    const many = Array.from({ length: MANDATE_CATALOG_CAP + 5 }, (_unused, index) =>
      listing(`ownp_${String(index).padStart(4, '0')}`),
    );
    const { db } = dbWith(...many);

    const catalog = await readMandateCatalog(db, OFFICE, NOW);
    expect(catalog.truncated).toBe(true);
    expect(catalog.rows).toHaveLength(MANDATE_CATALOG_CAP);
  });
});
