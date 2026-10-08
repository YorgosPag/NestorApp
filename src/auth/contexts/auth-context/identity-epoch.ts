'use client';

/**
 * @fileoverview **ΕΠΟΧΗ ΤΑΥΤΟΤΗΤΑΣ** — «είναι ακόμη ο ίδιος άνθρωπος που ήταν όταν ξεκίνησα;» (ADR-908 §3.2).
 * @related auth/identity-change/end-sign-in (την ανεβάζει) · auth-context-session (`syncServerSession` τη ρωτά)
 * @module auth/contexts/auth-context/identity-epoch
 *
 * 🔴 **Η ΚΟΥΡΣΑ ΠΟΥ ΚΛΕΙΝΕΙ** (μετρημένη στην παραγωγή, 2026-10-08): μια εργασία ξεκινά `getIdToken(true)` για τον
 * άνθρωπο Α, ο Α αποσυνδέεται όσο εκείνη περιμένει, και όταν γυρίσει γράφει `setUser` + `POST /api/auth/session`
 * — το cookie **ξαναστήνεται** 0,25 s μετά τη διαγραφή του. Ο έλεγχος `auth.currentUser` **πριν** το `await` δεν
 * λέει τίποτα για το **μετά**.
 *
 * 🔑 Κάθε διαδρομή που γράφει ταυτότητα μετά από `await` κρατά την εποχή **πριν** και παραιτείται αν άλλαξε.
 * ⚠️ **Μετρητής, όχι `uid`**: Α → κανείς → Α (αποσύνδεση και ξανά σύνδεση του ίδιου) έχει ίδιο `uid` και **άλλη**
 * σύνδεση· η παλιά εργασία δεν επιτρέπεται να γράψει ούτε εκεί.
 */

let epoch = 0;
/** `undefined` = το έγγραφο δεν έμαθε ακόμη ποιος είναι εδώ. */
let observedUid: string | null | undefined;

/** Η τωρινή εποχή — κράτα την **πριν** το `await`, σύγκρινε **μετά**. */
export function currentIdentityEpoch(): number {
  return epoch;
}

/** Ρητή αλλαγή: η αποσύνδεση ξεκίνησε, ό,τι εκκρεμεί ανήκει σε άνθρωπο που φεύγει. */
export function advanceIdentityEpoch(): void {
  epoch += 1;
}

/**
 * Ο ακροατής ταυτότητας δηλώνει ποιον βλέπει· η εποχή ανεβαίνει **μόνο** αν άλλαξε ο άνθρωπος.
 * ⚠️ Καλείται **σύγχρονα, πριν από κάθε `await`** του ακροατή — αλλιώς το παράθυρο μένει ανοιχτό.
 */
export function observeIdentity(uid: string | null): void {
  if (observedUid === uid) return;
  observedUid = uid;
  epoch += 1;
}

/** «Άλλαξε ο άνθρωπος από τότε;» — η ΜΙΑ ερώτηση μετά από κάθε `await`. */
export function identityChangedSince(startedAt: number): boolean {
  return startedAt !== epoch;
}
