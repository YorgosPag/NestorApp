/**
 * ADR-912 §12.16 — **Η σειρά των αρχείων ΟΠΩΣ ΤΗ ΒΛΕΠΕΙ ο άνθρωπος** — για το «προηγούμενο / επόμενο» του θεατή.
 *
 * 🔑 **Η πηγή είναι η ΑΠΟΔΟΣΜΕΝΗ λίστα, όχι δεύτερη ταξινόμηση.** Η ίδια λίστα αρχείων αποδίδεται με τέσσερις τρόπους
 *   (επίπεδη · ομάδες μελέτης · τομέας/κατηγορία · δέντρο · πλέγμα), και οι ομαδοποιημένες αναδιατάσσουν. Ένας θεατής που
 *   ξαναταξινομούσε τα `filteredFiles` θα πηγαινοερχόταν σε σειρά που ο άνθρωπος **δεν βλέπει**. Γι' αυτό κάθε γραμμή που
 *   ανοίγει τον θεατή δηλώνει την ταυτότητά της ({@link fileSequenceItem}), και η σειρά διαβάζεται από το DOM: η σειρά
 *   του εγγράφου ΕΙΝΑΙ η σειρά της οθόνης. Κλειστή ομάδα / φάκελος ⇒ τα αρχεία της δεν είναι στη σειρά (δεν φαίνονται).
 * 🔑 **Στα άκρα σταματά** (`indexWithin(…, 'clamp')`): Google Drive / Photos — κανένα άλμα από το τελευταίο στο πρώτο.
 *
 * Framework-free: μόνο DOM.
 */

import { indexWithin } from '@/lib/array-utils';

/** Το γνώρισμα με το οποίο μια γραμμή λίστας δηλώνει «είμαι στάση της σειράς του θεατή». */
export const FILE_SEQUENCE_ATTR = 'data-file-sequence-id';

/** Τα props που απλώνει μια γραμμή λίστας: `<article {...fileSequenceItem(file.id)}>`. */
export function fileSequenceItem(fileId: string): { readonly [FILE_SEQUENCE_ATTR]: string } {
  return { [FILE_SEQUENCE_ATTR]: fileId };
}

/** Οι ταυτότητες, με τη σειρά του εγγράφου· η πρώτη εμφάνιση κερδίζει (ένα αρχείο σε δύο ομάδες = μία στάση). */
export function readFileSequence(root: ParentNode): readonly string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  root.querySelectorAll(`[${FILE_SEQUENCE_ATTR}]`).forEach((el) => {
    const id = el.getAttribute(FILE_SEQUENCE_ATTR);
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  });
  return ids;
}

/** Πού είναι το τρέχον αρχείο και ποιοι είναι οι γείτονές του. `null` ⇒ δεν υπάρχει σειρά να διασχίσεις. */
export interface FileSequenceStop {
  /** 0-based θέση στη σειρά. */
  readonly index: number;
  readonly total: number;
  readonly previousId: string | null;
  readonly nextId: string | null;
}

/**
 * `null` όταν το τρέχον αρχείο **δεν είναι** στη λίστα που φαίνεται (π.χ. το έκρυψε φίλτρο) ή όταν είναι μόνο του:
 * βέλη χωρίς προορισμό είναι θόρυβος.
 */
export function fileSequenceStopOf(ids: readonly string[], currentId: string): FileSequenceStop | null {
  const index = ids.indexOf(currentId);
  if (index < 0 || ids.length < 2) return null;
  const neighbour = (step: -1 | 1): string | null => {
    const target = indexWithin(index + step, ids.length, 'clamp');
    return target === index ? null : ids[target];
  };
  return { index, total: ids.length, previousId: neighbour(-1), nextId: neighbour(1) };
}

/** Ίδιες ταυτότητες με την ίδια σειρά — για να μην ξαναζωγραφίζει ο θεατής σε κάθε άσχετη αλλαγή του DOM. */
export function sameFileSequence(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}
