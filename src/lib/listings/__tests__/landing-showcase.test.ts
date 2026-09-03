/**
 * @fileoverview **ΠΟΙΕΣ ΑΓΓΕΛΙΕΣ ΑΠΟΔΕΙΚΝΥΟΥΝ** — η επιλογή της ρίζας (ADR-777 §8.49).
 * @related ADR-777 §8.10 (αρνείται να υποσχεθεί) · §8.49 (οφείλει να αποδείξει)
 *          · lib/listings/listing-coverage · lib/listings/listing-showcase-order
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ ΠΟΥ ΔΕΝ ΦΥΛΑΕΙ Ο ΑΔΕΛΦΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `listing-showcase-order.test.ts` ρωτά *«με ποια σειρά;»*. Αυτό ρωτά *«**ποιες**, και
 * **πόσες**;»* — και η διαφορά είναι ολόκληρη: μια σωστή σειρά πάνω σε **λάθος δείγμα**
 * παράγει οθόνη που **φαίνεται** ντετερμινιστική και **είναι** τυχαία.
 */

import {
  LANDING_SHOWCASE_LIMIT,
  landingShowcaseListings,
} from '@/lib/listings/listing-coverage';
import type { PublicListing } from '@/types/public-listing';

function listing(id: string, title: string): PublicListing {
  return { id, title } as unknown as PublicListing;
}

/** Τίτλοι σε **αντίστροφη** αλφαβητική σειρά, ώστε «άταξη» και «σειρά» να μη συμπίπτουν. */
function reversed(count: number): readonly PublicListing[] {
  return Array.from({ length: count }, (_, i) => {
    const n = count - i;
    return listing(`id-${String(n).padStart(2, '0')}`, `Τ${String(n).padStart(2, '0')}`);
  });
}

describe('Β1 — Η ΤΑΞΙΝΟΜΗΣΗ ΠΡΟΗΓΕΙΤΑΙ ΤΟΥ ΚΟΨΙΜΑΤΟΣ', () => {
  it('🔴 κρατά τις ΑΛΦΑΒΗΤΙΚΑ πρώτες, ΟΧΙ τις πρώτες του `onSnapshot`', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: γύρνα το `slice` πριν το `orderShowcaseListings`
    //    (`orderShowcaseListings(listings.slice(0, LIMIT))`) ⇒ κοκκινίζει.
    //    Θα επέστρεφε τις Τ12…Τ07 ταξινομημένες — **τυχαίο δείγμα με ντετερμινιστική
    //    εμφάνιση**, ακριβώς το «τυχαιότητα, όχι ουδετερότητα» του αδελφού.
    const shown = landingShowcaseListings(reversed(12));

    expect(shown.map((l) => l.title)).toEqual(['Τ01', 'Τ02', 'Τ03', 'Τ04', 'Τ05', 'Τ06']);
  });

  it('🔴 δεν μεταβάλλει την είσοδο — έρχεται `readonly` από τη συνδρομή', () => {
    const input = reversed(3);
    const before = input.map((l) => l.title);

    landingShowcaseListings(input);

    expect(input.map((l) => l.title)).toEqual(before);
  });
});

describe('Β2 — ΤΟ ΤΑΒΑΝΙ', () => {
  it('🔴 ποτέ περισσότερες από το όριο', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: σβήσε το `.slice(0, LANDING_SHOWCASE_LIMIT)` ⇒ κοκκινίζει.
    expect(landingShowcaseListings(reversed(50))).toHaveLength(LANDING_SHOWCASE_LIMIT);
  });

  it('🔴 όταν είναι λιγότερες από το όριο, τις δείχνει ΟΛΕΣ — ποτέ γέμισμα', () => {
    // Η ζωντανή κατάσταση της 2026-09-04: 8 αγγελίες ⇒ δείχνονται 6, καμία εφευρεμένη.
    expect(landingShowcaseListings(reversed(2))).toHaveLength(2);
    expect(landingShowcaseListings([])).toHaveLength(0);
  });

  it('🔴 ΤΟ ΟΡΙΟ ΔΕΝ ΑΦΗΝΕΙ ΚΟΥΤΣΗ ΣΕΙΡΑ σε καμία διάταξη που συμβαίνει', () => {
    // 🔑 **Ο ΛΟΓΟΣ ΤΟΥ ΑΡΙΘΜΟΥ, ΕΚΤΕΛΕΣΜΕΝΟΣ.** Το πλέγμα αναδιπλώνεται σε 1 · 2 · 3
    //    στήλες (κινητό · ταμπλέτα · οθόνη). Ένα 5 ή ένα 7 θα άφηνε μοναχική κάρτα σε
    //    **δύο από τις τρεις** — και μια μισοάδεια σειρά διαβάζεται ως «κάτι δεν
    //    φόρτωσε», όχι ως όριο.
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: κάνε το όριο 5 ή 7 ⇒ κοκκινίζει.
    for (const columns of [1, 2, 3]) {
      expect(LANDING_SHOWCASE_LIMIT % columns).toBe(0);
    }
  });
});
