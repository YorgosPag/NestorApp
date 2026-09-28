/**
 * @fileoverview **ΤΟ ΚΡΑΤΟΣ ΣΗΜΕΡΑ ΩΣ ΤΡΙΤΗ ΠΗΓΗ ΤΟΝΩΝ** — ekloges.ypes.gr (Υπουργείο Εσωτερικών) — ADR-893 Φ2.
 * @related `law-3852.ts` · `wikidata-names.ts` (οι άλλες δύο) · `resolve-display-names.ts` (καταναλωτής)
 *
 * 🔑 **ΕΝΑ ΑΙΤΗΜΑ, ΟΧΙ 330** (μετρημένο 2026-09-27): η εφαρμογή των Ευρωεκλογών 2024 φορτώνει το
 * `stat/e/statics.js` — **όλους** τους δήμους (`dhm`, 332) και **όλες** τις δημοτικές ενότητες (`den`,
 * 1.036) τονισμένους, κάθε ενότητα με τον κωδικό του δήμου της. Οι σελίδες ανά ενότητα
 * (`/municipaldistricts/<id>/`) είναι απόδοση του ίδιου αρχείου.
 *
 * 🔒 **ΠΟΤΕ ΕΚΤΕΛΕΣΗ**: το αρχείο είναι JavaScript (`window.static={…}`). Δεν το τρέχουμε — βγάζουμε
 * τους δύο πίνακες ως **κείμενο** και τους διαβάζουμε ως JSON. Ό,τι δεν είναι JSON ⇒ σφάλμα.
 *
 * 🔴 **ΠΑΓΙΔΕΣ ΜΕΤΡΗΜΕΝΕΣ — γιατί ούτε αυτή η πηγή κερδίζει μόνη της**:
 * - **Κωδικοί δικοί της** — ο `4011` δεν είναι ΕΛΣΤΑΤ. Αντιστοίχιση **ΠΟΤΕ κατά κωδικό**: μόνο κατά
 *   **ίδιες λέξεις**, μέσα στον δήμο που ταυτίζεται κατά **σύνολο ενοτήτων** ({@link eklogesMunicipalitiesFor}).
 * - **Χαλασμένο `Ά`** σε 7 ονόματα (`’νω Λιοσίων`) — βλ. {@link repairEklogesText}.
 * - **Χαμένος κεφαλαίος τόνος** (`Αργους Ορεστικού`, `Ανδρου`) — τον πιάνει ο έλεγχος μονοτονικού.
 * - **Διαφωνεί με επίσημα sites δήμων** (`Μονεμβασίας` έναντι `Δήμος Μονεμβασιάς`, `Φρέ` με τόνο σε
 *   μονοσύλλαβο). Γι' αυτό είναι **τρίτη ψήφος**, όχι κριτής: διαφωνία ⇒ επιμέλεια (ADR-893 §3.3).
 *
 * ⚖️ **Άδεια**: ονόματα δήμων και ενοτήτων = γεγονότα· δημόσια πληροφορία του ΥΠΕΣ (ν. 4727/2020).
 */

import { sameWrittenWords } from './greek-orthography';

export const EKLOGES_SOURCE = {
  id: 'ekloges-ypes',
  url: 'https://ekloges.ypes.gr/current/stat/e/statics.js',
  title: 'ekloges.ypes.gr — Ευρωεκλογές 2024, δήμοι και δημοτικές ενότητες (Υπουργείο Εσωτερικών)',
  license: 'Ονόματα = γεγονότα · δημόσια πληροφορία ΥΠΕΣ (ν. 4727/2020)',
} as const;

export interface EklogesMunicipality {
  readonly id: number;
  readonly name: string;
}

export interface EklogesUnit {
  readonly id: number;
  readonly name: string;
  readonly municipalityId: number;
}

export interface EklogesNames {
  readonly municipalities: readonly EklogesMunicipality[];
  readonly units: readonly EklogesUnit[];
}

