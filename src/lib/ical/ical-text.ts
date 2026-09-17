/**
 * @fileoverview **ΤΟ ΚΕΙΜΕΝΟ ΤΟΥ iCalendar** — δίπλωμα/ξεδίπλωμα γραμμών, διαφυγή τιμών
 *   `TEXT`, και η ΜΙΑ ανάλυση γραμμής περιεχομένου σε `(όνομα, παράμετροι, τιμή)`.
 * @related ADR-835 §22 (Στάδιο Γ) · RFC 5545 §3.1 (content lines) · §3.3.11 (TEXT) ·
 *   lib/ical/ical-read.ts · lib/ical/ical-write.ts
 * @module lib/ical/ical-text
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΕΝΑ ΑΡΧΕΙΟ ΓΙΑ ΤΙΣ ΔΥΟ ΚΑΤΕΥΘΥΝΣΕΙΣ — ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το δίπλωμα στα **75 οκτάδα** (RFC 5545 §3.1) και η διαφυγή του `TEXT` είναι **η ίδια
 * γνώση** διαβασμένη από τις δύο άκρες. Γραμμένη δύο φορές, θα μπορούσε να αποκλίνει —
 * και η απόκλιση εδώ σημαίνει «το κανάλι δεν καταλαβαίνει το ημερολόγιό μας», δηλαδή
 * σιωπηλά χαμένες κρατήσεις. Γραμμένη **μία** φορά, κάθε άγκυρα
 * `parse(write(x)) === x` ελέγχει **και τις δύο** κατευθύνσεις μαζί.
 *
 * ⚠️ **ΟΚΤΑΔΑ, ΟΧΙ ΧΑΡΑΚΤΗΡΕΣ.** Το όριο του RFC μετρά **bytes UTF-8**: το «Διαμέρισμα»
 * είναι 10 χαρακτήρες και **20 οκτάδα**. Μέτρηση σε χαρακτήρες παράγει γραμμές που
 * περνούν τον δικό μας έλεγχο και κόβονται από αυστηρούς αναγνώστες.
 *
 * ⚠️ **ΠΟΤΕ δεν σπάει χαρακτήρα στη μέση.** Ένα δίπλωμα ανάμεσα στα δύο οκτάδα ενός
 * ελληνικού γράμματος παράγει άκυρο UTF-8 — και ο παραλήπτης δεν έχει τρόπο να το
 * επιδιορθώσει.
 */

/** Το ανώτατο μήκος **φυσικής** γραμμής σε οκτάδα, μαζί με το `CRLF` (RFC 5545 §3.1). */
export const ICAL_LINE_OCTETS = 75;

/** Ο τερματισμός γραμμής του πρωτοκόλλου — `CRLF`, ποτέ `\n` μόνο. */
export const ICAL_CRLF = '\r\n';

// =============================================================================
// 1. ΞΕΔΙΠΛΩΜΑ — ΤΟ ΠΡΩΤΟ ΒΗΜΑ ΚΑΘΕ ΑΝΑΓΝΩΣΗΣ
// =============================================================================

/**
 * **Φυσικές γραμμές → λογικές γραμμές.** Γραμμή που αρχίζει με κενό ή `TAB` είναι
 * **συνέχεια** της προηγούμενης (RFC 5545 §3.1): το πρώτο της σημείο αφαιρείται.
 *
 * 🔑 **Ανεκτικό ΜΟΝΟ στο τέλος γραμμής**: δέχεται `CRLF`, `LF` και `CR`, γιατί
 * μετρημένα κανάλια στέλνουν σκέτο `LF` — και μια αυστηρότητα **εδώ** θα σήμαινε
 * «κανένα γεγονός», δηλαδή «όλα ελεύθερα». Η αυστηρότητα ζει στο `ical-read`, όπου
 * ένα αδιάβαστο γεγονός γίνεται **ονομασμένη** αποτυχία, ποτέ σιωπή.
 */
export function unfoldIcalLines(raw: string): readonly string[] {
  const physical = raw.split(/\r\n|\n|\r/);
  const logical: string[] = [];
  for (const line of physical) {
    if (line === '') continue;
    const first = line.charAt(0);
    if ((first === ' ' || first === '\t') && logical.length > 0) {
      logical[logical.length - 1] += line.slice(1);
      continue;
    }
    logical.push(line);
  }
  return logical;
}

// =============================================================================
// 2. ΔΙΠΛΩΜΑ — ΤΟ ΤΕΛΕΥΤΑΙΟ ΒΗΜΑ ΚΑΘΕ ΓΡΑΦΗΣ
// =============================================================================

function octetsOf(text: string): number {
  return Buffer.byteLength(text, 'utf-8');
}

