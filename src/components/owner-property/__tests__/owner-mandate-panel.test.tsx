/**
 * ADR-834 §5 — ΑΓΚΥΡΕΣ της οθόνης: **ΜΙΑ ακμή, ΔΥΟ οπτικές**.
 *
 *   Λ-1  Κάθε κατάσταση έχει κείμενο **ιδιοκτήτη**, σε el **ΚΑΙ** en
 *   Λ-2  🔴 Η ρίζα είναι **ενικός** (`offer.mandate`) — του γραφείου είναι πληθυντικός
 *   Λ-3  🔴🔴 **ΔΥΟ ΟΠΤΙΚΕΣ, ΟΧΙ ΑΝΤΙΓΡΑΦΟ**: για την ίδια κατάσταση, ο ιδιοκτήτης
 *        διαβάζει **άλλο** κείμενο από τον μεσίτη — αλλιώς ο πίνακας θα ήταν κλώνος
 *   Ο-1  Η ζωντανή εντολή ζωγραφίζεται: κατάσταση · ρόλος · περίοδος · αμοιβή · απόδειξη
 *   Ο-2  🔴 **ΚΑΝΕΝΑ ΚΑΝΑΛΙ** (ADR-827 §9.8): ούτε `mailto:`, ούτε `tel:`, ούτε φόρμα
 *   Ο-3  Χωρίς εντολή ⇒ **τίποτα στην οθόνη**
 *   Ο-4  Με δημοσιευμένη βιτρίνα ⇒ **η επωνυμία**, όχι η ταυτότητα του οργανισμού
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import React from 'react';
import { render, screen } from '@testing-library/react';

import { MANDATE_STANDINGS } from '@/lib/mandate/mandate-standing';
import { ownerMandateViews } from '@/lib/mandate/owner-mandate-view';
import { STANDING_LABEL_KEYS } from '@/components/mandate/catalog/mandate-catalog-labels';
import {
  OWNER_MANDATE_KEYS,
  OWNER_PROOF_KEYS,
  OWNER_STANDING_KEYS,
  everyStandingNamedForOwner,
} from '@/components/owner-property/owner-mandate-labels';
import { OwnerMandatePanel } from '@/components/owner-property/OwnerMandatePanel';
import type { BrokeredListingMandate } from '@/types/owner-property-mandate';

import el from '@/i18n/locales/el/property-market.json';
import en from '@/i18n/locales/en/property-market.json';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let agencyLookup: { state: string; profile?: { displayName: string } } = { state: 'absent' };
jest.mock('@/services/realtime/hooks/usePublicAgencies', () => ({
  usePublicAgency: () => agencyLookup,
}));

const NOW = '2026-08-30T12:00:00.000Z';

/** Το ζωντανό έγγραφο — χωρίς `agencyCompanyId` / `scope` / `startsAt`. */
const LIVE_LEGACY = {
  kind: 'brokered',
  clientContactId: 'cont_da84f8c4',
  confirmation: 'confirmed',
  confirmedByUserId: 'WKBWEg3D',
  proof: { via: 'owner-consent' },
  agreement: 'exclusive-agency',
  compensation: { type: 'percentage', percentage: 2, vatIncluded: false },
  decidedAt: '2026-08-30T06:27:46.094Z',
  notifiedAt: null,
  viewedAt: null,
  consentNonce: null,
  expiresAt: '2027-04-30T23:59:59.999Z',
  agencyRevokedAt: null,
} as unknown as BrokeredListingMandate;

type Bundle = Record<string, unknown>;

function wordsForKey(bundle: Bundle, qualifiedKey: string): unknown {
  const path = qualifiedKey.includes(':') ? qualifiedKey.split(':')[1] : qualifiedKey;
  return path
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node !== null && typeof node === 'object' ? (node as Bundle)[part] : undefined,
      bundle,
    );
}

beforeEach(() => {
  agencyLookup = { state: 'absent' };
});

// ============================================================================
describe('Λ — το λεξιλόγιο του ιδιοκτήτη', () => {
  it('Λ-1 κάθε κατάσταση έχει κείμενο, σε el ΚΑΙ en', () => {
    expect(everyStandingNamedForOwner(MANDATE_STANDINGS)).toBe(true);

    for (const standing of MANDATE_STANDINGS) {
      const key = OWNER_STANDING_KEYS[standing];
      expect(wordsForKey(el as Bundle, key)).toEqual(expect.any(String));
      expect(wordsForKey(en as Bundle, key)).toEqual(expect.any(String));
    }
  });

  it('Λ-2 🔴 ρίζα ΕΝΙΚΟΣ `offer.mandate` — του γραφείου είναι `offer.mandates`', () => {
    // ΚΥΡΙΟΛΕΞΙΑ: η ρίζα είναι υπόσχεση προς τον τεμαχιστή και τη CHECK 3.8.
    expect(OWNER_MANDATE_KEYS.title).toBe('property-market:offer.mandate.title');
    expect(OWNER_STANDING_KEYS.live).toBe('property-market:offer.mandate.standing.live');
    expect(STANDING_LABEL_KEYS.live).toBe('property-market:offer.mandates.standing.live');
  });

  it('Λ-3 🔴🔴 ΔΥΟ ΟΠΤΙΚΕΣ: το ίδιο γεγονός, ΑΛΛΟ κείμενο για κάθε πλευρά', () => {
    // Αν τα δύο κείμενα ταυτίζονταν, ο πίνακας θα ήταν αντιγραφή — και ο ιδιοκτήτης
    // θα διάβαζε οδηγία γραμμένη για τον **μεσίτη** («δεν του το είπαμε ποτέ»).
    for (const standing of ['unannounced-live', 'awaiting-view'] as const) {
      const owner = wordsForKey(el as Bundle, OWNER_STANDING_KEYS[standing]);
      const agency = wordsForKey(el as Bundle, STANDING_LABEL_KEYS[standing]);
      expect(owner).toEqual(expect.any(String));
      expect(agency).toEqual(expect.any(String));
      expect(owner).not.toBe(agency);
    }
  });
});

