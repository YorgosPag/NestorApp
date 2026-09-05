/**
 * @fileoverview **Ο ΣΑΡΩΤΗΣ ΛΗΞΗΣ ΤΡΕΧΕΙ** — και σβήνει ΜΟΝΟ ό,τι πέρασε η ώρα του.
 * @related services/contact/first-contact-invitation-expiry.service.ts · ADR-844 Β6
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ΕΙΝΑΙ ΚΩΔΙΚΑΣ ΠΟΥ **ΔΙΑΓΡΑΦΕΙ**, ΚΑΙ ΤΡΕΧΕΙ ΧΩΡΙΣ ΜΑΡΤΥΡΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Τρέχει στις 03:45, μία φορά τη μέρα, με ταυτότητα μηχανής→μηχανής, πάνω σε συλλογή
 * που **κανείς δεν διαβάζει** (`read: if false`). Αν το φίλτρο του γυρίσει ανάποδα, θα
 * σβήσει **ζωντανές** προσκλήσεις: ο άνθρωπος που περιμένει το email του δεν θα μάθει
 * ποτέ γιατί ο σύνδεσμος λέει *«δεν βρήκαμε αυτή την πρόσκληση»*.
 *
 * ⚠️ **Ούτε μία γραμμή αναφοράς δεν θα κοκκίνιζε**: η αναφορά θα έλεγε
 * `deleted 500` — αριθμός που φαίνεται **επιτυχία**.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { purgeExpiredInvitations } from '@/services/contact/first-contact-invitation-expiry.service';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

const NOW = '2026-09-12T10:00:00.000Z';

function freshDb(): AdminFirestore {
  return new FakeFirestore() as unknown as AdminFirestore;
}

/** Γράφει πρόσκληση με **δηλωμένη** λήξη — μόνο ό,τι κοιτάζει ο σαρωτής. */
async function seed(
  db: AdminFirestore,
  id: string,
  expiresAt: string,
  state = 'sent',
): Promise<void> {
  await db.collection(COLLECTIONS.FIRST_CONTACT_INVITATIONS).doc(id).set({
    id,
    channelEmail: 'maria@example.com',
    state,
    expiresAt,
  });
}

async function survivingIds(db: AdminFirestore): Promise<string[]> {
  const snap = await db.collection(COLLECTIONS.FIRST_CONTACT_INVITATIONS).get();
  return snap.docs.map((doc) => doc.id).sort();
}

describe('Λ — τι σβήνεται', () => {
  it('🔴 Λ1 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η ΖΩΝΤΑΝΗ πρόσκληση ΕΠΙΒΙΩΝΕΙ', async () => {
    // 🔴 **Το πρώτο σκέλος, και το μόνο που πονάει αν σπάσει.** Ένα φίλτρο γυρισμένο
    //    ανάποδα (`>=` αντί για `<=`) σβήνει **ακριβώς** τις προσκλήσεις που κάποιος
    //    περιμένει αυτή τη στιγμή — και η αναφορά θα έλεγε «deleted 500», δηλαδή
    //    **επιτυχία**.
    const db = freshDb();
    await seed(db, 'fcin_live', '2026-09-19T10:00:00.000Z');

    const report = await purgeExpiredInvitations(db, NOW);

    expect(report).toEqual({ considered: 0, deleted: 0, failed: 0, truncated: false });
    expect(await survivingIds(db)).toEqual(['fcin_live']);
  });

  it('🔑 Λ2 — η ΛΗΓΜΕΝΗ φεύγει', async () => {
    const db = freshDb();
    await seed(db, 'fcin_old', '2026-09-05T10:00:00.000Z');

    const report = await purgeExpiredInvitations(db, NOW);

    expect(report).toEqual({ considered: 1, deleted: 1, failed: 0, truncated: false });
    expect(await survivingIds(db)).toEqual([]);
  });

  it('🔑 Λ3 — το ΑΚΡΙΒΩΣ ΤΩΡΑ φεύγει (`<=`, όχι `<`)', async () => {
    // ⚠️ Η ώρα λήξης **έχει περάσει** τη στιγμή που ισούται με το τώρα: το
    //    `claimInvitation` ήδη την αρνείται. Ένα `<` θα άφηνε το έγγραφο να ζει μία
    //    ακόμη μέρα χωρίς να μπορεί να χρησιμοποιηθεί από κανέναν.
    const db = freshDb();
    await seed(db, 'fcin_edge', NOW);

    expect((await purgeExpiredInvitations(db, NOW)).deleted).toBe(1);
  });

  it('🔴 Λ4 — φεύγουν ΚΑΙ οι εξαργυρωμένες: η πράξη ζει αλλού, εδώ μένει σκαλωσιά', async () => {
    // 🔑 Ο πειρασμός είναι `.where('state','==','sent')` — που θα ζητούσε **σύνθετο
    //    ευρετήριο** (ισότητα + ανισότητα) και θα ήταν **λάθος**: ακριβώς οι υπόλοιπες
    //    καταστάσεις κρατούν όνομα, email και τηλέφωνο χωρίς κανέναν αναγνώστη.
    const db = freshDb();
    await seed(db, 'fcin_redeemed', '2026-09-01T10:00:00.000Z', 'redeemed');
    await seed(db, 'fcin_superseded', '2026-09-02T10:00:00.000Z', 'superseded');

    expect((await purgeExpiredInvitations(db, NOW)).deleted).toBe(2);
    expect(await survivingIds(db)).toEqual([]);
  });

  it('🔑 Λ5 — μικτό σύνολο: φεύγει ΜΟΝΟ η ληγμένη', async () => {
    const db = freshDb();
    await seed(db, 'fcin_old', '2026-09-01T10:00:00.000Z');
    await seed(db, 'fcin_live', '2026-09-30T10:00:00.000Z');

    await purgeExpiredInvitations(db, NOW);

    expect(await survivingIds(db)).toEqual(['fcin_live']);
  });
});

describe('Μ — το πέρασμα λέει την αλήθεια για τον εαυτό του', () => {
  it('🔴 Μ1 — ΙΔΕΜΠΟΤΟ: δεύτερο πέρασμα βρίσκει μηδέν', async () => {
    const db = freshDb();
    await seed(db, 'fcin_old', '2026-09-01T10:00:00.000Z');

    await purgeExpiredInvitations(db, NOW);
    const second = await purgeExpiredInvitations(db, NOW);

    expect(second).toEqual({ considered: 0, deleted: 0, failed: 0, truncated: false });
  });

  it('🔑 Μ2 — μηδέν έγγραφα ⇒ αναφορά με ΜΗΔΕΝΙΚΑ, ποτέ σιωπή', async () => {
    // ⚠️ «Δεν έληξε τίποτα» και «δεν κοίταξε κανείς» διαβάζονται **ίδια** όταν ο κάδος
    //    λείπει. Η αναφορά εκπέμπει κάθε κάδο, **και όταν είναι μηδέν**.
    const report = await purgeExpiredInvitations(freshDb(), NOW);

    expect(report).toEqual({ considered: 0, deleted: 0, failed: 0, truncated: false });
  });
});
