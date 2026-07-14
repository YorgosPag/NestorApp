/**
 * ADR-651 Φάση Λ — **αποτύπωμα έκδοσης** πινακίδας (§5.11, §8 #8).
 *
 * Το QR της πινακίδας ακολουθεί τη «Δρόμο Γ» (απόφαση Giorgio, όπως Autodesk ACC): κωδικοποιεί
 * **σύνδεσμο ΚΑΙ έκδοση** — ένα URL προς το ζωντανό έργο στο cloud, με το αποτύπωμα της έκδοσης
 * στο query (`?v=...`). Έτσι ο σκανάρων ανοίγει το live έγγραφο **και** ξέρει ποια έκδοση κρατά
 * στο χέρι ο άλλος (audit «τυπωμένο == κατατεθειμένο;»).
 *
 * Το αποτύπωμα είναι **ντετερμινιστικό**: ίδια έκδοση ⇒ ίδιο αποτύπωμα, ώστε δύο εκτυπώσεις της
 * ίδιας έκδοσης να βγάζουν **το ίδιο** QR. Χτίζεται από τα ΥΠΑΡΧΟΝΤΑ facts (έργο + φύλλο +
 * αναθεώρηση) — **ποτέ** `Date.now()` / τυχαιότητα μέσα στο hash, αλλιώς το QR θα «χοροπηδούσε».
 *
 * ⚠️ Locale-independent by design: χρησιμοποιεί το **ακέραιο** revision number (π.χ. `3`), ΟΧΙ
 * τη locale-μορφή (`getActiveRevisionFacts` → «3η»/«3») — αλλιώς η ίδια έκδοση θα έβγαζε άλλο
 * αποτύπωμα στα ελληνικά και άλλο στα αγγλικά. Καθαρή συνάρτηση (testable, μηδέν I/O).
 *
 * @see ./qr-image-client.ts — παράγει το QR ως εικόνα κελιού από αυτό το payload
 * @see docs/centralized-systems/reference/adrs/ADR-651-auto-title-block-generator.md §5.11
 */

/** Τα raw facts που ταυτοποιούν την έκδοση ενός φύλλου — locale-independent (ακέραιη αναθεώρηση). */
export interface TitleBlockVersionFacts {
  /** Firestore doc id του έργου — ο στόχος του deep-link και μέρος της ταυτότητας. */
  readonly projectId?: string;
  /** Ο αριθμός φύλλου (Α-1, Α-2…) — διαφέρει ανά φύλλο σε σετ (Φάση Ζ). */
  readonly sheetNumber?: string;
  /** Ο **ακέραιος** αριθμός αναθεώρησης (raw, όχι locale-formatted). */
  readonly revisionNumber?: number;
}

/** Υπάρχει έστω ένα fact ώστε να έχει νόημα το αποτύπωμα; (αλλιώς: καθόλου QR.) */
export function hasTitleBlockVersionFacts(facts: TitleBlockVersionFacts): boolean {
  return (
    Boolean(facts.projectId) ||
    Boolean(facts.sheetNumber) ||
    facts.revisionNumber !== undefined
  );
}

/**
 * FNV-1a 32-bit → base36. Ντετερμινιστικό, εξαρτάται **μόνο** από το input string (μηδέν
 * κατάσταση, μηδέν ρολόι) — γι' αυτό είναι ασφαλές μέσα σε αποτύπωμα έκδοσης.
 */
function fnv1aBase36(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** Αναγνώσιμο τμήμα token: κρατά γράμματα/ψηφία (και ελληνικά), πετά διαχωριστικά (Α-2 ⇒ Α2). */
function tokenize(value: string): string {
  return value.replace(/[^\p{L}\p{N}]/gu, '');
}

/**
 * Το αποτύπωμα έκδοσης — αναγνώσιμο πρόθεμα (`r{rev}-{sheet}`) + σταθερό hash των raw facts.
 * Το hash μπαίνει **πάντα**: εγγυάται μοναδικότητα ακόμη κι όταν λείπει το αναγνώσιμο μέρος και
 * κάνει το token πραγματικό «αποτύπωμα» (αλλαγή οποιουδήποτε fact ⇒ αλλαγή hash).
 *
 * `''` όταν δεν υπάρχει κανένα fact — ο καλών τότε δεν παράγει QR.
 */
export function buildTitleBlockFingerprint(facts: TitleBlockVersionFacts): string {
  if (!hasTitleBlockVersionFacts(facts)) return '';

  const canonical = [
    facts.projectId ?? '',
    facts.sheetNumber ?? '',
    facts.revisionNumber ?? '',
  ].join('|');

  const parts: string[] = [];
  if (facts.revisionNumber !== undefined) parts.push(`r${facts.revisionNumber}`);
  if (facts.sheetNumber) parts.push(tokenize(facts.sheetNumber));
  parts.push(fnv1aBase36(canonical));
  return parts.join('-');
}

/** Ό,τι χρειάζεται το QR payload: πού δείχνει (project) + ποια έκδοση κρατά (fingerprint). */
export interface TitleBlockQrPayloadInput {
  /** Το production origin της εφαρμογής (`NEXT_PUBLIC_APP_URL` ή το vercel fallback). */
  readonly baseUrl: string;
  /** Firestore doc id του έργου — ο στόχος του deep-link· απόν ⇒ μόνο αποτύπωμα (χωρίς έργο). */
  readonly projectId?: string;
  /** Το αποτύπωμα έκδοσης (`buildTitleBlockFingerprint`). */
  readonly fingerprint: string;
}

/**
 * Το κείμενο που κωδικοποιεί το QR (Δρόμος Γ): deep-link προς το έργο **με** το αποτύπωμα στο
 * query. Χωρίς `projectId` υποβαθμίζεται χαριτωμένα σε «μόνο αποτύπωμα» (audit χωρίς σύνδεσμο).
 *
 * `''` όταν δεν υπάρχει τίποτα να κωδικοποιηθεί (ούτε έργο ούτε αποτύπωμα) ⇒ καθόλου QR.
 */
export function buildTitleBlockQrPayload(input: TitleBlockQrPayloadInput): string {
  const { baseUrl, projectId, fingerprint } = input;
  const version = fingerprint ? `?v=${encodeURIComponent(fingerprint)}` : '';
  if (projectId) return `${baseUrl}/projects/${encodeURIComponent(projectId)}${version}`;
  if (fingerprint) return `${baseUrl}${version}`;
  return '';
}

/** Το production origin — env-first, ίδιο fallback με τα υπόλοιπα call sites της εφαρμογής. */
export function resolveTitleBlockQrBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://nestor-app.vercel.app';
}
