/**
 * @fileoverview Η έξοδος του Λ1 (ADR-745 §6.1). **Δεν αποθηκεύεται** — είναι πρόταση.
 *
 * Ό,τι μπαίνει εδώ έχει διαβαστεί από το σχέδιο και τίποτα δεν έχει επιβεβαιωθεί. Η
 * σύνδεση με οντότητες της βάσης είναι δουλειά του Λ2 και περνά **πάντα** από άνθρωπο
 * (ADR-745 §5.1: η πινακίδα δεν είναι ποτέ SSoT).
 */

import type { TitleBlockFieldKey } from './title-block-vocabulary';

/** Το κελί όπως το παραδίδει η εισαγωγή DXF — ήδη αποκωδικοποιημένο σε κείμενο. */
export interface TitleBlockSourceCell {
  /** Λαβή DXF (κωδ. 5) — η ταυτότητα του κελιού και η ιχνηλασιμότητά του. */
  readonly handle: string;
  readonly x: number;
  readonly y: number;
  /** Ονομαστικό ύψος κειμένου (κωδ. 40). */
  readonly height: number;
  /** Ωμό MTEXT, με τους κωδικούς μορφοποίησης ΑΘΙΚΤΟΥΣ. */
  readonly raw: string;
}

/** Πώς προέκυψε η αντιστοίχιση ετικέτα→τιμή. */
export type TitleBlockMatchKind = 'same-cell' | 'row-alignment' | 'column-alignment';

/** Μία αναγνωσμένη τιμή με την προέλευσή της. */
export interface TitleBlockField {
  readonly key: TitleBlockFieldKey;
  /** Η τιμή μετά το ξεγύμνωμα των κωδικών MTEXT — **χωρίς** καμία άλλη «διόρθωση». */
  readonly rawValue: string;
  /** Σε ποιο MTEXT βρέθηκε η **τιμή** (ίδιο με το `labelHandle` στο `same-cell`). */
  readonly sourceHandle: string;
  /** Σε ποιο MTEXT βρέθηκε η **ετικέτα** — το overlay πρέπει να καλύψει και τα δύο. */
  readonly labelHandle: string;
  /** Θέση εισαγωγής του κελιού της τιμής (WCS). */
  readonly at: { readonly x: number; readonly y: number };
  readonly matchedBy: TitleBlockMatchKind;
}

/** Ένα πρόσωπο όπως το δηλώνει η τυπογραφική ιεραρχία του κελιού μελετητών. */
export interface TitleBlockPerson {
  readonly displayName: string;
  readonly professionText: string;
  readonly phones: readonly string[];
  readonly emails: readonly string[];
  readonly websites: readonly string[];
  readonly officeSeat?: string;
}

/** Μία πινακίδα. Ένα layer μπορεί να δώσει περισσότερες από μία (§2.3 Παγίδα Δ). */
export interface TitleBlockReading {
  readonly layerName: string;
  /**
   * Περίγραμμα από τα **σημεία εισαγωγής** των κελιών.
   *
   * Δεν είναι η έκταση του μελανιού: ο κωδ. 41 του MTEXT είναι το πλάτος **αναδίπλωσης**
   * (μετρημένα 20,772 / 36,7 / 44,7 για κελιά με πολύ μικρότερο κείμενο), οπότε δεν κάνει
   * για περίγραμμα. Όποιος χρειαστεί ακριβές bbox θα το ζητήσει από τον renderer.
   */
  readonly bbox: {
    readonly minX: number;
    readonly minY: number;
    readonly maxX: number;
    readonly maxY: number;
  };
  readonly fields: readonly TitleBlockField[];
  readonly people: readonly TitleBlockPerson[];
  /** Ό,τι δεν αναγνωρίστηκε — **ποτέ** δεν πετιέται σιωπηλά (ADR-745 §8 κανόνας 3). */
  readonly unparsed: readonly string[];
}
