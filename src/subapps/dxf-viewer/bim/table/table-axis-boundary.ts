/**
 * ADR-739 §40 — **ΤΑ ΣΥΝΟΡΑ ΕΝΟΣ ΑΞΟΝΑ**: πού τελειώνει η μία γραμμή/στήλη και αρχίζει η
 * επόμενη, και ποιο από αυτά τα σύνορα είναι πιο κοντά σε ένα σημείο. Καθαρή αριθμητική —
 * μηδέν DOM, μηδέν store, μηδέν React, καμία γνώση για το τι θα γίνει στο σύνορο.
 *
 * ## Γιατί υπάρχει ως ξεχωριστό module
 * Γεννήθηκε ως **εξαγωγή** από το `table-range-insert-boundary.ts` (§40, χειριστήριο ⊕
 * Word-parity) τη στιγμή που η ερώτηση «*ποιο σύνορο είναι πιο κοντά;*» απέκτησε **δεύτερο**
 * καταναλωτή — και η εξαγωγή έγινε **πριν** γραφτεί ο δεύτερος, όχι αφού. Ο πρώτος τη ρωτά
 * για τη **σύρση περιοχής** (πού προσγειώνεται ό,τι κρατά το χέρι), ο δεύτερος για την
 * **εισαγωγή** (πού μπαίνει η νέα γραμμή/στήλη). Δύο εντελώς διαφορετικές πράξεις πάνω στην
 * ίδια ακριβώς αριθμητική.
 *
 * Ένα αντίγραφο του βρόχου θα ήταν sibling clone (N.18 / CHECK 3.28) — αλλά το σοβαρό δεν
 * είναι το CHECK: είναι ότι τα δύο αντίγραφα **σπάνε την ισοπαλία αλλιώς**. Το σύνορο στο
 * ακριβές μέσο μιας γραμμής απέχει εξίσου και από τα δύο του γείτονα· αν ο ένας καταναλωτής
 * διάλεγε το προηγούμενο και ο άλλος το επόμενο, το ⊕ θα ζωγραφιζόταν σε **άλλο** σύνορο από
 * εκείνο όπου προσγειώνεται η σύρση — στην ίδια θέση ποντικιού, στο ίδιο καρέ.
 *
 * ## Το σύστημα συντεταγμένων
 * Οι θέσεις είναι sheet-mm του πλαισίου του πίνακα, με αρχή την πάνω-αριστερή γωνία του
 * **πλέγματος**. Ένας άξονας με `n` υποδιαιρέσεις έχει **`n + 1` σύνορα**: το `line === 0`
 * είναι «πριν από την πρώτη», το `line === n` «μετά την τελευταία». Δεν φιλτράρεται κανένα
 * εδώ — η άρνηση ανήκει σε όποιον ξέρει τι θα κάνει στο σύνορο, όχι στη γεωμετρία.
 *
 * @module subapps/dxf-viewer/bim/table/table-axis-boundary
 * @see bim/table/table-range-insert-boundary.ts — ο πρώτος καταναλωτής (σύρση περιοχής)
 * @see bim/table/table-insert-control.ts — ο δεύτερος (το ⊕ του §40)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §36, §40
 */

import type { TableLayout } from './table-layout-types';

/**
 * Ένας άξονας, ιδωμένος **μόνο** ως ακολουθία συνόρων.
 *
 * Ο προσπελαστής είναι συνάρτηση αντί για πίνακα αριθμών ώστε να μη χτίζεται πίνακας `n`
 * στοιχείων ανά κίνηση ποντικιού — και ώστε ο **ίδιος** κώδικας να εξυπηρετεί γραμμές (`yMm`)
 * και στήλες (`xMm`), που έχουν διαφορετικά ονόματα πεδίων.
 */
export interface TableAxisBoundaryView {
  /** Πλήθος **υποδιαιρέσεων** (γραμμών ή στηλών) — τα σύνορα είναι ένα παραπάνω. */
  readonly count: number;
  /** Η αρχή της υποδιαίρεσης `index`, σε sheet-mm. Αύξουσα εξ ορισμού της διάταξης. */
  readonly startMm: (index: number) => number;
  /** Το τέλος του άξονα — δηλαδή το **τελευταίο** σύνορο (`line === count`). */
  readonly endMm: number;
}

