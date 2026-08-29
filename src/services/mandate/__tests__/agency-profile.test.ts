/**
 * @jest-environment node
 *
 * @fileoverview **Η ΒΙΤΡΙΝΑ ΤΟΥ ΓΡΑΦΕΙΟΥ** — οι άγκυρες του ADR-827 §9.10.
 * @related services/mandate/agency-profile.service.ts
 *
 * 🔴 **Τι φυλά αυτό το αρχείο**: ο κατάλογος γραφείων είναι η **μόνη** σαρώσιμη
 * συλλογή του έργου που περιέχει **οργανισμούς**, και η άδειά της στηρίζεται σε ένα
 * μόνο πράγμα — ότι ο **πληθυσμός** της είναι opt-in. Αν η δημοσίευση μπορούσε να
 * συμβεί χωρίς πράξη του γραφείου, ή αν γραφόταν άλλο `companyId` από αυτό που
 * κρίθηκε, η άδεια θα έπεφτε **χωρίς να το πάρει κανείς είδηση**.
 *
 * ⚠️ **Η βάση δεν πλάθεται.** Ο γραφέας τρέχει **αληθινά** πάνω σε `FakeFirestore` —
 * ένα test που έπλαθε το `set()` θα αποδείκνυε ότι ο κώδικας καλεί ό,τι νομίζουμε,
 * όχι ότι **γράφεται** ό,τι θέλουμε.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { requireBrokerageCapability, isBrokerageDenial } from '@/lib/auth/brokerage-authority';
import type { BrokerageAuthority } from '@/lib/auth/brokerage-authority';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import type { OrganizationCapabilities } from '@/types/organization-capability';
import {
  publishAgencyProfile,
  withdrawAgencyProfile,
  lookupAgencyProfile,
  type AgencyProfileDeclaration,
} from '@/services/mandate/agency-profile.service';
import type { AgencyProfile } from '@/types/agency-profile';

const COMPANY = 'comp_grafeio_a';

const ACTIVE: OrganizationCapabilities = {
  brokerage_listings: {
    status: 'active',
    requirements: [],
    declaration: null,
    decidedByUserId: 'user-super',
    decidedAt: '2026-08-20T10:00:00.000Z',
    revocationReason: null,
  },
};

function authorityFor(companyId: string): BrokerageAuthority {
  const verdict = requireBrokerageCapability(companyId, ACTIVE);
  if (isBrokerageDenial(verdict)) throw new Error('το fixture οφείλει να είναι ενεργό');
  return verdict;
}

const DECLARATION: AgencyProfileDeclaration = {
  alias: 'mesitiko-pagoni',
  displayName: 'ΜΕΣΙΤΙΚΟ ΓΡΑΦΕΙΟ ΠΑΓΩΝΗ Ι.Κ.Ε.',
  gemiNumber: '123456789000',
  place: null,
};

function db(): { fake: FakeFirestore; admin: AdminFirestore } {
  const fake = new FakeFirestore();
  return { fake, admin: fake as unknown as AdminFirestore };
}

async function readProfile(
  fake: FakeFirestore,
  companyId: string,
): Promise<AgencyProfile | undefined> {
  const snap = await fake.collection(COLLECTIONS.AGENCY_PROFILES).doc(companyId).get();
  return snap.exists ? (snap.data() as AgencyProfile) : undefined;
}

// ============================================================================
// Π — ΤΑ ΔΥΟ ΑΜΕΤΑΒΛΗΤΑ ΤΟΥ ΓΡΑΦΕΑ
// ============================================================================

describe('Π — η δημοσίευση είναι πράξη ΤΟΥ ΓΡΑΦΕΙΟΥ, με απόδειξη', () => {
  it('🔑 Π0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: έγκυρη δήλωση με ενεργή ικανότητα ΔΗΜΟΣΙΕΥΕΤΑΙ', async () => {
    const { fake, admin } = db();

    const result = await publishAgencyProfile(admin, authorityFor(COMPANY), DECLARATION);

    expect(result.kind).toBe('published');
    const stored = await readProfile(fake, COMPANY);
    expect(stored?.displayName).toBe(DECLARATION.displayName);
    expect(stored?.gemiNumber).toBe(DECLARATION.gemiNumber);
  });

  it('🔴 Π1 — ΤΟ `companyId` ΕΡΧΕΤΑΙ ΑΠΟ ΤΗΝ ΑΠΟΔΕΙΞΗ, ποτέ από όρισμα', async () => {
    const { fake, admin } = db();

    // Η δήλωση **δεν έχει** πεδίο `companyId` — δομικά. Το κλειδί και το πεδίο
    // προκύπτουν και τα δύο από τον κριτή, άρα είναι ΑΔΥΝΑΤΟ να κριθεί ο ένας
    // οργανισμός και να γραφτεί ο άλλος (ADR-824 §6).
    await publishAgencyProfile(admin, authorityFor('comp_krithike'), DECLARATION);

    expect(await readProfile(fake, 'comp_krithike')).toBeDefined();
    expect((await readProfile(fake, 'comp_krithike'))?.companyId).toBe('comp_krithike');
    expect(await readProfile(fake, COMPANY)).toBeUndefined();
  });

  it('🔴 Π1β — ΓΡΑΦΕΙΟ ΧΩΡΙΣ ΕΝΕΡΓΗ ΙΚΑΝΟΤΗΤΑ ΔΕΝ ΜΠΟΡΕΙ ΚΑΝ ΝΑ ΚΑΤΑΣΚΕΥΑΣΕΙ ΑΠΟΔΕΙΞΗ', () => {
    // Ο φρουρός δεν είναι `if` μέσα στον γραφέα — είναι ο ΤΥΠΟΣ. Και οι τρεις
    // αρνητικές καταστάσεις αρνούνται, **με λόγο**.
    for (const status of ['unrequested', 'pending', 'revoked'] as const) {
      const capabilities: OrganizationCapabilities = {
        brokerage_listings: {
          status,
          requirements: [],
          declaration: null,
          decidedByUserId: null,
          decidedAt: null,
          revocationReason: null,
        },
      };
      const verdict = requireBrokerageCapability(COMPANY, capabilities);
      expect(isBrokerageDenial(verdict)).toBe(true);
      if (isBrokerageDenial(verdict)) expect(verdict.reason).not.toBe('');
    }
  });

  it('🔴 Π2 — Η ΑΠΟΣΥΡΣΗ ΕΙΝΑΙ ΔΙΑΓΡΑΦΗ, ΟΧΙ ΣΗΜΑΙΑ', async () => {
    const { fake, admin } = db();
    await publishAgencyProfile(admin, authorityFor(COMPANY), DECLARATION);
    expect(await readProfile(fake, COMPANY)).toBeDefined();

    const result = await withdrawAgencyProfile(admin, COMPANY);

    expect(result.kind).toBe('withdrawn');
    // Δεν μένει έγγραφο με `isPublished: false` — δεν υπάρχει τέτοιο πεδίο, και
    // δεν πρέπει να υπάρξει ποτέ (ADR-749: σημαία που διαφωνεί με την ύπαρξη).
    expect(await readProfile(fake, COMPANY)).toBeUndefined();
  });

  it('🔑 Π2β — η απόσυρση ΔΕΝ απαιτεί απόδειξη: τρέχει ΑΚΡΙΒΩΣ όταν η ικανότητα χάθηκε', async () => {
    const { admin } = db();

    // Ανακληθέν γραφείο **δεν μπορεί** να κατασκευάσει `BrokerageAuthority`. Αν η
    // απόσυρση την απαιτούσε, το Π2 θα ήταν **ανεκτέλεστο** — φρουρός που κάνει τη
    // θεραπεία αδύνατη (πρότυπο `provisionWorkspace`, ADR-787 §5.1).
    const result = await withdrawAgencyProfile(admin, 'comp_pote_den_dimosieftike');
    expect(result.kind).toBe('withdrawn');
  });
});

// ============================================================================
// Δ — Η ΔΗΛΩΣΗ
// ============================================================================

describe('Δ — τι αρνείται η δήλωση, και με ποιον λόγο', () => {
  it('🔑 Δ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η πλήρης δήλωση δεν απορρίπτεται', async () => {
    const { admin } = db();
    const result = await publishAgencyProfile(admin, authorityFor(COMPANY), DECLARATION);
    expect(result.kind).toBe('published');
  });

  it('Δ1 — κάθε λείπον πεδίο έχει ΔΙΚΟ ΤΟΥ κλειδί — άρνηση χωρίς λόγο δεν εξηγείται', async () => {
    const cases = [
      [{ ...DECLARATION, alias: '   ' }, 'agency-profile-alias-missing'],
      [{ ...DECLARATION, displayName: '' }, 'agency-profile-name-missing'],
      [{ ...DECLARATION, gemiNumber: '  ' }, 'agency-profile-gemi-missing'],
    ] as const;

    for (const [declaration, reason] of cases) {
      const { fake, admin } = db();
      const result = await publishAgencyProfile(admin, authorityFor(COMPANY), declaration);

      expect(result.kind).toBe('rejected');
      if (result.kind === 'rejected') expect(result.reason).toBe(reason);
      // 🔴 Και **τίποτα δεν γράφτηκε**: απόρριψη που αφήνει μισό έγγραφο στον
      //    κατάλογο θα δημοσίευε γραφείο που ο κριτής απέρριψε.
      expect(await readProfile(fake, COMPANY)).toBeUndefined();
    }
  });

  it('🔴 Δ2 — ΤΟ ΓΕΜΗ ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΟ: χωρίς αυτό ο κατάλογος είναι «ονόματα που ισχυρίζονται»', async () => {
    const { admin } = db();
    const result = await publishAgencyProfile(
      admin,
      authorityFor(COMPANY),
      { ...DECLARATION, gemiNumber: '' },
    );
    expect(result.kind).toBe('rejected');
  });
});

// ============================================================================
// Σ — Η ΣΥΓΚΑΛΥΨΗ (§9.4)
// ============================================================================

describe('Σ — η απουσία από την προβολή είναι ΑΔΙΑΚΡΙΤΗ από την ανυπαρξία', () => {
  it('🔑 Σ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: δημοσιευμένο γραφείο ΒΡΙΣΚΕΤΑΙ', async () => {
    const { admin } = db();
    await publishAgencyProfile(admin, authorityFor(COMPANY), DECLARATION);

    const lookup = await lookupAgencyProfile(admin, COMPANY);
    expect(lookup.outcome).toBe('found');
  });

  it('🔴 Σ1 — υπαρκτός μισθωτής ΧΩΡΙΣ δημοσίευση απαντά ΤΑΥΤΟΣΗΜΑ με ανύπαρκτο', async () => {
    const { admin } = db();
    await publishAgencyProfile(admin, authorityFor(COMPANY), DECLARATION);

    const existingTenant = await lookupAgencyProfile(admin, 'comp_yparktos_adimosieftos');
    const neverExisted = await lookupAgencyProfile(admin, 'comp_pote_den_yprxe');

    // 🔴 Η ΙΣΟΤΗΤΑ ΕΙΝΑΙ Η ΕΓΓΥΗΣΗ (ADR-787 Ε-5 §4 #1): αν οι δύο απαντήσεις
    //    μπορούσαν να διαφέρουν, η διεύθυνση θα γινόταν όργανο απαρίθμησης.
    expect(existingTenant).toEqual(neverExisted);
    expect(existingTenant.outcome).toBe('not-published');
  });

  it('🔴 Σ2 — ΑΓΝΩΣΤΟ ≠ ΚΕΝΟ: η βλάβη ΔΕΝ διαβάζεται ως απόσυρση', async () => {
    const broken = {
      collection: () => ({
        doc: () => ({
          get: async () => {
            throw new Error('FAILED_PRECONDITION');
          },
        }),
      }),
    } as unknown as AdminFirestore;

    const lookup = await lookupAgencyProfile(broken, COMPANY);

    expect(lookup.outcome).toBe('unavailable');
    expect(lookup.outcome).not.toBe('not-published');
  });

  it('Σ3 — κενό αναγνωριστικό ΔΕΝ αγγίζει τη βάση', async () => {
    let touched = false;
    const spy = {
      collection: () => {
        touched = true;
        return { doc: () => ({ get: async () => ({ exists: false }) }) };
      },
    } as unknown as AdminFirestore;

    const lookup = await lookupAgencyProfile(spy, '   ');

    expect(lookup.outcome).toBe('not-published');
    expect(touched).toBe(false);
  });
});
