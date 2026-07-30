/**
 * SSoT — **πλοήγηση στη δομή ενός DXF**: πού αρχίζει/τελειώνει μια section, και πώς μαζεύονται
 * οι (code, value) κωδικοί μιας εγγραφής (ADR-736).
 *
 * Ένα DXF είναι ροή ζευγών `code\nvalue` με **σταθερό βήμα 2 γραμμών**, οργανωμένη σε sections
 * (`HEADER` / `CLASSES` / `TABLES` / `BLOCKS` / `ENTITIES` / `OBJECTS`). Δύο ερωτήσεις
 * επαναλαμβάνονται σε κάθε parser του φακέλου: «πού είναι η section X;» και «ποιοι κωδικοί
 * ανήκουν σε αυτή την εγγραφή;». Εδώ απαντιούνται **μία φορά**.
 *
 * **Γιατί υπάρχει (N.0.2, μετρημένο 2026-07-30):** ο εντοπισμός section ήταν γραμμένος **δύο
 * φορές** — `DxfEntityParser.findSectionRange` (static) και `findObjectsSectionRange` (ιδιωτικό
 * στον `dxf-mline-style-parser`, hardcoded στο `OBJECTS`). Ο reader των εξωτερικών αναφορών θα
 * ήταν το **τρίτο**, και μάλιστα σαρώνει **τρεις** sections. Ίδια ερώτηση ⇒ ένα σπίτι.
 *
 * ⚠️ **Leaf module — ΜΗΔΕΝ imports, επίτηδες.** Ο `dxf-mline-style-parser` έμεινε αυτάρκης για
 * να μη σχηματιστεί ο κύκλος `converters → mline-parser → entity-parser → converters`. Αν αυτό
 * το αρχείο αποκτήσει import, ο κύκλος επιστρέφει από την πίσω πόρτα. **Μην του βάλεις κανένα.**
 *
 * ⚠️ **Δεν κάνει trim/filter στη ροή** — αυτό είναι δουλειά του `dxf-line-stream.splitDxfLines`,
 * που τεκμηριώνει γιατί μια κενή γραμμή ΔΕΝ πετιέται (μετατοπίζει το βήμα ⇒ ~90% απώλεια).
 * Εδώ γίνεται `.trim()` μόνο **κατά την ανάγνωση** κάθε κωδικού/τιμής, ποτέ στην ίδια τη ροή.
 */

/** Μια section ως ημιάνοικτο διάστημα γραμμών `[start, end)`. */
export interface DxfSectionRange {
  /** Πρώτη γραμμή **μετά** το ζεύγος `2/<όνομα>` της κεφαλίδας. */
  readonly start: number;
  /** Ο δείκτης του `0/ENDSEC` που κλείνει τη section (ή το τέλος της ροής σε κολοβό αρχείο). */
  readonly end: number;
}

/**
 * Εντοπίζει μια named section (`'ENTITIES'`, `'BLOCKS'`, `'OBJECTS'`, …) ή `null` αν λείπει.
 *
 * Το DXF ανοίγει κάθε section με **τέσσερις** γραμμές: `0` / `SECTION` / `2` / `<όνομα>`.
 * Ένα αρχείο χωρίς τη ζητούμενη section (συνηθισμένο: R12 exports χωρίς `OBJECTS`) επιστρέφει
 * `null` — ο καλών γυρίζει κενό αποτέλεσμα, ποτέ σφάλμα.
 */
export function findDxfSectionRange(
  lines: readonly string[],
  name: string,
): DxfSectionRange | null {
  for (let i = 0; i + 3 < lines.length; i += 2) {
    if (lines[i]?.trim() === '0' && lines[i + 1]?.trim() === 'SECTION'
      && lines[i + 2]?.trim() === '2' && lines[i + 3]?.trim() === name) {
      const start = i + 4;
      for (let j = start; j < lines.length - 1; j += 2) {
        if (lines[j]?.trim() === '0' && lines[j + 1]?.trim() === 'ENDSEC') {
          return { start, end: j };
        }
      }
      // Κολοβό αρχείο (λείπει το ENDSEC): δώσε ό,τι υπάρχει αντί να χαθεί όλη η section.
      return { start, end: lines.length };
    }
  }
  return null;
}

/** Ένα (code, value) ζεύγος όπως διαβάστηκε, με τη σειρά που το γράφει το αρχείο. */
export type DxfCodePair = readonly [code: string, value: string];

/** Το αποτέλεσμα μιας συλλογής: οι κωδικοί της εγγραφής + από πού συνεχίζει ο σαρωτής. */
export interface DxfPairCollection {
  readonly pairs: readonly DxfCodePair[];
  /** Ο δείκτης του επόμενου `0` (ή το `end`) — ο καλών συνεχίζει από εκεί, χωρίς να τον υπολογίσει. */
  readonly next: number;
}

/**
 * Μαζεύει τα ζεύγη μιας εγγραφής, από το `start` μέχρι τον **επόμενο κωδικό `0`** (που ανοίγει
 * την επόμενη εγγραφή) ή μέχρι το `end`.
 *
 * ⚠️ **Διατεταγμένη λίστα, ΟΧΙ `Map<code, value>`.** Πολλοί κωδικοί **επαναλαμβάνονται** μέσα
 * στην ίδια εγγραφή (vertices HATCH/MLINE, στοιχεία MLINESTYLE, δυαδικά chunks `310` του OLE).
 * Ένας flat χάρτης θα κρατούσε **μόνο το τελευταίο** — σιωπηλή απώλεια που έχει ήδη κοστίσει
 * στο έργο (ADR-507 Φ1a, ADR-635 Φ C.19).
 */
export function collectDxfRecordPairs(
  lines: readonly string[],
  start: number,
  end: number,
): DxfPairCollection {
  const pairs: DxfCodePair[] = [];
  let i = start;
  while (i < end - 1) {
    const code = lines[i]?.trim();
    const value = lines[i + 1]?.trim() ?? '';
    if (!code) { i += 2; continue; }
    if (code === '0') break;
    pairs.push([code, value]);
    i += 2;
  }
  return { pairs, next: i };
}

/** Η **πρώτη** τιμή ενός κωδικού μέσα σε μια εγγραφή, ή `undefined` αν λείπει. */
export function firstPairValue(
  pairs: readonly DxfCodePair[],
  code: string,
): string | undefined {
  for (const [c, v] of pairs) {
    if (c === code) return v;
  }
  return undefined;
}
