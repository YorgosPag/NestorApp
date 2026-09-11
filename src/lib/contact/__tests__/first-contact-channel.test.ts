/**
 * 🔴 **ΑΠΟ ΠΟΙΟ ΚΑΝΑΛΙ ΦΕΥΓΕΙ Η ΠΡΩΤΗ ΕΠΑΦΗ** — ο ταξινομητής, χωρίς οθόνη (ADR-844 §12)
 * @related lib/contact/first-contact-channel.ts
 *
 * ΜΕΤΑΛΛΑΞΕΙΣ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΡΙΞΟΥΝ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * 1. Σβήσε τον έλεγχο `emailVerified` → το Κ3 κοκκινίζει.
 * 2. Άλλαξε το `sameChannelEmail(...)` σε ωμή `===` → το Κ2 κοκκινίζει.
 * 3. Κάνε το `boundEmailOf` να επιστρέφει το ωμό email → το Δ2 κοκκινίζει.
 */

import {
  FIRST_CONTACT_CHANNELS,
  boundEmailOf,
  firstContactChannelOf,
  type ChannelViewer,
} from '../first-contact-channel';

const VERIFIED: ChannelViewer = { email: 'giannis@example.gr', emailVerified: true };

describe('Κ — ο ταξινομητής', () => {
  it('🔑 Κ1 — συνδεδεμένος + επιβεβαιωμένος + ίδιο email ⇒ proven', () => {
    expect(firstContactChannelOf(VERIFIED, 'giannis@example.gr')).toBe('proven');
  });

  it('🔑 Κ2 — η ΜΟΡΦΗ δεν μετράει: κεφαλαία/κενά είναι η ίδια διεύθυνση', () => {
    expect(firstContactChannelOf(VERIFIED, '  Giannis@Example.GR ')).toBe('proven');
  });

  it('🔴 Κ3 — ίδιο email, ΜΗ επιβεβαιωμένο ⇒ unverified-account (όχι proven)', () => {
    expect(
      firstContactChannelOf({ ...VERIFIED, emailVerified: false }, 'giannis@example.gr'),
    ).toBe('unverified-account');
  });

  it('🔴 Κ4 — ο ανώνυμος ⇒ guest, ό,τι κι αν γράψει', () => {
    expect(firstContactChannelOf(null, 'giannis@example.gr')).toBe('guest');
    expect(firstContactChannelOf(null, '')).toBe('guest');
  });

  it('🔴 Κ5 — συνδεδεμένος που στέλνει ΑΛΛΗ διεύθυνση ⇒ foreign-address', () => {
    expect(firstContactChannelOf(VERIFIED, 'kapoios.allos@example.gr')).toBe('foreign-address');
  });

  it('🔴 Κ6 — λογαριασμός ΧΩΡΙΣ email: ποτέ proven, ούτε πάνω σε κενή φόρμα', () => {
    const noEmail: ChannelViewer = { email: null, emailVerified: true };
    expect(firstContactChannelOf(noEmail, '')).toBe('foreign-address');
    expect(firstContactChannelOf(noEmail, 'maria@example.gr')).toBe('foreign-address');
  });

  it('🔑 Κ7 — ο παρονομαστής: και τα τέσσερα κανάλια είναι ΕΦΙΚΤΑ', () => {
    // ⚠️ Κανάλι του λεξιλογίου που καμία είσοδος δεν φτάνει θα ήταν κείμενο που
    //    **δεν φαίνεται ποτέ** — και άρα κείμενο που κανείς δεν διορθώνει.
    const reached = new Set([
      firstContactChannelOf(VERIFIED, 'giannis@example.gr'),
      firstContactChannelOf({ ...VERIFIED, emailVerified: false }, 'giannis@example.gr'),
      firstContactChannelOf(null, 'x@example.gr'),
      firstContactChannelOf(VERIFIED, 'x@example.gr'),
    ]);
    expect([...reached].sort()).toEqual([...FIRST_CONTACT_CHANNELS].sort());
  });
});

describe('Δ — το δεμένο email', () => {
  it('🔑 Δ1 — ο συνδεδεμένος με email είναι δεμένος σε αυτό', () => {
    expect(boundEmailOf(VERIFIED)).toBe('giannis@example.gr');
  });

  it('🔴 Δ2 — κενό ή μόνο-κενά email λογαριασμού ⇒ ΚΑΝΕΝΑ δέσιμο', () => {
    expect(boundEmailOf({ email: '   ', emailVerified: true })).toBeNull();
    expect(boundEmailOf({ email: null, emailVerified: true })).toBeNull();
  });

  it('🔑 Δ3 — ο ανώνυμος δεν είναι δεμένος πουθενά', () => {
    expect(boundEmailOf(null)).toBeNull();
  });

  it('🔴 Δ4 — το δεμένο email είναι ΠΑΝΤΑ proven ή unverified, ποτέ foreign', () => {
    // 🔑 Η ιδιότητα που κάνει το δέσιμο **θεραπεία** και όχι διακόσμηση: η φόρμα που
    //    στέλνει το δεμένο email δεν μπορεί να καταλήξει σε ξένο λογαριασμό.
    for (const viewer of [VERIFIED, { ...VERIFIED, emailVerified: false }]) {
      const bound = boundEmailOf(viewer);
      expect(bound).not.toBeNull();
      expect(firstContactChannelOf(viewer, bound ?? '')).not.toBe('foreign-address');
    }
  });
});
