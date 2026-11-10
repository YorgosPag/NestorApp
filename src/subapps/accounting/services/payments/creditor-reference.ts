/**
 * @fileoverview Structured Creditor Reference — ISO 11649 («κωδικός RF»)
 * @description «RF» + 2 ψηφία ελέγχου + έως 21 αλφαριθμητικά. Ο λήπτης το γράφει στην αιτιολογία της μεταφοράς·
 *   ο εκδότης ξέρει **χωρίς μαντεψιά** ποιο παραστατικό πληρώθηκε, και η τράπεζα πιάνει τυπογραφικό λάθος από
 *   τα ψηφία ελέγχου (mod 97, ISO 7064 — ο ίδιος αλγόριθμος με το IBAN).
 *
 * Καθαρές συναρτήσεις: κανένα I/O, καμία εξάρτηση — ο φύλλο-κόμβος της αλυσίδας (PDF · EPC QR · συμφωνία τράπεζας).
 *
 * @see ADR-ACC-018 §15 · ISO 11649:2009 · EPC069-12 v3.1 (structured remittance)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

/** Μέγιστο μήκος του σώματος της αναφοράς (χωρίς «RF» και ψηφία ελέγχου). */
export const CREDITOR_REFERENCE_MAX_BODY = 21;

const PREFIX = 'RF';
const BODY_PATTERN = /^[A-Z0-9]{1,21}$/;
const REFERENCE_PATTERN = /^RF\d{2}[A-Z0-9]{1,21}$/;

/** Γράμματα → αριθμοί (A=10 … Z=35), ψηφία ως έχουν — ISO 7064 / ISO 13616. */
function toNumericString(text: string): string {
  let out = '';
  for (const ch of text) {
    out += ch >= 'A' && ch <= 'Z' ? String(ch.charCodeAt(0) - 55) : ch;
  }
  return out;
}

/** Υπόλοιπο mod 97 τμηματικά — χωρίς BigInt, χωρίς απώλεια ακρίβειας. */
function mod97(numeric: string): number {
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    remainder = Number.parseInt(`${remainder}${numeric.substring(i, i + 7)}`, 10) % 97;
  }
  return remainder;
}

/** Χωρίς κενά, κεφαλαία — η ψηφιακή μορφή. */
export function cleanCreditorReference(reference: string): string {
  return reference.replace(/\s/g, '').toUpperCase();
}

/**
 * Το πλήρες RF για ένα σώμα αναφοράς. `null` όταν το σώμα δεν είναι 1–21 λατινικά αλφαριθμητικά —
 * ποτέ σιωπηλό κόψιμο ή «διόρθωση» (μια λάθος αναφορά είναι χειρότερη από καμία).
 */
export function buildCreditorReference(body: string): string | null {
  const clean = cleanCreditorReference(body);
  if (!BODY_PATTERN.test(clean)) return null;
  const check = 98 - mod97(toNumericString(`${clean}${PREFIX}00`));
  return `${PREFIX}${String(check).padStart(2, '0')}${clean}`;
}

/** Έγκυρο RF: μορφή + ψηφία ελέγχου (η αναδιάταξη δίνει υπόλοιπο 1). */
export function isValidCreditorReference(reference: string): boolean {
  const clean = cleanCreditorReference(reference);
  if (!REFERENCE_PATTERN.test(clean)) return false;
  return mod97(toNumericString(`${clean.substring(4)}${clean.substring(0, 4)}`)) === 1;
}

/** Μορφή εκτύπωσης: ομάδες των 4 (`RF18 5390 0754 7034`) — όπως το `formatIBAN`. */
export function formatCreditorReference(reference: string): string {
  const clean = cleanCreditorReference(reference);
  return clean.match(/.{1,4}/g)?.join(' ') ?? clean;
}

/** Το σώμα ενός έγκυρου RF (χωρίς «RF» + ψηφία ελέγχου). */
export function creditorReferenceBody(reference: string): string {
  return cleanCreditorReference(reference).substring(4);
}

/**
 * Κάθε **έγκυρο** RF μέσα σε ελεύθερο κείμενο (αιτιολογία τράπεζας). Δέχεται τη μορφή εκτύπωσης με κενά
 * (`RF18 5390 0754 7034`)· ό,τι αποτυγχάνει στον έλεγχο ψηφίων απορρίπτεται — ψευδώς θετικό δεν περνά.
 *
 * Η τράπεζα συχνά κολλά κείμενο αμέσως μετά (`RF18539007547034 INV`): το ταίριασμα παίρνει έως 21 χαρακτήρες
 * σώματος και κρατά το **μακρύτερο** πρόθεμα που περνά τον έλεγχο ψηφίων.
 */
export function findCreditorReferences(text: string): string[] {
  const found = new Set<string>();
  const candidates = text.toUpperCase().matchAll(/(?<![A-Z0-9])RF\d{2}(?:\s?[A-Z0-9]){1,21}/g);
  for (const match of candidates) {
    const valid = longestValidPrefix(cleanCreditorReference(match[0]));
    if (valid !== null) found.add(valid);
  }
  return [...found];
}

function longestValidPrefix(clean: string): string | null {
  for (let length = clean.length; length >= 5; length -= 1) {
    const candidate = clean.substring(0, length);
    if (isValidCreditorReference(candidate)) return candidate;
  }
  return null;
}