/** Το πλησιέστερο σύνορο, με την απόστασή του και τη **θέση** του. */
export interface TableAxisNearestBoundary {
  /** Δείκτης **συνόρου** στο `[0, count]` — ποτέ δείκτης υποδιαίρεσης. */
  readonly line: number;
  readonly distanceMm: number;
  /** Η θέση του συνόρου σε sheet-mm — ό,τι χρειάζεται ο ζωγράφος χωρίς δεύτερη αναζήτηση. */
  readonly atMm: number;
}

/** Οι στήλες ως ακολουθία συνόρων (κατακόρυφες γραμμές του πλέγματος). */
export function tableColumnBoundaryView(layout: TableLayout): TableAxisBoundaryView {
  return {
    count: layout.columns.length,
    startMm: (index) => layout.columns[index].xMm,
    endMm: layout.widthMm,
  };
}

/** Οι γραμμές ως ακολουθία συνόρων (οριζόντιες γραμμές του πλέγματος). */
export function tableRowBoundaryView(layout: TableLayout): TableAxisBoundaryView {
  return {
    count: layout.rows.length,
    startMm: (index) => layout.rows[index].yMm,
    endMm: layout.heightMm,
  };
}

/**
 * Η θέση ενός συνόρου σε sheet-mm. Το `line === count` είναι το **τέλος** του άξονα, όχι
 * σφάλμα ορίων: υπάρχουν `n + 1` σύνορα και το τελευταίο δεν έχει δική του υποδιαίρεση.
 */
export function tableAxisBoundaryMm(view: TableAxisBoundaryView, line: number): number {
  return line < view.count ? view.startMm(line) : view.endMm;
}

/**
 * 🔴 **ΠΟΙΟ ΣΥΝΟΡΟ ΕΙΝΑΙ ΠΙΟ ΚΟΝΤΑ** σε αυτή τη θέση.
 *
 * Δυαδική αναζήτηση και **όχι** γραμμική σάρωση: η ερώτηση γίνεται σε **κάθε κίνηση
 * ποντικιού** (60-120/δευτ.) και ένας πίνακας 500 γραμμών θα πλήρωνε 500 συγκρίσεις κάθε
 * φορά — ακριβώς το «δουλειά ανάλογη του μεγέθους, όχι της αλλαγής» που ο **ADR-735** πλήρωσε
 * σε παραγωγή. Ίδιο μοτίβο με το `visibleRowRange`, σε **έναν** βρόχο αντί για δύο.
 *
 * ⚠️ Στο **ακριβές μέσο** μιας υποδιαίρεσης τα δύο σύνορά της απέχουν εξίσου· νικά το
 * **επόμενο** (`<` και όχι `<=`). Η επιλογή είναι αδιάφορη ως προς την ορθότητα και
 * καθοριστική ως προς τη **σταθερότητα**: το πάνω μισό δίνει αυστηρά το πάνω σύνορο και το
 * υπόλοιπο το κάτω, χωρίς ζώνη όπου η απάντηση κρίνεται από αριθμητικό σφάλμα. Δες την
 * κεφαλίδα για το τι θα σήμαινε να σπάσουν δύο αντίγραφα την ισοπαλία αλλιώς.
 */
export function nearestTableAxisBoundary(
  view: TableAxisBoundaryView,
  atMm: number,
): TableAxisNearestBoundary {
  // Το πρώτο σύνορο που δεν είναι πριν από το σημείο. Τα σύνορα είναι αύξοντα εξ ορισμού της
  // διάταξης (`yMm`/`xMm` αύξοντα, μη αρνητικά ύψη/πλάτη).
  let lo = 0;
  let hi = view.count;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (tableAxisBoundaryMm(view, mid) < atMm) lo = mid + 1;
    else hi = mid;
  }

  const after = tableAxisBoundaryMm(view, lo);
  const afterDistance = Math.abs(after - atMm);
  if (lo === 0) return { line: 0, distanceMm: afterDistance, atMm: after };

  const before = tableAxisBoundaryMm(view, lo - 1);
  const beforeDistance = Math.abs(atMm - before);
  return beforeDistance < afterDistance
    ? { line: lo - 1, distanceMm: beforeDistance, atMm: before }
    : { line: lo, distanceMm: afterDistance, atMm: after };
}
