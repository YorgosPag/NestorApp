/**
 * @fileoverview **SSoT: ανάγνωση πηγαίου κώδικα από άγκυρα.**
 * @module test-utils/read-source
 * @related ADR-660 §5.13 · CHECK 3.28 (jscpd) · CHECK 3.50 `Κ7β` (σχόλια)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ΤΟ `stripComments` ΗΤΑΝ ΓΡΑΜΜΕΝΟ **ΔΩΔΕΚΑ** ΦΟΡΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μετρημένο 2026-08-23: **12 αρχεία test** δηλώνουν δικό τους `stripComments`,
 * με δική τους `REPO_ROOT` που μετρά `..` ανάλογα με το βάθος του φακέλου. Είναι
 * η οικογένεια κλώνων που το **N.18 / CHECK 3.28** υπάρχει για να μη μεγαλώνει.
 *
 * ⚠️ **Η μετανάστευση των υπόλοιπων 11 ΔΕΝ έγινε εδώ** — είναι >1h σε 11 αρχεία
 * τεσσάρων τομέων, άρα ανήκει στο `.claude-rules/pending-ratchet-work.md`
 * (κανόνας N.0.2). Αυτό το module υπάρχει ώστε ο **επόμενος** να μην γράψει τον
 * 13ο, και ο μετρητής να κινείται **μόνο προς τα κάτω**.
 *
 * 🔑 **Η `REPO_ROOT` λύνεται ΜΙΑ φορά, εδώ.** Στους κλώνους ζει ως
 * `join(__dirname, '..', '..', '..', '..')` — αριθμός `..` που εξαρτάται από το
 * **βάθος του καλούντος**, δηλαδή σιωπηλά λάθος μόλις μετακινηθεί το test.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** Η ρίζα του αποθετηρίου — `src/test-utils/` είναι δύο επίπεδα κάτω. */
export const REPO_ROOT: string = join(__dirname, '..', '..');

/** Διαβάζει αρχείο με διαδρομή **σχετική με τη ρίζα** (π.χ. `src/lib/x.ts`). */
export function readRepoFile(repoRelativePath: string): string {
  return readFileSync(join(REPO_ROOT, ...repoRelativePath.split('/')), 'utf8');
}

/**
 * Κώδικας **χωρίς σχόλια** — απαίτηση **ορθότητας**, όχι καθαριότητας.
 *
 * 🔴 Μια άγκυρα που ψάχνει συμβολοσειρά και **δεν** κόβει σχόλια κοκκινίζει πάνω
 * στην **τεκμηρίωση της θεραπείας**, και σπρώχνει τον επόμενο να σβήσει το
 * σχόλιο — δηλαδή τη γνώση. Είναι το `Κ7β` της CHECK 3.50, και στο ADR-660 έχει
 * ήδη πληρωθεί **τρεις** φορές (§5.6 · §5.11 · §5.13).
 */
export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** `readRepoFile` + `stripComments` — ό,τι θέλει σχεδόν κάθε άγκυρα. */
export function readRepoCode(repoRelativePath: string): string {
  return stripComments(readRepoFile(repoRelativePath));
}

/**
 * Απαριθμεί αναδρομικά αρχεία πηγαίου κώδικα κάτω από διαδρομή της ρίζας.
 *
 * ⚠️ Επιστρέφει διαδρομές με **κάθετο `/`** ανεξαρτήτως λειτουργικού: σε Windows
 * το `path.join` δίνει `\`, και μια άγκυρα που συγκρίνει με σκληρογραμμένο `/`
 * βγαίνει **πράσινη επειδή δεν βρήκε τίποτα** — το σχήμα «0 = κανείς δεν
 * κοίταξε» (ίδια παγίδα με τα `Π` της CHECK 3.41).
 */
export function listRepoSourceFiles(
  repoRelativeDir: string,
  extensions: readonly string[] = ['.ts', '.tsx'],
): string[] {
  const absoluteRoot = join(REPO_ROOT, ...repoRelativeDir.split('/'));
  const found: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        found.push(relative(REPO_ROOT, full).split(sep).join('/'));
      }
    }
  };

  walk(absoluteRoot);
  return found.sort();
}
