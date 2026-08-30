/**
 * @jest-environment node
 *
 * @fileoverview **Η ΛΗΞΗ** — οι άγκυρες του σαρωτή (§8.33, Στάδιο 5).
 * @related services/mandate/mandate-expiry.service.ts
 *
 * 🔴 **Η ΚΕΝΤΡΙΚΗ ΑΓΚΥΡΑ ΕΙΝΑΙ Η `Λ2`**: μια αγγελία που ήταν **ζωντανή στον χάρτη**
 * και της οποίας η εντολή έληξε **χωρίς να την αγγίξει κανείς** — φεύγει. Χωρίς αυτήν,
 * η «λήξη» θα ήταν ιδιότητα που ισχύει μόνο για όποιον τύχει να ξαναπατήσει
 * «αποθήκευση», δηλαδή για κανέναν.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import {
  brokeredMandate,
  brokeredOwnerProperty,
  validOwnerProperty,
} from '@/lib/owner-property/__tests__/owner-property-fixtures';
import { retireExpiredMandates } from '@/services/mandate/mandate-expiry.service';
import { setOwnerPropertyMandate } from '@/services/owner-property/owner-property-write.service';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import type { OwnerProperty } from '@/types/owner-property';

const PAST = '2020-01-01T00:00:00.000Z';
const FUTURE = '2099-01-01T00:00:00.000Z';

function dbWith(...properties: readonly OwnerProperty[]): AdminFirestore {
  const fake = new FakeFirestore();
  for (const property of properties) {
    fake.seed(COLLECTIONS.OWNER_PROPERTIES, property.id, property);
  }
  return fake as unknown as AdminFirestore;
}

async function isPublished(db: AdminFirestore, id: string): Promise<boolean> {
  const snap = await db.collection(COLLECTIONS.PUBLIC_LISTINGS).doc(id).get();
  return snap.exists;
}

describe('🔴 Λ — η ληγμένη εντολή κατεβάζει την αγγελία, και ΤΙΠΟΤΑ δεν σβήνεται', () => {
  it('🔑 Λ1 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: το ερώτημα βρίσκει ΜΟΝΟ ληγμένες εντολές μεσιτών', async () => {
    const db = dbWith(
      validOwnerProperty({ id: 'ownp_idiotis' }),
      brokeredOwnerProperty({ confirmation: 'confirmed', expiresAt: FUTURE }, { id: 'ownp_zontani' }),
      brokeredOwnerProperty({ confirmation: 'confirmed', expiresAt: PAST }, { id: 'ownp_ligmeni' }),
    );

    const report = await retireExpiredMandates(db);

    // Ο ιδιώτης **δεν έχει καν το πεδίο** ⇒ το Firestore τον αποκλείει από ερώτημα
    // ανισότητας. Η ζωντανή εντολή αποκλείεται από την ίδια την ανισότητα.
    expect(report.considered).toBe(1);
  });

  it('🔴 Λ2 — αγγελία ΖΩΝΤΑΝΗ στον χάρτη που έληξε ΧΩΡΙΣ να την αγγίξει κανείς: φεύγει', async () => {
    // Ο παρονομαστής χτίζεται **πραγματικά**: η αγγελία δημοσιεύεται όσο η εντολή
    // ισχύει, και μόνο μετά μετακινείται η λήξη στο παρελθόν.
    const live = brokeredOwnerProperty({ confirmation: 'confirmed', expiresAt: FUTURE });
    const db = dbWith(live);
    await setOwnerPropertyMandate(db, live.id, live.mandates[0]!);
    expect(await isPublished(db, live.id)).toBe(true);

    const expired = brokeredOwnerProperty({ confirmation: 'confirmed', expiresAt: PAST });
    const db2 = dbWith(expired);
    await db2.collection(COLLECTIONS.PUBLIC_LISTINGS).doc(expired.id).set({ id: expired.id });

    await retireExpiredMandates(db2);
    expect(await isPublished(db2, expired.id)).toBe(false);
  });

  it('🔑 Λ3 — το ΕΓΓΡΑΦΟ του γραφείου μένει ΑΚΕΡΑΙΟ: λήγει, δεν αποσύρεται', async () => {
    const expired = brokeredOwnerProperty({ confirmation: 'confirmed', expiresAt: PAST });
    const db = dbWith(expired);

    await retireExpiredMandates(db);

    const snap = await db.collection(COLLECTIONS.OWNER_PROPERTIES).doc(expired.id).get();
    const after = snap.data() as OwnerProperty;
    // ⚠️ ΟΧΙ `withdrawn`: «αποσύρθηκε» σημαίνει ότι το αποφάσισε άνθρωπος.
    expect(after.lifecycle).toBe('listed');
    expect(after.offers).toHaveLength(1);
    expect(after.mandates[0] !== undefined && after.mandates[0]?.confirmation).toBe('confirmed');
  });

  it('Λ4 — idempotent: δεύτερο πέρασμα δεν αλλάζει τίποτα ορατό', async () => {
    const expired = brokeredOwnerProperty({ confirmation: 'confirmed', expiresAt: PAST });
    const db = dbWith(expired);

    const first = await retireExpiredMandates(db);
    await retireExpiredMandates(db);

    expect(first.considered).toBe(1);
    // ⚠️ **Το ΟΡΑΤΟ είναι αυτό** — η αγγελία μένει εκτός χάρτη, όσες φορές κι αν
    //    περάσει ο σαρωτής. Δες την Λ6 για το γιατί το `considered` **δεν** είναι.
    expect(await isPublished(db, expired.id)).toBe(false);
  });

  it('🔴 Λ6 — Ο ΣΑΡΩΤΗΣ ΤΕΡΜΑΤΙΖΕΙ: το ίδιο έγγραφο δεν ξαναπληρώνεται (ADR-832)', async () => {
    // 🔴 **ΑΥΤΗ Η ΑΓΚΥΡΑ ΑΝΤΙΣΤΡΕΦΕΙ ΜΙΑ ΠΡΟΗΓΟΥΜΕΝΗ ΠΡΟΣΔΟΚΙΑ, ΚΑΙ ΕΠΙΤΗΔΕΣ.** Η Λ4
    //    απαιτούσε `second.considered === 1` — δηλαδή **απαιτούσε** από τον σαρωτή να
    //    ξαναφέρνει το ίδιο έγγραφο σε **κάθε** πέρασμα, για πάντα. Με ενικό πεδίο
    //    ήταν αθώο (τίποτα δεν κρατούσε τη θέση)· με το **ευρετήριο** του ADR-832
    //    είναι κόστος που μεγαλώνει μονότονα: κάθε ακίνητο που έληξε ποτέ πληρώνεται
    //    ξανά, σε κάθε πέρασμα, μέχρι το `SCAN_LIMIT` να γεμίσει με **νεκρούς** και
    //    οι πραγματικά ληγμένες να μη χωρέσουν ποτέ.
    //
    // 🔑 Η ιδεμποτησία **δεν** είναι «ίδιοι αριθμοί» — είναι «ίδιο αποτέλεσμα». Το
    //    `considered` είναι **κόστος**, όχι αποτέλεσμα.
    const expired = brokeredOwnerProperty({ confirmation: 'confirmed', expiresAt: PAST });
    const db = dbWith(expired);

    await retireExpiredMandates(db);
    const second = await retireExpiredMandates(db);

    expect(second.considered).toBe(0);
    expect(second.retired).toBe(0);
  });

  it('🔑 Λ7 — ΔΥΟ εντολές, ΔΥΟ λήξεις: το ευρετήριο δείχνει στην ΕΠΟΜΕΝΗ, όχι σε καμία', async () => {
    // 🔑 Ο πληθυντικός γεννά ερώτημα που ο ενικός δεν είχε: όταν λήξει η **πρώτη**,
    //    το έγγραφο πρέπει να ξαναβρεθεί όταν λήξει και η **δεύτερη**. Ένα `null`
    //    εδώ θα το έβγαζε από το ερώτημα **οριστικά** — και η δεύτερη εντολή θα
    //    έμενε στον χάρτη για πάντα, σιωπηλά.
    const mid = '2030-01-01T00:00:00.000Z';
    const property = brokeredOwnerProperty(
      { confirmation: 'confirmed', expiresAt: PAST },
      {
        mandates: [
          brokeredMandate({ confirmation: 'confirmed', expiresAt: PAST, agencyCompanyId: 'comp_alfa' }),
          brokeredMandate({ confirmation: 'confirmed', expiresAt: mid, agencyCompanyId: 'comp_alfa' }),
        ],
        mandatesExpireAt: PAST,
      },
    );
    const db = dbWith(property);

    await retireExpiredMandates(db);

    const snap = await db.collection(COLLECTIONS.OWNER_PROPERTIES).doc(property.id).get();
    expect((snap.data() as OwnerProperty).mandatesExpireAt).toBe(mid);
  });

  it('Λ5 — η λογιστική εκπέμπεται ΚΑΙ ΟΤΑΝ ΕΙΝΑΙ ΜΗΔΕΝ', async () => {
    const report = await retireExpiredMandates(dbWith(validOwnerProperty()));
    expect(report).toEqual({
      considered: 0,
      retired: 0,
      alreadyOff: 0,
      failed: 0,
      truncated: false,
    });
  });
});
