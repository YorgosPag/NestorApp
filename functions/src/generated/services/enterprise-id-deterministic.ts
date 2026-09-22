// ⚠️ GENERATED — DO NOT EDIT. Verbatim projection of src/services/enterprise-id-deterministic.ts (ADR-874 · CHECK 3.93).
// Edit the source, then run: npm run generate:functions-projection
// sha256:f0cd2ea97b97bf8f84393ed326cfdd1eefb35150c4cdd824385befe5b4a78355

/**
 * ENTERPRISE ID — DETERMINISTIC UUID SUFFIX (ADR-632 Φ5)
 *
 * Pure, dependency-free helper extracted from `enterprise-id-class.ts` to keep
 * that file under the 500-line SRP limit (N.7.1). No `crypto`, no state — a
 * synchronous public-domain 128-bit string hash (cyrb128), so it stays a leaf
 * in the import graph exactly like the class file that consumes it.
 *
 * @module services/enterprise-id-deterministic
 */

/**
 * DETERMINISTIC UUID-shaped suffix από σταθερό `seed` (cyrb128 — synchronous,
 * public-domain 128-bit string hash· browser+node safe, μηδέν crypto).
 * Ίδιο seed → ίδιο suffix → **σταθερό** enterprise id για derived/managed
 * οντότητες που ξανα-δημιουργούνται idempotent (π.χ. auto stairwell opening ανά
 * (stair, slab)), ώστε undo→redo να ΜΗΝ αλλάζει doc id (μηδέν Firestore churn).
 * ΔΕΝ είναι κρυπτογραφικό — μόνο για σταθερή ταυτότητα, όχι security.
 */
export function deterministicUuid(seed: string): string {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  const hx = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  const h = hx(h1) + hx(h2) + hx(h3) + hx(h4); // 32 hex chars (128-bit)
  // RFC-4122-shaped: version nibble '5' (name-based) + variant '8' — «μοιάζει» enterprise uuid.
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * Το ίδιο suffix, με **nibble έκδοσης `4`** — η μορφή που δέχεται ο επικυρωτής του
 * έργου (`enterprise-id-parse.ts` ⇒ `UUID_V4`).
 *
 * 🔑 **Δεν είναι δεύτερος κατακερματισμός**: καλεί τον {@link deterministicUuid} και
 * ξαναγράφει **μόνο το nibble**. Ίδιος σπόρος ⇒ ίδιο id, μία μηχανή (N.18).
 *
 * 🔴 **ΓΙΑΤΙ ΖΕΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΗΝ ΚΛΑΣΗ (ADR-873 Φ1 · S0.1)**: ήταν σώμα του
 * `EnterpriseIdService.mintDeterministicV4Id`, δηλαδή **μη φορητό** — το
 * `enterprise-id-class.ts` σέρνει προθέματα, τύπους και τη βασική κλάση. Το
 * `functions/` είναι **χωριστό πακέτο npm** που δεν μπορεί να εισάγει από το `src/`
 * και παίρνει τον κώδικά του με **προβολή** (ADR-874 / CHECK 3.93), η οποία δέχεται
 * μόνο αρχεία **κλειστά** ως προς τις εισαγωγές. Αντιγραφή του nibble εκεί θα ήταν
 * **δεύτερη μηχανή hash** — ακριβώς το σφάλμα που το ADR-874 μόλις κατάργησε σε 5
 * σημεία. Άρα: EXTRACT εδώ, η κλάση **καλεί**, το `functions/` **προβάλλει**.
 *
 * ⛔ Η κλάση κρατά το `mintDeterministicV4Id` ως `protected` μέθοδο — **μην το
 * καταργήσεις**: η άγκυρα του `enterprise-id.service.test.ts` σαρώνει την αλυσίδα
 * γεννητόρων και το όνομα `mint…` είναι αυτό που την κρατά μακριά τους (ADR-851).
 */
export function deterministicV4Uuid(seed: string): string {
  const uuid = deterministicUuid(seed);
  return `${uuid.slice(0, 14)}4${uuid.slice(15)}`;
}
