/**
 * @fileoverview **Η ΑΠΑΝΤΗΣΗ ΜΙΑΣ ΜΑΖΙΚΗΣ ΠΡΑΞΗΣ ΑΡΧΕΙΩΝ ΣΤΟ ΣΥΡΜΑ** — ένας φάκελος για όλες τις πόρτες.
 * @related ADR-845 §7.17 · app/api/files/_shared/file-batch-act.ts (ο σκελετός που τον γεμίζει)
 * @module services/file-record/file-batch-act.types
 *
 * 🔑 **Γιατί χωριστό αρχείο τύπων**: τον διαβάζουν ο σκελετός των διαδρομών *(διακομιστής)* και η
 * πύλη του πελάτη. Κανένα `server-only` εδώ, και **μία** μόνο τιμή: το ταβάνι της δέσμης, που
 * πρέπει να το ξέρουν **και οι δύο** πλευρές *(ο διακομιστής αρνείται πάνω από αυτό, ο πελάτης τεμαχίζει)*.
 */

import type { ListingRefreshReport } from '@/services/listings/listing-media-refresh';

/** Πόσα αρχεία χωρά **ένα** αίτημα — η μπάρα μαζικών ενεργειών είναι η ίδια για κάθε πράξη. */
export const MAX_FILES_PER_BATCH_ACT = 50;

/**
 * Τι απαντά **κάθε** πόρτα δέσμης: διαβάθμιση · κάδος/επαναφορά *(· αρχειοθέτηση)*.
 *
 * ⚠️ **Μερική επιτυχία είναι νόμιμη έκβαση**, ονομασμένη ανά αρχείο στο `errors`.
 */
export interface FileBatchActResponse {
  readonly success: boolean;
  /** Πόσα αρχεία **άλλαξαν**. Όσα ήταν ήδη στη ζητούμενη κατάσταση δεν μετρούν και δεν είναι σφάλμα. */
  readonly processedCount: number;
  /** `"{fileId}: {λόγος}"` — `not found` · ονομασμένη άρνηση του γραφέα · μήνυμα βλάβης. */
  readonly errors: readonly string[];
  /** 🌍 Τι έγινε σε **κάθε** αγγελία που αφορούσε η αλλαγή — κενό όταν κανένα αρχείο δεν ήταν ακινήτου. */
  readonly listings: readonly ListingRefreshReport[];
}

/** Ένα αρχείο που **άλλαξε** κατάσταση κάδου — ό,τι χρειάζεται το γεγονός του πελάτη. */
export interface FileTrashChange {
  readonly fileId: string;
  /** Πότε εκκαθαρίζεται· `null` μετά από επαναφορά. */
  readonly purgeAt: string | null;
  readonly displayName?: string;
  readonly entityId?: string;
  readonly entityType?: string;
}

/** Η απάντηση του `POST /api/files/trash` — ο κοινός φάκελος **συν** τα αλλαγμένα αρχεία. */
export interface FileTrashResponse extends FileBatchActResponse {
  readonly files: readonly FileTrashChange[];
}
