/**
 * =============================================================================
 * Κείμενο σελίδας PDF — το ΕΝΑ καθαρό μοντέλο, για server και για συσκευή (ADR-949 Α-2)
 * =============================================================================
 *
 * Ο server (`extractPdfText`) και ο browser (`read-pdf-on-device`) παίρνουν από το pdf.js τα **ίδια** κομμάτια κειμένου.
 * Εδώ ζουν όσα τα μετατρέπουν σε κάτι που διαβάζει ένας αναγνώστης, ώστε οι **ίδιοι** καθαροί αναγνώστες (ΠΕΑ ·
 * βεβαιώσεις · Ε9) να βλέπουν το ίδιο κείμενο όπου κι αν τρέξουν:
 *   - {@link pageTextOf} — το απλό κείμενο σελίδας (η ένωση που είχε ως τώρα μόνο ο server)
 *   - {@link linesOf} — κομμάτια **με θέση** ομαδοποιημένα σε οπτικές γραμμές (πίνακες: Ε9 · πράξη ΕΝΦΙΑ)
 *   - {@link hasReadableText} — «υπάρχει κείμενο, αλλά διαβάζεται;»
 *
 * 🔑 **Συντεταγμένες ΟΘΟΝΗΣ** (viewport του pdf.js, αρχή πάνω-αριστερά, y προς τα κάτω), ποτέ του χώρου κειμένου του PDF.
 *    Μετρημένο στα δείγματα Ε9 (ADR-949 §2.1α): το ίδιο έντυπο φτάνει **και** με `/Rotate 90` **και** χωρίς· στον χώρο
 *    του PDF οι γραμμές του πίνακα διακρίνονται από το x στο ένα και από το y στο άλλο. Στην οθόνη ταυτίζονται.
 * 🔑 **Σπασμένη γραμματοσειρά = μη αναγνώσιμο**, όπως το σαρωμένο: 2 από 5 πράξεις ΕΝΦΙΑ δίνουν κείμενο από σύμβολα
 *    (γράμματα ≤ 7% των χαρακτήρων), ενώ κάθε αναγνώσιμο δείγμα έχει ≥ 50%.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 *
 * @module lib/pdf/pdf-page-text
 */

/** Ένα κομμάτι κειμένου όπως το δίνει το pdf.js (`getTextContent` / `streamTextContent`). */
export interface PdfTextChunk {
  readonly str?: string;
  /** Το pdf.js σημειώνει τέλος γραμμής μετά από αυτό το κομμάτι. */
  readonly hasEOL?: boolean;
}

/** Ένα κομμάτι κειμένου με θέση σε συντεταγμένες οθόνης (κλίμακα 1): `x`/`y` η αρχή της γραμμής βάσης. */
export interface PdfTextItem {
  readonly s: string;
  readonly x: number;
  readonly y: number;
  /** Πλάτος στη φορά του κειμένου (μονάδες σελίδας). */
  readonly w: number;
  readonly h: number;
}

/** Μια σελίδα με θέσεις — ό,τι χρειάζεται ένας αναγνώστης πίνακα. */
export interface PdfPositionedPage {
  /** 1-based, όπως τη γράφει η πρόταση («σελ. 2»). */
  readonly page: number;
  readonly width: number;
  readonly height: number;
  readonly items: readonly PdfTextItem[];
}

/** Μια οπτική γραμμή: κομμάτια με (σχεδόν) ίδιο y, από αριστερά προς τα δεξιά. */
export interface PdfTextLine {
  readonly y: number;
  readonly items: readonly PdfTextItem[];
}

/**
 * Το ΕΝΑ όριο για έγγραφα-κείμενο (ΠΚΑ · ΠΕΑ · ενημερότητες · Ε9 — ADR-900 §3.8 · ADR-915 §20 · ADR-949 Α-2): μερικές
 * σελίδες κειμένου είναι λίγα KB· 10 MB κόβουν το PDF-βόμβα πριν φτάσει στον αναλυτή, στον server **και** στη συσκευή.
 */
export const DOCUMENT_TEXT_MAX_BYTES = 10 * 1024 * 1024;

/** Ανοχή ομαδοποίησης σε γραμμή (μονάδες σελίδας) — μισό ύψος της μικρότερης γραμματοσειράς των εντύπων (7pt). */
const PDF_LINE_TOLERANCE = 2;

