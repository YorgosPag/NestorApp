/**
 * ADR-651 Φάση Κ (§8 #7) — η **μεταγλώττιση** του περιεχομένου μιας πινακίδας, ως καθαρή
 * συνάρτηση: μηδέν I/O, μηδέν store, μηδέν React ⇒ πλήρως testable.
 *
 * ## Τι αγγίζεται και τι ΔΕΝ αγγίζεται
 *
 * | Κομμάτι | Μεταφράζεται; | Γιατί |
 * |---|---|---|
 * | Στατικές ετικέτες («Έργο:», «ΘΕΩΡΗΘΗΚΕ») | **ναι** | είναι κείμενο του γραφείου |
 * | `{{project.name}}` και κάθε placeholder | **ΠΟΤΕ** | είναι **δεδομένα** — το όνομα του έργου δεν μεταφράζεται |
 * | Ημερομηνίες / αριθμοί / κλίμακα | **ΠΟΤΕ εδώ** | τα μορφοποιεί ο `resolver` από το `scope.formatting.locale` (§5.1) |
 * | Στυλ, ύψη, στοίχιση, γεωμετρία | **ΠΟΤΕ** | η μετάφραση αλλάζει **λέξεις**, όχι σχέδιο |
 *
 * ## Άγνωστος όρος ⇒ μένει ως έχει
 *
 * Ο,τι δεν ξέρει το λεξικό **δεν σβήνεται και δεν μαντεύεται**: επιστρέφεται στον καλούντα ως
 * `unknownTerms` για να τον δει ο χρήστης (και προαιρετικά να τον στείλει στο AI, με ρητή
 * έγκριση). Μια πινακίδα κατατίθεται σε πολεοδομία — σιωπηλή μηχανική μετάφραση απαγορεύεται.
 *
 * @see ./title-block-glossary.ts — από πού βγαίνουν οι όροι (παράγονται από τα presets)
 */

import { isTextRun } from '../../types/text-ast.guards';
import type { DxfTextNode, TextParagraph, TextRun, TextStack } from '../../types/text-ast.types';
import type { TitleBlockLocale } from '../title-block-presets';
import { lookupTitleBlockTerm, splitTitleBlockTerm, titleBlockTermKey } from './title-block-glossary';

/** Τα placeholders ταξιδεύουν **αυτούσια** ⇒ κρατιούνται ως δικά τους κομμάτια στο split. */
const PLACEHOLDER_SPLIT = /(\{\{[^}]*\}\})/g;

function isPlaceholder(segment: string): boolean {
  return segment.startsWith('{{') && segment.endsWith('}}');
}

/**
 * Ο **ένας** περιπατητής του AST. Κάθε κομμάτι κειμένου (ό,τι δεν είναι placeholder) περνά από
 * τη `transform`· ό,τι επιστρέψει γίνεται το νέο κείμενο. Collect / apply / localize είναι
 * απλώς τρεις διαφορετικές `transform` πάνω στον ΙΔΙΟ περιπατητή (N.18: μία μηχανή).
 */
function transformTitleBlockText(
  content: DxfTextNode,
  transform: (core: string) => string,
): DxfTextNode {
  const paragraphs: TextParagraph[] = content.paragraphs.map((paragraph) => {
    const runs: (TextRun | TextStack)[] = paragraph.runs.map((run) => {
      // Ένα stack (`\S`) είναι κλάσμα/ανοχή — αριθμός, όχι λέξη ⇒ ταξιδεύει αυτούσιο.
      if (!isTextRun(run)) return run;
      const text = run.text
        .split(PLACEHOLDER_SPLIT)
        .map((segment) => {
          if (!segment || isPlaceholder(segment)) return segment;
          const { leading, core, trailing } = splitTitleBlockTerm(segment);
          if (!core) return segment;
          return `${leading}${transform(core)}${trailing}`;
        })
        .join('');
      return text === run.text ? run : { ...run, text };
    });
    return { ...paragraph, runs };
  });

  return { ...content, paragraphs };
}

/**
 * Οι **μοναδικές** ετικέτες μιας πινακίδας — αυτό ακριβώς που θα δει ο χρήστης στον πίνακα
 * έγκρισης. Σειρά εμφάνισης (όχι αλφαβητική): ο χρήστης διαβάζει την πινακίδα του από πάνω
 * προς τα κάτω. Διπλοεγγραφές («Ημερομηνία» σε δύο γραμμές) εμφανίζονται **μία** φορά.
 */
export function collectTitleBlockTerms(content: DxfTextNode): readonly string[] {
  const seen = new Set<string>();
  const terms: string[] = [];

  transformTitleBlockText(content, (core) => {
    const key = titleBlockTermKey(core);
    if (key && !seen.has(key)) {
      seen.add(key);
      terms.push(core);
    }
    return core;
  });

  return terms;
}

/**
 * Εφαρμόζει **εγκεκριμένες** μεταφράσεις (λεξικό + AI + χειρόγραφες διορθώσεις του χρήστη) στο
 * περιεχόμενο. Κλειδί = ο όρος όπως τον είδε ο χρήστης· όρος εκτός χάρτη ⇒ **μένει ως έχει**.
 */
export function applyTitleBlockTranslation(
  content: DxfTextNode,
  translations: ReadonlyMap<string, string>,
): DxfTextNode {
  const byKey = new Map<string, string>();
  for (const [term, translation] of translations) {
    if (translation.trim()) byKey.set(titleBlockTermKey(term), translation);
  }
  return transformTitleBlockText(content, (core) => byKey.get(titleBlockTermKey(core)) ?? core);
}

export interface LocalizedTitleBlockContent {
  readonly content: DxfTextNode;
  /** Οι όροι που το λεξικό ΔΕΝ ήξερε — έμειναν αμετάφραστοι, περιμένουν AI ή τον χρήστη. */
  readonly unknownTerms: readonly string[];
}

/**
 * Μεταγλώττιση με **μόνο** το ντετερμινιστικό λεξικό. Ίδια γλώσσα ⇒ ταυτοτικό (idempotent, το
 * ίδιο αντικείμενο περιεχομένου· καμία περιττή εγγραφή).
 */
export function localizeTitleBlockContent(
  content: DxfTextNode,
  from: TitleBlockLocale,
  to: TitleBlockLocale,
): LocalizedTitleBlockContent {
  if (from === to) return { content, unknownTerms: [] };

  const unknownTerms: string[] = [];
  const localized = transformTitleBlockText(content, (core) => {
    const translation = lookupTitleBlockTerm(core, from, to);
    if (translation !== null) return translation;
    unknownTerms.push(core);
    return core;
  });

  return { content: localized, unknownTerms };
}

/**
 * Το κείμενο του κελιού σφραγίδας («ΣΦΡΑΓΙΔΑ / ΥΠΟΓΡΑΦΗ» ⇄ «STAMP / SIGNATURE») — **περιεχόμενο
 * σχεδίου**, ζει έξω από το `content` (`titleBlock.stampLabel`) αλλά μεταφράζεται με το ΙΔΙΟ
 * λεξικό. Άγνωστο/κενό ⇒ ως έχει.
 */
export function localizeTitleBlockLabel(
  label: string,
  from: TitleBlockLocale,
  to: TitleBlockLocale,
): string {
  if (!label.trim() || from === to) return label;
  return lookupTitleBlockTerm(label, from, to) ?? label;
}
