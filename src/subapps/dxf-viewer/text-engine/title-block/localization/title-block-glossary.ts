/**
 * ADR-651 Φάση Κ (§8 #7) — το **λεξικό όρων** πινακίδας EL↔EN.
 *
 * ## Το λεξικό δεν γράφεται· **παράγεται**
 *
 * Οι ίδιοι όροι («Έργο/Project», «Κλίμακα/Scale», «Α.Μ. ΤΕΕ/Licence No») είναι **ήδη**
 * γραμμένοι δύο φορές: μία σε κάθε γλωσσική εκδοχή των built-in presets (`title-blocks.ts`,
 * Φάση Γ). Ένα χειρόγραφο `const GLOSSARY = { 'Έργο': 'Project', … }` θα ήταν **τρίτο**
 * αντίγραφο των ίδιων ζευγαριών — και την πρώτη φορά που κάποιος διόρθωνε ένα preset, το
 * λεξικό θα έλεγε σιωπηλά ψέματα (N.18).
 *
 * Αντ' αυτού ζευγαρώνουμε τα preset **κατά θέση**: η ν-οστή παράγραφος του ελληνικού προτύπου
 * λέει ό,τι και η ν-οστή του αγγλικού. Αφαιρώντας τα `{{placeholders}}` (που είναι **δεδομένα**,
 * ποτέ κείμενο) μένουν οι ετικέτες — και το ζευγάρι τους ΕΙΝΑΙ το λεξικό. Μία πηγή, μηδέν
 * συντήρηση: προσθέτει κανείς πεδίο σε preset ⇒ το λεξικό το μαθαίνει μόνο του.
 *
 * ## Ταίριασμα ανεξάρτητο από πεζά/κεφαλαία/τόνους
 *
 * Ένα αποθηκευμένο ή AI πρότυπο γράφει «ΕΡΓΟ:», «Έργο:» ή «έργο:» αδιάκριτα. Το κλειδί
 * κανονικοποιείται (NFD → αφαίρεση τόνων → κεφαλαία) ⇒ και τα τρία βρίσκουν τον ίδιο όρο.
 *
 * @see ./localize-title-block.ts — ο καταναλωτής (ο περιπατητής του AST)
 */

import { TITLE_BLOCK_PRESETS, type TitleBlockLocale } from '../title-block-presets';
import { isTextRun } from '../../types/text-ast.guards';
import type { DxfTextNode } from '../../types/text-ast.types';

/** Ό,τι είναι μέσα σε `{{…}}` είναι **δεδομένο**, όχι κείμενο — δεν μεταφράζεται ΠΟΤΕ. */
const PLACEHOLDER_PATTERN = /\{\{[^}]*\}\}/g;

/** Τα σημεία στίξης/κενά που πλαισιώνουν μια ετικέτα («Έργο: ») — γλωσσικά ουδέτερα. */
const TERM_SHELL_PATTERN = /^(\s*)(.*?)([\s:.\-–—]*)$/;

/**
 * Το κλειδί αναζήτησης ενός όρου: χωρίς τόνους, χωρίς πεζά/κεφαλαία, χωρίς διπλά κενά.
 * «ΕΡΓΟ» === «Έργο» === «έργο» — ο μηχανικός δεν χρωστά συνέπεια στο πληκτρολόγιό του.
 */
