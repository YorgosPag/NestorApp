/**
 * wall-end-cuts — το ΕΝΑ φράγμα αναστροφής για τα δύο κοψίματα άκρων ενός ευθύγραμμου τοίχου
 * (ADR-911 Φ3α-3, ADR-363 §end-cut-guard).
 *
 * Ένας τοίχος που ενώνεται και στα δύο άκρα του κόβεται δύο φορές πάνω στον ΙΔΙΟ άξονα. Το
 * ερώτημα «αναστρέφεται;» αφορά επομένως το ΑΘΡΟΙΣΜΑ των δύο κοψιμάτων έναντι του μήκους, όχι
 * κάθε άκρο χωριστά. Το παλιό όριο (`MAX_BEVEL_FRACTION`, 40 % ανά άκρο) απαντούσε σε άλλη
 * ερώτηση: δεν έβλεπε το απέναντι άκρο, άρα έκοβε νόμιμες ενώσεις (κοντός βραχίονας σε χοντρό
 * γείτονα έμενε με υπόλοιπο ΜΕΣΑ στον γείτονα) χωρίς να χρειάζεται. Πρακτική Revit: ο βραχίονας
 * butt τελειώνει πάντα στην παρειά.
 *
 * Κανόνας: όσο τα δύο κοψίματα αφήνουν σώμα (`start + end < length − minBody`) περνούν
 * ΑΥΤΟΥΣΙΑ. Αλλιώς ο τοίχος δεν έχει σώμα έξω από τους γείτονές του (`swallowed`): τα κοψίματα
 * μικραίνουν ΑΝΑΛΟΓΙΚΑ ώστε να μείνει ακριβώς `minBody`, στο σημείο όπου θα συναντιόνταν. Ο
 * άξονας δεν αναστρέφεται ποτέ, και το αποτέλεσμα είναι συνεχές στο κατώφλι.
 *
 * Δύο καταναλωτές, ένας κανόνας:
 *   · `wall-geometry.ts` (`applyAxisBevels`) — η γεωμετρία που ζωγραφίζεται και μετριέται.
 *   · `placement/wall-join-overlap.ts` — η κρίση «ο τοίχος καταπίνεται από τον γείτονα».
 *
 * ΚΑΘΑΡΟ (pure) — zero imports.
 */

/** Τα δύο κοψίματα όπως εφαρμόζονται, και αν ο τοίχος έμεινε χωρίς δικό του σώμα. */
export interface OpposingEndCuts {
  readonly start: number;
  readonly end: number;
  /** `true` ⇔ τα ζητούμενα κοψίματα δεν άφηναν σώμα (≥ `length − minBody`). */
  readonly swallowed: boolean;
}

/**
 * Τα κοψίματα αρχής/τέλους ενός άξονα μήκους `length`, με εγγύηση ότι μένει σώμα ≥ `minBody`.
 * Όλα στις ίδιες μονάδες. Αρνητικά κοψίματα μετρούν ως μηδέν.
 */
export function resolveOpposingEndCuts(
  startCut: number,
  endCut: number,
  length: number,
  minBody: number,
): OpposingEndCuts {
  const start = Math.max(0, startCut);
  const end = Math.max(0, endCut);
  const room = length - minBody;
  if (start + end < room) return { start, end, swallowed: false };
  if (room <= 0 || start + end <= 0) return { start: 0, end: 0, swallowed: true };
  const k = room / (start + end);
  return { start: start * k, end: end * k, swallowed: true };
}
