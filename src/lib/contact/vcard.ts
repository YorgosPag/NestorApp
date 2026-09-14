/**
 * @fileoverview 🏆 **«ΑΠΟΘΗΚΕΥΣΗ ΕΠΑΦΗΣ»** — μία vCard, χωρίς βιβλιοθήκη (ADR-841 §7 Α21.17).
 * @related lib/agency/showcase-vcard.ts (από τη βιτρίνα στην επαφή) · lib/http/content-disposition.ts
 * @module lib/contact/vcard
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ 3.0 ΚΑΙ ΟΧΙ 4.0 (RFC 6350)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η 4.0 είναι το τρέχον πρότυπο, αλλά οι Επαφές του iOS εισάγουν **αξιόπιστα** την 3.0 (RFC 2426) —
 * και ο επισκέπτης μιας βιτρίνας είναι, στατιστικά, σε κινητό. Ό,τι χρειαζόμαστε από την 4.0 (`KIND:org`)
 * έχει ισοδύναμο στην 3.0: το `X-ABShowAs:COMPANY` της Apple, που οι άλλοι αγνοούν αβλαβώς.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΑ ΔΥΟ ΛΑΘΗ ΠΟΥ ΚΑΝΟΥΝ ΟΙ ΑΠΛΟΪΚΕΣ ΥΛΟΠΟΙΗΣΕΙΣ — ΚΑΙ ΤΑ ΔΥΟ ΣΠΑΝΕ ΤΑ ΕΛΛΗΝΙΚΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **Αναδίπλωση στα 75 OCTETS, όχι χαρακτήρες.** Ένα ελληνικό γράμμα είναι **2** bytes σε UTF-8· μια
 *    γραμμή 75 χαρακτήρων είναι ~150 bytes. Και η κοπή **ποτέ στη μέση** χαρακτήρα: μισό γράμμα στο
 *    τέλος μιας γραμμής είναι άκυρο UTF-8, και η επαφή εισάγεται με «�» στην επωνυμία.
 * 2. **Διαφυγή `\` `;` `,` και αλλαγής γραμμής** στις τιμές κειμένου. Το `;` χωρίζει **συστατικά** (π.χ.
 *    του `ADR`), το `,` **πολλαπλές τιμές**: μια επωνυμία «ΠΑΓΩΝΗΣ, ΑΦΟΙ» χωρίς διαφυγή γίνεται δύο τιμές.
 *
 * ⛔ **Καμία φωτογραφία (`PHOTO`)**: το iOS διαβάζει μόνο base64 — δεκάδες KB σε αρχείο που θα έπρεπε να
 * είναι 1 — και το Android συχνά την αγνοεί. Κόστος χωρίς όφελος.
 *
 * **Layering**: leaf — καθαρή συνάρτηση, καμία εξάρτηση.
 */

/** Ένα τηλέφωνο **ήδη** σε E.164 — η κανονικοποίηση ζει στο `channel-phone`, όχι εδώ. */
export interface VCardPhone {
  readonly e164: string;
  readonly extension: string | null;
}

/** Η διεύθυνση — **μόνο** όταν δημοσιεύτηκε οδός. */
export interface VCardAddress {
  readonly streetLine: string;
  readonly postalCode: string;
}

/** **Μία επαφή οργανισμού** — ό,τι χρειάζεται μια κάρτα, τίποτα παραπάνω. */
export interface VCardOrganisation {
  /** Η επωνυμία. */
  readonly organisation: string;
  /** Το τμήμα ή το κατάστημα («Υποκατάστημα Καλαμαριάς») — `null` αν δεν έχει. */
  readonly unit: string | null;
  readonly phones: readonly VCardPhone[];
  readonly emails: readonly string[];
  readonly address: VCardAddress | null;
  /** Απόλυτο URL της ζωντανής σελίδας — `null` αν δεν ξέρουμε ποιοι είμαστε. */
  readonly url: string | null;
}

const CRLF = '\r\n';
const MAX_LINE_OCTETS = 75;
const encoder = new TextEncoder();

/** Διαφυγή τιμής κειμένου (RFC 2426 §4). */
export function escapeVCardText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

