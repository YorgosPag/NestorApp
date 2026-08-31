/**
 * 🔴 ADR-833 §5.7.5 — **η απαρίθμηση, σε λόγο ανθρώπου**: ευρήματα → γραμμές διαλόγου.
 *
 * ## Γιατί καθαρή συνάρτηση και όχι JSX μέσα στον διάλογο
 * Ίδιο κριτήριο με το `workbook-to-worksheet-drafts` και το `table-double-click-gesture`: η
 * **απόφαση** (ποιες βαθμίδες εμφανίζονται, με ποια σειρά, τι λέει η καθεμιά) δεν χρειάζεται
 * React, και μέσα σε component θα ήταν δοκιμάσιμη μόνο μέσα από ολόκληρο render — δηλαδή
 * πρακτικά καθόλου. Ο διάλογος κρατά το `t` και το `<ul>`· τα υπόλοιπα ζουν εδώ.
 *
 * ## Γιατί δέχεται τον μεταφραστή ως όρισμα, ενώ το `table-worksheet-name` **δεν** δέχεται
 * Δεν είναι αντίφαση, είναι το ίδιο κριτήριο με αντίθετη απάντηση: εκεί ο **μοναδικός δυνατός**
 * καλών είναι ο imperative ζωγράφος του καμβά, που δεν έχει `t` και θα το έφτιαχνε ρωτώντας το
 * ίδιο singleton — δηλαδή θα ήταν «νεκρή παράμετρος με μία δυνατή τιμή». Εδώ ο καλών **έχει**
 * ήδη `t` από το `useTranslation`, και μια ανάγνωση του singleton θα παρέκαμπτε το κέλυφος
 * αντί να το ακολουθήσει.
 *
 * @module subapps/dxf-viewer/ui/table-xlsx/xlsx-unsupported-groups
 * @see bim/table/import/xlsx-unsupported-scan.ts — ποιος μετρά, και ποιο είναι το όριό του
 */

import type {
  XlsxUnsupportedFinding,
  XlsxUnsupportedTier,
} from '../../bim/table/import/xlsx-unsupported-scan';
import type { TableWarningDetailGroup } from '../dialogs/TableWarningConfirmDialog';

/** Ο μεταφραστής όπως τον δίνει το `useTranslation` — μόνο ό,τι χρειάζεται αυτό το αρχείο. */
export type UnsupportedTranslator = (key: string, options?: { readonly count: number }) => string;

/** Το πρόθεμα των κλειδιών· γραμμένο **μία** φορά, όχι σε κάθε κλήση. */
const KEY_PREFIX = 'tableXlsx.unsupported';

/**
 * Η σειρά των βαθμίδων: **πρώτα ό,τι δεν θα λειτουργήσει**.
 *
 * Είναι η σειρά του Compatibility Checker του Excel και δεν είναι αισθητική: ο χρήστης διαβάζει
 * από πάνω προς τα κάτω και σταματά όταν πειστεί, οπότε το ακριβότερο εύρημα οφείλει να είναι
 * το πρώτο που συναντά.
 */
const TIER_ORDER: readonly XlsxUnsupportedTier[] = ['functionality', 'fidelity'];

/**
 * **Οι ομάδες που θα δει ο άνθρωπος** — μόνο όσες έχουν περιεχόμενο.
 *
 * ⚠️ Το `limit` μπαίνει **πάντα** όταν υπάρχει έστω ένα εύρημα, και είναι η γραμμή που κρατά
 * την απαρίθμηση ειλικρινή: ο `exceljs` δεν αναλύει καθόλου γραφήματα και συγκεντρωτικούς
 * πίνακες, άρα η λίστα λέει *«όσα βλέπει ο αναγνώστης»* και **ποτέ** *«όλα όσα έχει το
 * αρχείο»*. Χωρίς αυτήν, μια σιωπηλή απώλεια θα κρυβόταν πίσω από μια λίστα που **μοιάζει**
 * πλήρης — ακριβώς η υπόσχεση που το §5.6.5 απαγόρευσε.
 */
export function xlsxUnsupportedGroups(
  findings: readonly XlsxUnsupportedFinding[],
  t: UnsupportedTranslator,
): readonly TableWarningDetailGroup[] {
  if (findings.length === 0) return [];
  const groups: TableWarningDetailGroup[] = [];

  for (const tier of TIER_ORDER) {
    const items = findings
      .filter((finding) => finding.tier === tier)
      .map((finding) => t(`${KEY_PREFIX}.${finding.key}`, { count: finding.count }));
    if (items.length > 0) {
      groups.push({ title: t(`${KEY_PREFIX}.${tier}Title`), items });
    }
  }

  groups.push({ title: '', items: [t(`${KEY_PREFIX}.limit`)] });
  return groups;
}

/**
 * Η **μία γραμμή** για τη διαδρομή που δεν ρωτά («Εισαγωγή αρχείου»).
 *
 * 🔴 Δεν λείπει διάλογος από εκεί κατά λάθος: η «Εισαγωγή» **δεν αγγίζει τίποτα υπάρχον**, άρα
 * δεν έχει τι να ρωτήσει. Ο κανόνας όμως («καμία σιωπηλή απώλεια») δεν εξαρτάται από το αν
 * υπάρχει διάλογος — οπότε η απαρίθμηση ταξιδεύει από το **ίδιο κανάλι** που ήδη λέει τι δεν
 * χώρεσε (`tableXlsx.clipped`), και όχι από δεύτερο μηχανισμό ειδοποίησης.
 *
 * `''` όταν δεν υπάρχει τίποτα να ειπωθεί — ο καλών δεν στέλνει άδειο μήνυμα.
 */
export function xlsxUnsupportedSummary(
  findings: readonly XlsxUnsupportedFinding[],
  t: UnsupportedTranslator,
): string {
  if (findings.length === 0) return '';
  return findings
    .map((finding) => t(`${KEY_PREFIX}.${finding.key}`, { count: finding.count }))
    .join(' · ');
}
