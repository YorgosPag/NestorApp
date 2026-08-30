/**
 * @jest-environment node
 *
 * @fileoverview **Η ΔΕΥΤΕΡΗ ΠΟΡΤΑ ΚΡΙΝΕΙ** — και κρίνει ό,τι **αλλάζει** (ADR-827 §8.9 α).
 * @related services/owner-property/owner-property-write.service.ts · types/owner-property-mandate.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΚΛΕΙΝΕΙ ΑΥΤΗ Η ΣΟΥΙΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ως τις 2026-08-29 το `setOwnerPropertyMandate` ήταν ο δηλωμένος **μοναδικός γραφέας
 * του `mandate`** και **δεν έκρινε τίποτα**: έγραφε ό,τι του δώσουν. Η κρίση ζούσε
 * μόνο στο `createOwnerProperty`, δηλαδή **μόνο στη γέννηση αγγελίας**.
 *
 * ⚠️ Η **Φάση Β** του ADR-827 (μετάβαση `self → brokered` σε **υπάρχουσα** αγγελία)
 * περνά από **εδώ**. Χωρίς αυτή τη σουίτα, ο φρουρός `mandate-term-exceeds-statute`
 * θα ήταν γραμμένος στη **μία** από τις δύο διαδρομές — αδρανής φρουρός (ADR-749 §5).
 *
 * 🔑 **Και η δεύτερη μισή απόδειξη είναι εξίσου κρίσιμη**: ο σαρωτής λήξης ξαναγράφει
 * **ληγμένες** εντολές αυτούσιες. Αν κρίναμε κάθε γραφή, θα κοκκίνιζε στο
 * `mandate-expiry-past` και οι ληγμένες αγγελίες θα **έμεναν δημοσιευμένες** —
 * χειρότερο από το πρόβλημα που λύνουμε. Η `Θ4` το κλειδώνει.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { brokeredOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { setOwnerPropertyMandate } from '@/services/owner-property/owner-property-write.service';
import { OPEN_LISTING } from '@/types/listing-agreement';
import type { OwnerProperty } from '@/types/owner-property';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

/** Πολύ μακριά για **αποκλειστική** (8 μήνες), νόμιμο για καμία εντολή αυτού του τύπου. */
const TOO_FAR = '2099-01-01T00:00:00.000Z';
const PAST = '2020-01-01T00:00:00.000Z';

function dbWith(property: OwnerProperty): AdminFirestore {
  const fake = new FakeFirestore();
  fake.seed(COLLECTIONS.OWNER_PROPERTIES, property.id, property);
  return fake as unknown as AdminFirestore;
}