/**
 * **Αναδίπλωση μίας λογικής γραμμής** — κάθε φυσική γραμμή ≤ 75 octets, κοπή μόνο **ανάμεσα** σε
 * χαρακτήρες. Η συνέχεια αρχίζει με κενό, που μετρά στα 75 της.
 */
export function foldVCardLine(line: string): string {
  const physical: string[] = [];
  let current = '';
  let octets = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (octets + size > MAX_LINE_OCTETS) {
      physical.push(current);
      current = ` ${character}`;
      octets = 1 + size;
    } else {
      current += character;
      octets += size;
    }
  }
  physical.push(current);
  return physical.join(CRLF);
}

/**
 * **Το εσωτερικό σε κείμενο κλήσης.** Το `,` είναι η σύμβαση «παύση και μετά πληκτρολόγησε» που
 * αναγνωρίζουν οι εφαρμογές τηλεφώνου iOS/Android — το `;ext=` είναι σύνταξη URI (`tel:`), όχι vCard 3.0.
 */
function dialString({ e164, extension }: VCardPhone): string {
  const ext = extension?.trim() ?? '';
  return ext === '' ? e164 : `${e164},${ext}`;
}

function organisationLines(card: VCardOrganisation): string[] {
  const organisation = escapeVCardText(card.organisation);
  const unit = card.unit === null ? null : escapeVCardText(card.unit);
  return [
    'N:;;;;',
    `FN:${unit === null ? organisation : `${organisation} — ${unit}`}`,
    `ORG:${unit === null ? organisation : `${organisation};${unit}`}`,
    'X-ABShowAs:COMPANY',
  ];
}

function channelLines(card: VCardOrganisation): string[] {
  return [
    ...card.phones.map((phone) => `TEL;TYPE=WORK,VOICE:${dialString(phone)}`),
    ...card.emails.map((email) => `EMAIL;TYPE=INTERNET,WORK:${email}`),
  ];
}

function placeLines(card: VCardOrganisation): string[] {
  const lines: string[] = [];
  if (card.address !== null) {
    const { streetLine, postalCode } = card.address;
    lines.push(`ADR;TYPE=WORK:;;${escapeVCardText(streetLine)};;;${escapeVCardText(postalCode)};`);
  }
  if (card.url !== null) lines.push(`URL:${card.url}`);
  return lines;
}

/** **Επαφή οργανισμού → κείμενο vCard 3.0**, με CRLF και αναδίπλωση. */
export function buildVCard(card: VCardOrganisation): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    ...organisationLines(card),
    ...channelLines(card),
    ...placeLines(card),
    'END:VCARD',
  ];
  return lines.map(foldVCardLine).join(CRLF) + CRLF;
}

/**
 * Χαρακτήρες που αρνείται κάποιο σύστημα αρχείων (Windows/macOS).
 *
 * ⚠️ **Σύνολο + κωδικό σημείο, ΟΧΙ κλάση regex με εύρος**: οι χαρακτήρες ελέγχου (< U+0020) δεν γράφονται
 * ορατά στην πηγή, και μετρημένο 2026-09-14 μια τέτοια κλάση κατέληξε **δυαδικό** αρχείο για το `grep`.
 */
const FORBIDDEN_IN_FILENAME = new Set(['\\', '/', ':', '*', '?', '"', '<', '>', '|']);
const FIRST_PRINTABLE = 0x20;
const MAX_FILENAME_LENGTH = 80;

function filenameSafe(character: string): string {
  return character.charCodeAt(0) < FIRST_PRINTABLE || FORBIDDEN_IN_FILENAME.has(character) ? ' ' : character;
}

/** **Το όνομα του αρχείου** — η επωνυμία, χωρίς χαρακτήρες που αρνείται κάποιο σύστημα αρχείων. */
export function vcardFileName(card: Pick<VCardOrganisation, 'organisation' | 'unit'>): string {
  const base = [...[card.organisation, card.unit].filter((part): part is string => part !== null).join(' - ')]
    .map(filenameSafe)
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_FILENAME_LENGTH)
    .trim();
  return `${base === '' ? 'contact' : base}.vcf`;
}