/**
 * **Το χαλασμένο `Ά`** — `’νω Λιοσίων`, `’ργους Ορεστικού`, `’σσου-Λεχαίου` (7 ονόματα).
 *
 * Αιτία **αποδείξιμη**, όχι μαντεψιά: bytes σε **Windows-1253** διαβάστηκαν ως **ISO-8859-7**. Οι δύο
 * κωδικοσελίδες διαφέρουν σε **ένα** ελληνικό γράμμα: το `Ά` είναι `0xA2` στην 1253, και το `0xA2` στην
 * 8859-7 είναι `’` (U+2019). Άρα κάθε `’` της πηγής είναι `Ά` — και κανένα άλλο γράμμα δεν χαλάει.
 * Το αποτέλεσμα περνά **ακόμη** από τον έλεγχο ίδιων λέξεων και μονοτονικού.
 */
export function repairEklogesText(text: string): string {
  return text.replace(/’/g, 'Ά');
}

/** Ο πίνακας `key:[[…],…]` του `window.static` ως JSON — με αντιστοίχιση αγκυλών, χωρίς εκτέλεση. */
function extractArray(source: string, key: string): unknown {
  const start = source.search(new RegExp(`[{,\\s]${key}\\s*:\\s*\\[`));
  if (start < 0) throw new Error(`ekloges: λείπει ο πίνακας «${key}»`);
  const open = source.indexOf('[', start);
  let depth = 0;
  let inString = false;
  for (let i = open; i < source.length; i += 1) {
    const char = source[i];
    if (inString) {
      if (char === '\\') i += 1;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === '[') depth += 1;
    else if (char === ']' && --depth === 0) return JSON.parse(source.slice(open, i + 1));
  }
  throw new Error(`ekloges: ο πίνακας «${key}» δεν κλείνει`);
}

function tuples(value: unknown, key: string): readonly (readonly unknown[])[] {
  if (!Array.isArray(value) || !value.every(Array.isArray)) throw new Error(`ekloges: ο «${key}» δεν είναι πίνακας πλειάδων`);
  return value;
}

function idAndName(row: readonly unknown[], key: string): { readonly id: number; readonly name: string } {
  const [id, name] = row;
  if (typeof id !== 'number' || typeof name !== 'string') throw new Error(`ekloges: άκυρη γραμμή «${key}» ${JSON.stringify(row)}`);
  return { id, name: repairEklogesText(name) };
}

/** `dhm: [id, όνομα, τμήματα, περιφέρεια]` · `den: [id, όνομα, τμήματα, δήμος]`. */
export function parseEklogesStatics(source: string): EklogesNames {
  const municipalities = tuples(extractArray(source, 'dhm'), 'dhm').map((row) => idAndName(row, 'dhm'));
  const units = tuples(extractArray(source, 'den'), 'den').map((row) => {
    const municipalityId = row[3];
    if (typeof municipalityId !== 'number') throw new Error(`ekloges: ενότητα χωρίς δήμο ${JSON.stringify(row)}`);
    return { ...idAndName(row, 'den'), municipalityId };
  });
  return { municipalities, units };
}

/**
 * **Ποιος δήμος του ekloges είναι αυτός ο δήμος του μητρώου** — κατά **σύνολο ενοτήτων**, όχι κατά
 * όνομα ή κωδικό.
 *
 * Γιατί όχι κατά όνομα (μετρημένο): `Νάξου & Μικρών Κυκλάδων` ≠ `Νάξου και Μικρών Κυκλάδων`,
 * `Ηρωικής Πόλης Νάουσας` ≠ `Ηρωικής Πόλεως Νάουσας`, και **δύο** `Ηρακλείου` (Αττική, Κρήτη).
 * Νικητής: ο δήμος με τις περισσότερες ενότητες ίδιων λέξεων, **τουλάχιστον μισές** του μητρώου·
 * ισοπαλία ⇒ όλοι οι ισόπαλοι (η ομοφωνία των υποψηφίων κρατά την ασφάλεια).
 */
export function eklogesMunicipalitiesFor(unitNames: readonly string[], ekloges: EklogesNames): readonly number[] {
  if (unitNames.length === 0) return [];
  const score = new Map<number, number>();
  for (const name of unitNames) {
    const owners = new Set(ekloges.units.filter((unit) => sameWrittenWords(unit.name, name)).map((unit) => unit.municipalityId));
    for (const owner of owners) score.set(owner, (score.get(owner) ?? 0) + 1);
  }
  const best = Math.max(0, ...score.values());
  if (best * 2 < unitNames.length) return [];
  return [...score].filter(([, value]) => value === best).map(([id]) => id);
}
