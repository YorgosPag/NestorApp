/**
 * @fileoverview Λ1β — οι **επαναλαμβανόμενες** ενότητες: γραμμές, όχι βαθμωτά (ADR-759 Φ4β).
 *
 * ```
 *   γραμμές ενότητας ─▶ ποιες είναι γραμμές λίστας ─▶ ένωση ─▶ σε ποια λίστα ─▶ μέρη
 * ```
 *
 * 🔴 **Ο βαθμωτός αναγνώστης δεν μπορούσε να το κάνει, και ο λόγος είναι μία γραμμή κώδικα:**
 * το `readOneDocument` κάνει `break` μετά την πρώτη επιτυχή κοπή — *ένα πεδίο ανά κανόνα*. Μια
 * λίστα θέλει το αντίθετο: **όλες** τις γραμμές. Ό,τι άλλο όμως μοιράζεται: η εύρεση της
 * ετικέτας και η κοπή της τιμής είναι **οι ίδιες** συναρτήσεις (`document-body-sites.ts`),
 * απλώς εφαρμοσμένες σε **μία γραμμή** αντί για ολόκληρη ενότητα.
 *
 * @see ADR-759 §2β.7 — οι πραγματικές γραμμές των Α′/Θ/Ι
 * @module lib/document-body/read-document-body-lists
 */

import type {
  BodyRowMatch,
  DocumentBodyListRule,
  DocumentBodyProfile,
} from '@/config/document-body-vocabulary';
import type {
  DocumentBodyListKey,
  DocumentBodyListRow,
  DocumentBodyRowPart,
} from '@/types/document-body-reading';
import { containsWordSequence, splitIntoWords } from '@/utils/greek-text';
import { cut, findSites, phraseOf, segmentsOf } from './document-body-sites';

/** Οι γραμμές που συνθέτουν **μία** γραμμή λίστας, μαζί με τη στήλη που τις ταυτοποιεί. */
interface RowLines {
  readonly lines: readonly string[];
  /** Η στήλη της σημαδούρας· `-1` όταν δεν υπάρχει σημαδούρα (ενότητες Θ/Ι). */
  readonly column: number;
}

/** Έχει η γραμμή **ετικέτα**, δηλαδή περιεχόμενο στην πρώτη της στήλη; */
function isLabeled(line: string): boolean {
  return splitIntoWords(segmentsOf(line)[0] ?? '').length > 0;
}

/** Σε ποια στήλη κάθεται η σημαδούρα· `-1` όταν δεν τη φέρει η γραμμή. */
function markerColumn(line: string, marker: string): number {
  const phrase = phraseOf(marker);
  if (phrase.length === 0) return -1;
  return segmentsOf(line).findIndex((segment) =>
    containsWordSequence(splitIntoWords(segment), phrase),
  );
}

/**
 * Οι γραμμές μιας ενότητας ⇒ οι **γραμμές λίστας** της.
 *
 * 🔴 **Η ένωση κατά στήλη είναι η απόφαση της Φ4β** (ADR-759 §4.10). Ανώνυμη γραμμή ενώνεται
 * με την προηγούμενη **μόνο** όταν η σημαδούρα της κάθεται στην **ίδια στήλη** — αλλιώς
 * ανοίγει δική της. Στο G753 αυτό στέλνει τη γραμμή 06 στην 07 (στήλη 5 και οι δύο) και όχι
 * στην 05 (στήλη 2), που είναι η **σωστή** πράξη· και το πετυχαίνει χωρίς να διαβάσει καμία
 * λέξη — άρα χωρίς να μοντελοποιήσει την αλυσίδα διόρθωσης, που το Q3 απαγορεύει.
 *
 * ⚠️ Η **ετικέτα κερδίζει πάντα**: γραμμή με περιεχόμενο στην πρώτη της στήλη ανοίγει νέα
 * πράξη ό,τι στήλη κι αν έχει η σημαδούρα της. Χωρίς αυτό, η γραμμή `Γ.Π.Σ.` — που φέρει το
 * ΦΕΚ της στην **ίδια** στήλη 5 με τις 06/07 — θα ρουφιόταν μέσα τους.
 */
function selectRows(lines: readonly string[], rows: BodyRowMatch): readonly RowLines[] {
  if (rows.per === 'line') {
    return lines
      .filter((line) => splitIntoWords(line).length > 0)
      .map((line) => ({ lines: [line], column: -1 }));
  }

  const selected: { lines: string[]; column: number }[] = [];
  for (const line of lines) {
    const column = markerColumn(line, rows.marker);
    if (column < 0) continue;

    const open = selected[selected.length - 1];
    if (open && !isLabeled(line) && open.column === column) {
      open.lines.push(line);
      continue;
    }
    selected.push({ lines: [line], column });
  }
  return selected;
}

/** Σε ποια λίστα ανήκει η γραμμή: το πρώτο όνομα που λέει η ίδια, αλλιώς το υπόλοιπο. */
function listOf(text: string, rule: DocumentBodyListRule): DocumentBodyListKey {
  const words = splitIntoWords(text);
  const named = rule.named?.find((route) =>
    route.phrases.some((phrase) => containsWordSequence(words, phraseOf(phrase))),
  );
  return named?.list ?? rule.list;
}

/**
 * Τα μέρη μιας γραμμής.
 *
 * ⚠️ **Δεν υπάρχει `break`** — σε αντίθεση με τον βαθμωτό αναγνώστη. Ένας κανόνας μέρους
 * μπορεί να δώσει **περισσότερες από μία** τιμές (τα δύο ΦΕΚ της γραμμής `Γ.Π.Σ.`), και η
 * δεύτερη δεν είναι εφεδρεία της πρώτης: είναι **άλλο ΦΕΚ**.
 */
function partsOf(rowText: string, rule: DocumentBodyListRule): readonly DocumentBodyRowPart[] {
  const lines = [rowText];
  const parts: DocumentBodyRowPart[] = [];

  for (const partRule of rule.parts) {
    for (const site of findSites(partRule.match, lines)) {
      const values = cut(site, partRule.take);
      if (values.length === 0) continue;
      for (const rawValue of values) parts.push({ part: partRule.part, rawValue });
      // Η **πρώτη θέση που δίνει τιμή** κερδίζει — ίδιος κανόνας με τα βαθμωτά, ώστε μια
      // δεύτερη εμφάνιση της ετικέτας να μην προσθέτει φάντασμα δεύτερης τιμής.
      break;
    }
  }
  return parts;
}

/** Οι γραμμές όλων των επαναλαμβανόμενων ενοτήτων ενός εγγράφου, με τη σειρά του εγγράφου. */
export function readListRows(
  linesOf: (sectionId: string) => readonly string[],
  profile: DocumentBodyProfile,
): DocumentBodyListRow[] {
  const rows: DocumentBodyListRow[] = [];

  for (const rule of profile.listRules ?? []) {
    for (const row of selectRows(linesOf(rule.section), rule.rows)) {
      const rawText = row.lines.join(' ');
      rows.push({ list: listOf(rawText, rule), rawText, parts: partsOf(rawText, rule) });
    }
  }
  return rows;
}