describe('🔴 Θ — η πόρτα της εντολής κρίνει ό,τι ΑΛΛΑΖΕΙ', () => {
  it('🔑 Θ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: νόμιμη αλλαγή όρων ΓΡΑΦΕΤΑΙ', async () => {
    // Χωρίς αυτό, μια πόρτα που απορρίπτει **τα πάντα** θα περνούσε κάθε άλλη άγκυρα.
    const existing = brokeredOwnerProperty();
    const db = dbWith(existing);

    const result = await setOwnerPropertyMandate(db, existing.id, {
      ...existing.mandates[0]!,
      expiresAt: '2026-12-01T00:00:00.000Z',
    });

    expect(result.kind).toBe('saved');
  });

  it('🔴 Θ1 — ΑΠΟΚΛΕΙΣΤΙΚΗ πέρα από το νόμιμο όριο ΑΠΟΡΡΙΠΤΕΤΑΙ (ήταν σιωπηλά δεκτή)', async () => {
    const existing = brokeredOwnerProperty();
    const db = dbWith(existing);

    const result = await setOwnerPropertyMandate(db, existing.id, {
      ...existing.mandates[0]!,
      expiresAt: TOO_FAR,
    });

    expect(result.kind).toBe('invalid-mandate');
    if (result.kind === 'invalid-mandate') {
      expect(result.violations).toContain('mandate-term-exceeds-statute');
    }
  });

  it('Θ2 — η ΙΔΙΑ διάρκεια με ΑΠΛΗ εντολή περνά: το είδος ορίζει το όριο', async () => {
    const existing = brokeredOwnerProperty();
    const db = dbWith(existing);

    const result = await setOwnerPropertyMandate(db, existing.id, {
      ...existing.mandates[0]!,
      agreement: OPEN_LISTING,
      expiresAt: '2027-06-01T00:00:00.000Z',
    });

    expect(result.kind).toBe('saved');
  });

  it('🔴 Θ3 — αλλαγή ΜΟΝΟ του είδους κρίνεται: η ίδια λήξη γίνεται παράνομη', async () => {
    // ⚠️ Η αγγελία γεννιέται ΝΟΜΙΜΑ ως ανοιχτή με δωδεκάμηνη λήξη· η μετατροπή σε
    //    αποκλειστική **χωρίς** να πειραχτεί η ημερομηνία την κάνει άκυρη. Αν το
    //    κριτήριο κοίταζε μόνο το `expiresAt`, αυτό θα περνούσε σιωπηλά.
    const existing = brokeredOwnerProperty({
      agreement: OPEN_LISTING,
      expiresAt: '2027-06-01T00:00:00.000Z',
    });
    const db = dbWith(existing);

    const result = await setOwnerPropertyMandate(db, existing.id, {
      ...existing.mandates[0]!,
      agreement: 'exclusive-agency',
    });

    expect(result.kind).toBe('invalid-mandate');
  });

  it('🔑 Θ4 — ΑΜΕΤΑΒΛΗΤΗ ΛΗΓΜΕΝΗ εντολή ΓΡΑΦΕΤΑΙ: ο σαρωτής λήξης δεν σπάει', async () => {
    // 🔴 Η μισή απόδειξη που κάνει τον σχεδιασμό σωστό αντί για αυστηρό. Ο σαρωτής
    //    ξαναγράφει ληγμένες εντολές **αυτούσιες**· κρίση εδώ θα τις μπλόκαρε στο
    //    `mandate-expiry-past` και οι ληγμένες αγγελίες θα έμεναν στον χάρτη.
    const expired = brokeredOwnerProperty({ expiresAt: PAST });
    const db = dbWith(expired);

    const result = await setOwnerPropertyMandate(db, expired.id, expired.mandates[0]!);

    expect(result.kind).toBe('saved');
  });

  it('🔴 Θ5 — ΔΕΥΤΕΡΗ ΑΠΛΗ εντολή σε ΑΛΛΟ γραφείο ΓΡΑΦΕΤΑΙ (ADR-832)', async () => {
    // 🔴 **Η ΠΡΑΞΗ ΠΟΥ ΗΤΑΝ ΔΟΜΙΚΑ ΑΔΥΝΑΤΗ.** Με ενικό `mandate`, η δεύτερη ανάθεση
    //    **αντικαθιστούσε** την πρώτη· με τον έλεγχο `kind !== 'self'` ούτε καν
    //    έφτανε εδώ. Τώρα οι δύο συνυπάρχουν — που είναι ο **ορισμός** της απλής
    //    εντολής (`OPEN_LISTING`: «σε οποιονδήποτε αριθμό γραφείων»).
    const existing = brokeredOwnerProperty({
      agreement: OPEN_LISTING,
      agencyCompanyId: 'comp_alfa',
      confirmation: 'confirmed',
    });
    const db = dbWith(existing);

    const result = await setOwnerPropertyMandate(db, existing.id, {
      ...existing.mandates[0]!,
      agencyCompanyId: 'comp_beta',
    });

    expect(result.kind).toBe('saved');
    if (result.kind !== 'saved') return;
    expect(result.property.mandates).toHaveLength(2);
  });

  it('🔴 Θ5β — ΔΕΥΤΕΡΗ ΑΠΟΚΛΕΙΣΤΙΚΗ σε άλλο γραφείο ΑΠΟΡΡΙΠΤΕΤΑΙ, με όνομα', async () => {
    const existing = brokeredOwnerProperty({
      agreement: 'exclusive-right-to-sell',
      agencyCompanyId: 'comp_alfa',
      confirmation: 'confirmed',
    });
    const db = dbWith(existing);

    const result = await setOwnerPropertyMandate(db, existing.id, {
      ...existing.mandates[0]!,
      agencyCompanyId: 'comp_beta',
    });

    expect(result.kind).toBe('invalid-mandate');
    if (result.kind !== 'invalid-mandate') return;
    expect(result.violations).toContain('mandate-conflicts-existing');
    // 🏆 **ΤΟ ΟΝΟΜΑ ΤΑΞΙΔΕΥΕΙ** — εδώ ξεπερνάμε το «Invalid» των MLS.
    expect(result.conflicts?.[0]?.with.agencyCompanyId).toBe('comp_alfa');
  });

  it('Θ6 — αλλαγή ΜΟΝΟ της έγκρισης δεν κρίνεται: η συγκατάθεση δεν είναι νέα σύμβαση', async () => {
    const existing = brokeredOwnerProperty({ expiresAt: PAST });
    const db = dbWith(existing);

    const result = await setOwnerPropertyMandate(db, existing.id, {
      ...existing.mandates[0]!,
      confirmation: 'confirmed',
      decidedAt: '2026-08-29T10:00:00.000Z',
    });

    expect(result.kind).toBe('saved');
  });
});
