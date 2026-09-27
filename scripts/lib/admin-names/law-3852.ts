/**
 * @fileoverview **Ο ΝΟΜΟΣ ΩΣ ΠΗΓΗ ΤΟΝΩΝ** — ν. 3852/2010 (Καλλικράτης), άρθρο 1 — ADR-893.
 * @related `greek-orthography.ts` (καθάρισμα OCR) · `resolve-display-names.ts` (καταναλωτής)
 *
 * 🔑 **ΓΙΑΤΙ Ο ΝΟΜΟΣ ΚΑΙ ΟΧΙ ΚΑΠΟΙΟ ΜΗΤΡΩΟ**: η ΕΛΣΤΑΤ και το ΥΠΕΣ γράφουν τις βαθμίδες 3–6
 * **κεφαλαία χωρίς τόνους**· το Wikidata έχει τόνους αλλά και **λάθη** (μετρημένο: `Νίκαιας` για
 * τη **δημοτική ενότητα**, που ο νόμος γράφει `Νικαίας` — τον παλιό δήμο). Ο νόμος **συστήνει**
 * τους δήμους και **ονομάζει** τις δημοτικές τους ενότητες («αποτελούμενος από τους δήμους α. …»),
 * άρα είναι η αυθεντία και για τα δύο επίπεδα.
 *
 * ⚖️ **Άδεια**: τα επίσημα κείμενα νόμων εξαιρούνται από την προστασία (ν. 2121/1993 άρθρο 2 §5).
 * Η πηγή είναι η Βικιθήκη (μεταγραφή του ΦΕΚ Α' 87/07.06.2010).
 *
 * ⚠️ Το κείμενο είναι **OCR** — γι' αυτό κάθε όνομα που βγαίνει από εδώ περνά από τον έλεγχο
 * μονοτονικού πριν γίνει δεκτό. Ο αναλυτής **δεν** διορθώνει τόνους· μόνο ξεχωρίζει ονόματα.
 */

import { cleanOcrText } from './greek-orthography';

/** Η Βικιθήκη αποδίδει ολόκληρο το ΦΕΚ ως HTML με `action=render`. */
export const LAW_3852_SOURCE = {
  id: 'law-3852-2010',
  url: 'https://el.wikisource.org/w/index.php?title=%CE%9D%CF%8C%CE%BC%CE%BF%CF%82_3852/2010&action=render',
  title: 'ν. 3852/2010 (ΦΕΚ Α\' 87/07.06.2010), άρθρο 1 — μεταγραφή Βικιθήκης',
  license: 'Επίσημο κείμενο νόμου — εκτός προστασίας (ν. 2121/1993 άρθρο 2 §5)',
} as const;

/** Ένας δήμος όπως τον συστήνει ο νόμος, με τους παλιούς δήμους/κοινότητες που τον αποτελούν. */
export interface LawMunicipality {
  readonly name: string;
  /** Τα ονόματα των **δημοτικών ενοτήτων** του (οι καταργούμενοι δήμοι και κοινότητες). */
  readonly units: readonly string[];
}

export interface Law3852 {
  readonly municipalities: readonly LawMunicipality[];
  /** Δήμοι που ο νόμος **διατηρεί** («Στο δήμο Χ δεν επέρχεται καμία μεταβολή»). */
  readonly unchanged: readonly string[];
}

/** HTML → απλό κείμενο μίας γραμμής, καθαρισμένο από τα σφάλματα της σάρωσης. */
export function lawHtmlToText(html: string): string {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#160;|&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
  return cleanOcrText(text).replace(/\s+/g, ' ');
}

/** Το άρθρο 1 — από την επικεφαλίδα του ως το άρθρο 2. Κενό αν δεν βρεθεί (η αναφορά θα το πει). */
function articleOne(text: string): string {
  const start = text.indexOf('Άρθρο 1 ');
  if (start < 0) return '';
  const end = text.indexOf('Άρθρο 2 ', start + 8);
  return text.slice(start, end < 0 ? undefined : end);
}

const MUNICIPALITY_CLAUSE = /\d+\.\s+Δήμος\s+(.+?)\s+με\s+έδρα(.*?)(?=\s\d+\.\s+Δήμος\s|\s\d+\.\s+ΝΟΜΟΣ\s|\s[Α-Ω]\.\s|$)/gu;
const COMPOSITION = /αποτελούμενος\s+από\s+(.*?)(?:,?\s+οι\s+οποί(?:οι|ες)\s+καταργούνται|$)/u;
const GROUP_SPLIT = /\s+και\s+(?:τις\s+κοινότητες|την\s+κοινότητα|τους\s+δήμους|τον\s+δήμο)\s+/u;
const GROUP_HEAD = /^(?:τους\s+δήμους|τις\s+κοινότητες|την\s+κοινότητα|τον\s+δήμο|το\s+δήμο)\s+/u;
/** Ο απαριθμητής της λίστας: `α.` … `ιθ.` — ένα ή δύο πεζά γράμματα με τελεία. */
const ENUMERATOR = /(?:^|\s)[α-ω]{1,2}\.\s*/u;

/** «τους δήμους α. Αιγείρου β. Κομοτηνής και γ. Νέου Σιδηροχωρίου» → τα τρία ονόματα. */
export function splitEnumeration(list: string): readonly string[] {
  return list
    .replace(GROUP_HEAD, '')
    .split(ENUMERATOR)
    .map((part) => part.replace(/\s+και$/u, '').replace(/[,.;]+$/u, '').trim())
    .filter((part) => part.length > 0);
}

function unitsOf(body: string): readonly string[] {
  const composition = body.match(COMPOSITION);
  if (!composition) return [];
  return composition[1].split(GROUP_SPLIT).flatMap(splitEnumeration);
}

/** Αναλύει το άρθρο 1 του νόμου από το απλό του κείμενο. */
export function parseLaw3852(text: string): Law3852 {
  const article = articleOne(text);
  const municipalities = [...article.matchAll(MUNICIPALITY_CLAUSE)].map((match) => ({
    name: match[1].trim(),
    units: unitsOf(match[2]),
  }));
  const unchanged = [...article.matchAll(/Στο\s+δήμο\s+(.+?)\s+δεν\s+επέρχεται/gu)].map((match) => match[1].trim());
  return { municipalities, unchanged };
}