/** Κάτω από αυτό το ποσοστό γραμμάτων το κείμενο είναι σύμβολα, όχι λέξεις (βλ. 🔑 πάνω: 7% έναντι ≥ 50%). */
const MIN_LETTER_RATIO = 0.25;
/** Λιγότερα γράμματα από αυτά σε όλο το έγγραφο ⇒ δεν υπάρχει τίποτα να διαβαστεί. */
const MIN_LETTERS = 20;

const LETTER = /[A-Za-zͰ-Ͽἀ-῿]/g;
const WHITESPACE = /\s/g;

/** **Το απλό κείμενο μιας σελίδας**: κομμάτια ενωμένα με κενό, ή με αλλαγή γραμμής όπου το pdf.js σημειώνει τέλος. */
export function pageTextOf(chunks: readonly PdfTextChunk[]): string {
  return chunks.map((chunk) => (chunk.str ?? '') + (chunk.hasEOL ? '\n' : ' ')).join('');
}

/** Το κέντρο ενός κομματιού στη φορά της γραμμής — εκεί κρίνεται σε ποια στήλη ανήκει. */
export function centerXOf(item: PdfTextItem): number {
  return item.x + item.w / 2;
}

/** **Οι οπτικές γραμμές** της σελίδας, από πάνω προς τα κάτω· μέσα σε κάθε γραμμή από αριστερά προς τα δεξιά. */
export function linesOf(page: PdfPositionedPage, tolerance: number = PDF_LINE_TOLERANCE): readonly PdfTextLine[] {
  const sorted = [...page.items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: { y: number; items: PdfTextItem[] }[] = [];
  for (const item of sorted) {
    const last = lines[lines.length - 1];
    if (last !== undefined && Math.abs(item.y - last.y) <= tolerance) last.items.push(item);
    else lines.push({ y: item.y, items: [item] });
  }
  return lines.map((line) => ({ y: line.y, items: [...line.items].sort((a, b) => a.x - b.x) }));
}

/**
 * **Διαβάζεται αυτό το κείμενο;** Όχι όταν είναι άδειο (σαρωμένο) **ή** όταν είναι σύμβολα από γραμματοσειρά χωρίς
 * αντιστοίχιση σε χαρακτήρες. Και στις δύο περιπτώσεις η απάντηση στον άνθρωπο είναι η ίδια: «δεν διαβάζεται».
 */
export function hasReadableText(pageTexts: readonly string[]): boolean {
  const visible = pageTexts.join('').replace(WHITESPACE, '');
  const letters = visible.match(LETTER)?.length ?? 0;
  return letters >= MIN_LETTERS && letters / visible.length >= MIN_LETTER_RATIO;
}

/** Το viewport του pdf.js σε κλίμακα 1 — όσο χρειάζεται για να μπει ένα κομμάτι σε συντεταγμένες ΟΘΟΝΗΣ. */
export interface PdfViewportLike {
  readonly width: number;
  readonly height: number;
  convertToViewportPoint(x: number, y: number): readonly number[];
}

/** Ένα κομμάτι κειμένου όπως το δίνει το `getTextContent` — στη συσκευή (`TextItem`) και στον server (σχήμα του service). */
export interface PdfRawTextItem {
  readonly str?: string;
  /** Ο πίνακας του pdf.js· ο τύπος της βιβλιοθήκης είναι `any[]`, εδώ δένεται σε αριθμούς. */
  readonly transform?: readonly unknown[];
  readonly width?: number;
  readonly height?: number;
}

/**
 * **Μια σελίδα με θέσεις** από τα κομμάτια του pdf.js — η ΜΙΑ μετατροπή, για τη συσκευή (`read-pdf-on-device`) **και** τον
 * server (`readPdfPositionedPages`, ADR-920 §14.11 Ζ3). Δύο αντίγραφα θα σήμαιναν ότι ο server επαληθεύει πίνακα
 * συντεταγμένων που η συσκευή διάβασε **αλλιώς**. Κενά κομμάτια και κομμάτια χωρίς πίνακα θέσης πετιούνται.
 */
export function positionedPageOf(page: number, viewport: PdfViewportLike, items: readonly PdfRawTextItem[]): PdfPositionedPage {
  const positioned = items.flatMap((item): PdfTextItem[] => {
    if (item.str === undefined || item.str.trim() === '' || item.transform === undefined) return [];
    const point = viewport.convertToViewportPoint(Number(item.transform[4]), Number(item.transform[5]));
    return [{ s: item.str, x: Number(point[0]), y: Number(point[1]), w: item.width ?? 0, h: item.height ?? 0 }];
  });
  return { page, width: viewport.width, height: viewport.height, items: positioned };
}