// ============================================================================
describe('Ο — η οθόνη', () => {
  it('Ο-1 η ζωντανή εντολή ζωγραφίζεται ολόκληρη', () => {
    render(<OwnerMandatePanel views={ownerMandateViews({ mandate: LIVE_LEGACY }, NOW)} />);

    const panel = screen.getByRole('region');
    expect(panel).toHaveTextContent(OWNER_STANDING_KEYS['unannounced-live']);
    // 🔑 Η **αμοιβή** — ο εμπορικός όρος που το ADR-827 Α4/Α5 απαιτεί ορατό.
    expect(panel).toHaveTextContent(OWNER_MANDATE_KEYS.feeLabel);
    expect(panel).toHaveTextContent(OWNER_MANDATE_KEYS.periodLabel);
    // Η **απόδειξη**: «τη ζητήσατε εσείς», όχι απλώς «υπάρχει εντολή».
    expect(panel).toHaveTextContent(OWNER_PROOF_KEYS['owner-consent']);
    // Χωρίς `agencyCompanyId` στο έγγραφο: το λέει, δεν το κρύβει.
    expect(panel).toHaveTextContent(OWNER_MANDATE_KEYS.agencyUnknown);
  });

  it('Ο-2 🔴 ΚΑΝΕΝΑ ΚΑΝΑΛΙ ΕΠΙΚΟΙΝΩΝΙΑΣ (ADR-827 §9.8 — άρθρο 200 §1: εγγράφως)', () => {
    const { container } = render(
      <OwnerMandatePanel views={ownerMandateViews({ mandate: LIVE_LEGACY }, NOW)} />,
    );

    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('textarea')).toBeNull();
  });

  it('Ο-3 χωρίς εντολή ⇒ ΤΙΠΟΤΑ (καμία γραμμή «δεν έχετε μεσίτη»)', () => {
    const { container } = render(<OwnerMandatePanel views={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('Ο-4 με δημοσιευμένη βιτρίνα ⇒ Η ΕΠΩΝΥΜΙΑ, ποτέ η ταυτότητα του οργανισμού', () => {
    agencyLookup = { state: 'found', profile: { displayName: 'Μεσιτικό Παγώνης' } };
    const withAgency = { ...LIVE_LEGACY, agencyCompanyId: 'comp_9c7c1a50' } as BrokeredListingMandate;

    render(<OwnerMandatePanel views={ownerMandateViews({ mandate: withAgency }, NOW)} />);

    const panel = screen.getByRole('region');
    expect(panel).toHaveTextContent('Μεσιτικό Παγώνης');
    expect(panel).not.toHaveTextContent('comp_9c7c1a50');
  });
});

// ============================================================================
describe('Ρ — η ραφή: το πλαίσιο είναι ΠΡΑΓΜΑΤΙΚΑ προσαρτημένο', () => {
  /**
   * 🔶 **ΔΗΛΩΜΕΝΟ ΟΡΙΟ**: κρίνει **πηγή**. Το OwnerPropertyDetailContent σέρνει
   * useAuth, δρομολογητή, ζωντανό Firestore hook και route slice, και δεν αποδίδεται
   * φθηνά. Τη **συμπεριφορά** την κλειδώνουν τα Ο-*· αυτό φυλά ότι το πλαίσιο δεν
   * έμεινε **δυνατότητα σε unmounted container** — δηλαδή νεκρό.
   */
  it('Ρ-1 η σελίδα της αγγελίας υπολογίζει ΚΑΙ αποδίδει την ακμή', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/components/owner-property/OwnerPropertyDetailContent.tsx'),
      'utf8',
    );

    expect(source).toContain('ownerMandateViews(property, atISO)');
    expect(source).toContain('<OwnerMandatePanel views={mandateViews} />');
    // 🔴 ΕΝΑ ρολόι για όλη την όψη: δύο κλήσεις μπορούν να πέσουν σε άλλη μέρα.
    expect(source.split('nowISO()')).toHaveLength(2);
  });
});
