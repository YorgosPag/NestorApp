/**
 * @fileoverview **ΠΟΙΑ ΔΟΥ ΕΙΝΑΙ ΑΥΤΗ;** — η ΜΙΑ αντιστοίχιση ελεύθερου κειμένου στον κατάλογο `GREEK_TAX_OFFICES`.
 * @module subapps/accounting/data/greek-tax-office-match
 * @related ADR-950 §8.4 · lib/contacts/contact-evidence-grounding (ανάγνωση εγγράφου) · ADR-ACC-013 (κατάλογος)
 *
 * Σφραγίδες και τιμολόγια γράφουν τη ΔΟΥ **συντομευμένη**: «Δ.Ο.Υ. Ιωνίας» για την «Ιωνίας Θεσσαλονίκης». Η ακριβής
 * ισότητα ονόματος (ό,τι έκανε η γείωση ως 2026-11-23) την απέρριπτε πάντα ⇒ «Δυσανάγνωστο».
 *
 * Κανόνας — **ποτέ μαντεψιά**:
 * 1. κωδικός καταλόγου ή **ακριβές** όνομα ⇒ αυτή·
 * 2. αλλιώς οι ΔΟΥ που περιέχουν τις λέξεις του κειμένου **συνεχόμενες** («ιωνιας» ⊂ «ιωνιας θεσσαλονικης», «νεας ιωνιας»)·
 *    **μία** ⇒ αυτή·
 * 3. πολλές ⇒ μένουν μόνο όσες συμφωνούν με **τόπο** που αποδείχθηκε αλλού (περιφέρεια της επαληθευμένης διεύθυνσης του
 *    ίδιου εγγράφου, `samePlaceName`, με πτώσεις: «Θεσσαλονίκη» ⇄ «Θεσσαλονίκης»)· **μία** ⇒ αυτή, αλλιώς `null`.
 *
 * **Layering**: καθαρή — καμία I/O.
 */

import { samePlaceName } from '@/utils/address/place-name';
import { normalizeForLabelMatch } from '@/utils/greek-text';

import { GREEK_TAX_OFFICES, type TaxOffice } from './greek-tax-offices';

/** «Δ.Ο.Υ. Α΄ ΑΘΗΝΩΝ» · «ΔΟΥ Α' Αθηνών» · «Α ΑΘΗΝΩΝ» ⇒ η ίδια μορφή σύγκρισης (χωρίς πρόθεμα, τόνους, αποστρόφους). */
function taxOfficeForm(text: string): string {
  return normalizeForLabelMatch(text)
    .replace(/['΄’ʹ`]/g, '')
    // ⚠️ ΟΧΙ `\b`: στη JS το όριο λέξης είναι ΜΟΝΟ λατινικό — το `δου\b` δεν θα ταίριαζε ποτέ.
    .replace(/^\s*δου(?=\s|$)/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface IndexedOffice {
  readonly office: TaxOffice;
  readonly words: readonly string[];
}

const INDEX: readonly IndexedOffice[] = GREEK_TAX_OFFICES.map((office) => ({
  office,
  words: taxOfficeForm(office.name).split(' ').filter(Boolean),
}));

function containsRun(words: readonly string[], run: readonly string[]): boolean {
  for (let start = 0; start + run.length <= words.length; start += 1) {
    if (run.every((word, offset) => words[start + offset] === word)) return true;
  }
  return false;
}

/** Συμφωνεί η ΔΟΥ με κάποιον αποδεδειγμένο τόπο; (περιφέρεια καταλόγου **ή** η λέξη-προσδιορισμός του ονόματός της) */
function agreesWithPlace(entry: IndexedOffice, run: readonly string[], places: readonly string[]): boolean {
  const qualifier = entry.office.name
    .split(/\s+/)
    .filter((word) => !run.includes(taxOfficeForm(word)))
    .join(' ');
  return places.some((place) => samePlaceName(place, entry.office.region) || (qualifier !== '' && samePlaceName(place, qualifier)));
}

/** Ελάχιστο μήκος λέξης αναζήτησης — μία ή καμία γραμματοσειρά δεν περιορίζει τίποτα. */
const MIN_SEARCH_WORD = 2;

/**
 * **Αναζήτηση** (όχι επίλυση): οι ΔΟΥ που περιέχουν **κάθε** λέξη του ερωτήματος ως τμήμα του ονόματος, της περιφέρειας ή
 * του κωδικού («Ιωνία» ⇒ «Ιωνίας Θεσσαλονίκης» **και** «Νέας Ιωνίας»). Για λίστα επιλογών (εργαλείο AI `lookup_doy_code`)·
 * η ίδια κανονικοποίηση με το {@link resolveTaxOfficeCode} — ΜΙΑ γραφή ΔΟΥ σε όλη την εφαρμογή.
 */
export function searchTaxOffices(query: string, limit: number): readonly TaxOffice[] {
  const words = taxOfficeForm(query).split(' ').filter((word) => word.length >= MIN_SEARCH_WORD);
  if (words.length === 0) return [];
  return INDEX.filter((entry) => {
    const text = `${entry.words.join(' ')} ${taxOfficeForm(entry.office.region)} ${entry.office.code}`;
    return words.every((word) => text.includes(word));
  }).slice(0, limit).map((entry) => entry.office);
}

/**
 * Ο κωδικός της **μίας** ΔΟΥ που εννοεί το κείμενο — ή `null` (άγνωστη ή διφορούμενη).
 * @param places τόποι αποδεδειγμένοι από **άλλη** πηγή (π.χ. χάρτης) — μόνο για αποσαφήνιση, ποτέ για εύρεση.
 */
export function resolveTaxOfficeCode(text: string, places: readonly string[] = []): string | null {
  const trimmed = text.trim();
  if (GREEK_TAX_OFFICES.some((office) => office.code === trimmed)) return trimmed;
  const run = taxOfficeForm(trimmed).split(' ').filter(Boolean);
  if (run.length === 0) return null;
  const exact = INDEX.filter((entry) => entry.words.join(' ') === run.join(' '));
  if (exact.length > 0) return exact.length === 1 ? exact[0].office.code : null;
  const candidates = INDEX.filter((entry) => containsRun(entry.words, run));
  if (candidates.length === 1) return candidates[0].office.code;
  const placed = candidates.filter((entry) => agreesWithPlace(entry, run, places));
  return placed.length === 1 ? placed[0].office.code : null;
}