/**
 * **Λογική γραμμή → φυσικές γραμμές** διπλωμένες στα {@link ICAL_LINE_OCTETS}.
 *
 * Η συνέχεια παίρνει **ένα** κενό μπροστά, άρα το ωφέλιμο μήκος της είναι ένα οκτάδο
 * λιγότερο. Το `CRLF` μετράει στο όριο του RFC, γι' αυτό κόβουμε στα 73 οκτάδα
 * περιεχομένου: `73 + 2 = 75`.
 */
export function foldIcalLine(line: string): readonly string[] {
  const limit = ICAL_LINE_OCTETS - 2;
  if (octetsOf(line) <= limit) return [line];

  const out: string[] = [];
  let current = '';
  let currentOctets = 0;
  let allowance = limit;
  // Ανά **σημείο κώδικα** (`for…of`), ώστε κανένα γράμμα να μη σπάσει στη μέση.
  for (const char of line) {
    const size = octetsOf(char);
    if (currentOctets + size > allowance) {
      out.push(current);
      current = '';
      currentOctets = 0;
      // Οι γραμμές συνέχειας κουβαλούν το κενό του διπλώματος.
      allowance = limit - 1;
    }
    current += char;
    currentOctets += size;
  }
  out.push(current);
  return out.map((part, index) => (index === 0 ? part : ` ${part}`));
}

// =============================================================================
// 3. ΤΙΜΕΣ `TEXT` — ΔΙΑΦΥΓΗ ΚΑΙ ΕΠΑΝΑΦΟΡΑ (RFC 5545 §3.3.11)
// =============================================================================

/** Κείμενο → τιμή `TEXT`: `\` `;` `,` και νέα γραμμή γίνονται ακολουθίες διαφυγής. */
export function escapeIcalText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\n|\r/g, '\\n');
}

/**
 * Τιμή `TEXT` → κείμενο. `\N` και `\n` σημαίνουν **και τα δύο** νέα γραμμή (το RFC
 * επιτρέπει και τα δύο), και μια μοναχική `\` μπροστά από άγνωστο χαρακτήρα κρατά τον
 * χαρακτήρα — ανεκτικότητα που δεν κρύβει τίποτα, γιατί το κείμενο **δεν** κρίνει
 * διαθεσιμότητα.
 */
export function unescapeIcalText(value: string): string {
  let out = '';
  for (let index = 0; index < value.length; index += 1) {
    const char = value.charAt(index);
    if (char !== '\\') {
      out += char;
      continue;
    }
    const next = value.charAt(index + 1);
    if (next === '') return out + char;
    out += next === 'n' || next === 'N' ? '\n' : next;
    index += 1;
  }
  return out;
}

// =============================================================================
// 4. Η ΓΡΑΜΜΗ ΠΕΡΙΕΧΟΜΕΝΟΥ — ΟΝΟΜΑ, ΠΑΡΑΜΕΤΡΟΙ, ΤΙΜΗ
// =============================================================================

/**
 * Μια λογική γραμμή αναλυμένη. Οι παράμετροι είναι **κανονικοποιημένες σε κεφαλαία**
 * ως ονόματα (`TZID`, `VALUE`) — το RFC λέει ότι τα ονόματα είναι case-insensitive, και
 * μετρημένα κανάλια στέλνουν `Tzid`.
 */
export interface IcalContentLine {
  readonly name: string;
  readonly params: Readonly<Record<string, string>>;
  readonly value: string;
}

/**
 * **Λογική γραμμή → δομή**, ή `null` όταν δεν είναι γραμμή περιεχομένου.
 *
 * ⚠️ Το `:` **μέσα σε παράμετρο σε εισαγωγικά** δεν χωρίζει όνομα από τιμή:
 * `DTSTART;TZID="Europe/Athens:x":20260101` είναι νόμιμο. Γι' αυτό ο διαχωρισμός
 * γίνεται με **σάρωση** που θυμάται τα εισαγωγικά, ποτέ με `split(':')`.
 */
export function parseIcalContentLine(line: string): IcalContentLine | null {
  let quoted = false;
  let colon = -1;
  for (let index = 0; index < line.length; index += 1) {
    const char = line.charAt(index);
    if (char === '"') quoted = !quoted;
    else if (char === ':' && !quoted) {
      colon = index;
      break;
    }
  }
  if (colon === -1) return null;

  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts = splitUnquoted(head, ';');
  const name = (parts[0] ?? '').trim().toUpperCase();
  if (name === '') return null;

  const params: Record<string, string> = {};
  for (const part of parts.slice(1)) {
    const equals = part.indexOf('=');
    if (equals === -1) continue;
    const key = part.slice(0, equals).trim().toUpperCase();
    const raw = part.slice(equals + 1).trim();
    if (key !== '') params[key] = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
  }
  return { name, params, value };
}

function splitUnquoted(text: string, separator: string): readonly string[] {
  const out: string[] = [];
  let quoted = false;
  let current = '';
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    if (char === separator && !quoted) {
      out.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  out.push(current);
  return out;
}
