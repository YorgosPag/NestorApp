/**
 * @jest-environment node
 *
 * @fileoverview 🔴 **Η ΑΓΚΥΡΑ ΤΟΥ §9 #13 ΣΤΟΝ ΓΡΑΦΕΑ** — οι διοικητικές ταυτότητες
 *   γράφονται **όταν υπάρχουν**, και **ΔΕΝ** γράφονται όταν δεν κοιτάξαμε *(ADR-846
 *   §8.8.18)*.
 * @related services/mandate/showcase-presence.service · lib/agency/presence-admin-ids
 * @module services/mandate/__tests__/showcase-presence-admin-ids
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΞΕΧΩΡΙΣΤΑ — ΤΟ ΣΗΜΕΙΟ ΠΟΥ **ΚΑΝΕΙΣ ΤΥΠΟΣ ΔΕΝ ΦΥΛΑΕΙ**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Το `ref.update({ presence })` δέχεται **μερικό** αντικείμενο και **δεν** τυπίζεται
 * έναντι του `PublicShowcase`. Άρα μια παράλειψη του νέου πεδίου **δεν είναι σφάλμα
 * μεταγλώττισης** — είναι πεδίο που μένει **μπαγιάτικο για πάντα**, με όλα τα σήματα
 * πράσινα. Είναι **ακριβώς** ο ρητός κατασκευαστής που πέταγε το `interior` *(§8.8.17)*,
 * μία στρώση πιο πάνω.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🏆 ΚΑΙ ΔΙΑΒΑΖΕΙ ΤΑ **ΠΡΑΓΜΑΤΙΚΑ** ΔΕΔΟΜΕΝΑ ΤΟΥ ΔΙΣΚΟΥ
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Ο `server-only` αναγνώστης χρησιμοποιεί `node:fs` πάνω στο `public/data`, οπότε σε
 * περιβάλλον `node` τρέχει **αυτούσιος**. ⇒ Η Γ6 αποδεικνύει τη διαδρομή **από τη
 * γεωκωδικοποιημένη αγγελία μέχρι το αποθηκευμένο id**, χωρίς κανένα πλαστό δεδομένο —
 * το μόνο test που θα είχε πιάσει το ότι το `fetch('/data/…')` **δεν δουλεύει στο Node**.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { storedShowcaseDoc } from '@/lib/agency/__fixtures__/showcase-fixture';
import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { readAdminFootprints } from '@/services/places/admin-footprints.reader';
import { refreshShowcasePresence } from '../showcase-presence.service';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

jest.mock('@/services/places/admin-footprints.reader', () => ({
  readAdminFootprints: jest.fn(),
}));

const readFootprintsMock = readAdminFootprints as jest.MockedFunction<typeof readAdminFootprints>;
const realReader = jest.requireActual<typeof import('@/services/places/admin-footprints.reader')>(
  '@/services/places/admin-footprints.reader',
);

const COMPANY = 'comp_admin_ids';
const AT = '2026-09-09T00:00:00.000Z';

/** Πραγματική αγγελία — εντός ΔΗΜΟΥ ΘΕΣΣΑΛΟΝΙΚΗΣ *(ground truth §8.8.17)*. */
const DIAM_95 = { lat: 40.6306898, lng: 22.9468742 };

const MUNICIPALITY = 'municipality:0701';
const REGION = 'region:112';

function db(): { fake: FakeFirestore; admin: AdminFirestore } {
  const fake = new FakeFirestore();
  return { fake, admin: fake as unknown as AdminFirestore };
}

function listingDoc(id: string, point: { lat: number; lng: number }): Record<string, unknown> {
  return {
    ...listing({
      id,
      position: { kind: 'known', provenance: 'manual', point, locatedAt: AT },
      agencyId: COMPANY,
    }),
  } as unknown as Record<string, unknown>;
}

/** ⚠️ Διαβάζει το **έγγραφο**, ποτέ την επιστρεφόμενη τιμή του γραφέα. */
function storedShowcase(fake: FakeFirestore): Record<string, unknown> | undefined {
  return fake.all<Record<string, unknown>>(COLLECTIONS.AGENCY_PROFILES)[0];
}

beforeEach(() => {
  readFootprintsMock.mockReset();
});