export function titleBlockTermKey(term: string): string {
  return term
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/** Ο πυρήνας μιας ετικέτας χωρίς το «κέλυφός» της (κενά + `:` γύρω του). */
export interface TitleBlockTermShell {
  readonly leading: string;
  readonly core: string;
  readonly trailing: string;
}

/** «  Έργο:  » → `{ leading: '  ', core: 'Έργο', trailing: ':  ' }`. Ποτέ δεν αποτυγχάνει. */
export function splitTitleBlockTerm(literal: string): TitleBlockTermShell {
  const match = TERM_SHELL_PATTERN.exec(literal);
  if (!match) return { leading: '', core: literal, trailing: '' };
  return { leading: match[1] ?? '', core: match[2] ?? '', trailing: match[3] ?? '' };
}

/** Τα κομμάτια **κειμένου** ενός run — ό,τι μένει αφού βγουν τα placeholders. */
function literalSegments(text: string): readonly string[] {
  return text.split(PLACEHOLDER_PATTERN);
}

/** Όλο το κείμενο μιας παραγράφου (τα runs μπορεί να σπάνε μια ετικέτα στη μέση). */
function paragraphText(node: DxfTextNode, index: number): string | null {
  const paragraph = node.paragraphs[index];
  if (!paragraph) return null;
  // Μόνο τα text runs: ένα stack (`\S`) είναι κλάσμα, όχι όρος προς ζευγάρωμα.
  return paragraph.runs.filter(isTextRun).map((run) => run.text).join('');
}

type MutableGlossary = Map<string, string>;

/**
 * Ζευγαρώνει τα literals **μιας** παραγράφου των δύο γλωσσών. Αν τα κομμάτια δεν είναι ίσα σε
 * πλήθος, η παράγραφος **αγνοείται**: προτιμούμε λεξικό με λιγότερους όρους από λεξικό με
 * λάθος όρους (ένα λάθος ζευγάρι εδώ ταξιδεύει σε **κατατεθειμένο** σχέδιο).
 */
function pairParagraph(source: string, target: string, glossary: MutableGlossary): void {
  const sourceParts = literalSegments(source);
  const targetParts = literalSegments(target);
  if (sourceParts.length !== targetParts.length) return;

  for (let index = 0; index < sourceParts.length; index += 1) {
    const from = splitTitleBlockTerm(sourceParts[index] ?? '').core;
    const to = splitTitleBlockTerm(targetParts[index] ?? '').core;
    if (!from || !to) continue;
    const key = titleBlockTermKey(from);
    if (!glossary.has(key)) glossary.set(key, to);
  }
}

/** Το λεξικό μιας κατεύθυνσης, παραγμένο ΜΙΑ φορά από τα presets (module-level, immutable). */
function deriveGlossary(from: TitleBlockLocale, to: TitleBlockLocale): ReadonlyMap<string, string> {
  const glossary: MutableGlossary = new Map();

  for (const preset of TITLE_BLOCK_PRESETS) {
    const source = preset.templates[from].content;
    const target = preset.templates[to].content;
    const count = Math.min(source.paragraphs.length, target.paragraphs.length);

    for (let index = 0; index < count; index += 1) {
      const sourceText = paragraphText(source, index);
      const targetText = paragraphText(target, index);
      if (sourceText === null || targetText === null) continue;
      pairParagraph(sourceText, targetText, glossary);
    }

    // Το κείμενο του κελιού σφραγίδας είναι ΠΕΡΙΕΧΟΜΕΝΟ σχεδίου («ΣΦΡΑΓΙΔΑ / ΥΠΟΓΡΑΦΗ» ⇄
    // «STAMP / SIGNATURE») και ζει έξω από το content ⇒ μπαίνει ρητά στο ίδιο λεξικό.
    const sourceStamp = preset.stampLabel[from];
    const targetStamp = preset.stampLabel[to];
    if (sourceStamp && targetStamp) {
      const key = titleBlockTermKey(sourceStamp);
      if (!glossary.has(key)) glossary.set(key, targetStamp);
    }
  }

  return glossary;
}

const GLOSSARIES: Readonly<Record<string, ReadonlyMap<string, string>>> = {
  'el>en': deriveGlossary('el', 'en'),
  'en>el': deriveGlossary('en', 'el'),
};

/**
 * Ο μεταφρασμένος όρος, ή `null` αν το λεξικό δεν τον ξέρει.
 *
 * `null` **δεν** είναι σφάλμα: είναι το σήμα «ρώτα αλλού» (AI) ή «άσε τον ως έχει». Ένας
 * άγνωστος όρος **ποτέ** δεν σβήνεται και ποτέ δεν μαντεύεται σιωπηλά.
 */
export function lookupTitleBlockTerm(
  term: string,
  from: TitleBlockLocale,
  to: TitleBlockLocale,
): string | null {
  if (from === to) return term;
  return GLOSSARIES[`${from}>${to}`]?.get(titleBlockTermKey(term)) ?? null;
}

/** Πόσους όρους ξέρει το λεξικό σε αυτή την κατεύθυνση (tests + διαγνωστικά). */
export function titleBlockGlossarySize(from: TitleBlockLocale, to: TitleBlockLocale): number {
  return GLOSSARIES[`${from}>${to}`]?.size ?? 0;
}