describe('Γ 🏆 — οι διοικητικές ταυτότητες της αποδεδειγμένης παρουσίας', () => {
  it('🔴 Γ6 — ΑΠΟ ΤΗΝ ΑΓΓΕΛΙΑ ΣΤΟ ΑΠΟΘΗΚΕΥΜΕΝΟ id, με ΠΡΑΓΜΑΤΙΚΑ αποτυπώματα', async () => {
    readFootprintsMock.mockImplementation(realReader.readAdminFootprints);

    const { fake, admin } = db();
    fake.seed(COLLECTIONS.AGENCY_PROFILES, COMPANY, storedShowcaseDoc({ companyId: COMPANY }));
    fake.seed(COLLECTIONS.PUBLIC_LISTINGS, 'prop_a', listingDoc('prop_a', DIAM_95));

    await refreshShowcasePresence(admin, COMPANY);

    // 🔑 **Το βαθύτερο κελί, όχι η περιφέρεια** — η περιφέρεια βγαίνει από τη γενεαλογία.
    expect(storedShowcase(fake)?.presenceAdminIds).toEqual([MUNICIPALITY]);
    // …και ο **παρονομαστής**: το `region:112` **δεν** γράφεται, γιατί δεν χρειάζεται.
    expect(storedShowcase(fake)?.presenceAdminIds).not.toContain(REGION);
  });

  it('🔴🔴 Γ7 — ΔΕΝ ΔΙΑΒΑΣΤΗΚΑΝ ΤΑ ΑΠΟΤΥΠΩΜΑΤΑ ⇒ ΤΟ ΠΕΔΙΟ ΜΕΝΕΙ ΩΣ ΕΙΧΕ', async () => {
    // ⚠️ **Η κρίσιμη διάκριση**: `[]` σημαίνει *«καμία απόδειξη»* — γεγονός για τον
    //    **επαγγελματία**. Το «δεν διάβασα το αρχείο» είναι βλάβη **δική μας**. Αν τα δύο
    //    συγχέονταν, μια αποτυχία ανάγνωσης θα **έσβηνε** την απόδειξη κάθε γραφείου που
    //    τυχαίνει να ξαναδημοσιεύσει όσο η βλάβη διαρκεί — σιωπηλά και μόνιμα.
    readFootprintsMock.mockResolvedValue(null);

    const { fake, admin } = db();
    fake.seed(COLLECTIONS.AGENCY_PROFILES, COMPANY, {
      ...storedShowcaseDoc({ companyId: COMPANY }),
      presenceAdminIds: [MUNICIPALITY],
    });
    fake.seed(COLLECTIONS.PUBLIC_LISTINGS, 'prop_a', listingDoc('prop_a', DIAM_95));

    await refreshShowcasePresence(admin, COMPANY);

    // Το **γεωμετρικό** πεδίο ενημερώθηκε κανονικά…
    expect(storedShowcase(fake)?.presence).toEqual([{ center: DIAM_95, radiusKm: 0 }]);
    // …και το διοικητικό **επιβίωσε**: μπαγιάτικο, αλλά **αληθινό**.
    expect(storedShowcase(fake)?.presenceAdminIds).toEqual([MUNICIPALITY]);
  });

  it('🔴 Γ8 — ΑΠΟΣΥΡΣΗ: χωρίς αγγελίες οι ταυτότητες ΑΔΕΙΑΖΟΥΝ (και ΔΕΝ μένουν)', async () => {
    // Ο παρονομαστής της Γ7: χωρίς αυτό, ένα «μην γράφεις ποτέ» θα την άφηνε πράσινη
    // και το πεδίο θα κρατούσε ισχυρισμό για γραφείο που **ξεπούλησε**.
    readFootprintsMock.mockImplementation(realReader.readAdminFootprints);

    const { fake, admin } = db();
    fake.seed(COLLECTIONS.AGENCY_PROFILES, COMPANY, {
      ...storedShowcaseDoc({ companyId: COMPANY }),
      presenceAdminIds: [MUNICIPALITY],
    });

    await refreshShowcasePresence(admin, COMPANY);

    expect(storedShowcase(fake)?.presenceAdminIds).toEqual([]);
  });
});
