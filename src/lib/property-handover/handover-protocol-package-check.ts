/**
 * @fileoverview **Ο ΕΛΕΓΧΟΣ ΤΟΥ ΠΑΚΕΤΟΥ** — τα αρχεία που έφερε ο τρίτος, απέναντι στον σφραγισμένο πίνακα του Πρωτοκόλλου
 *               (ADR-916 Φ-Γ2 Σ6 · BagIt RFC 8493).
 * @module lib/property-handover/handover-protocol-package-check
 * @related handover-protocol-verification.ts (ο πίνακας μετρά **μόνο** αφού επαληθευτεί το ίδιο το Πρωτόκολλο)
 *
 * 🏆 **Κανένα portal δεν το κάνει**: το DocuSign πιστοποιεί ότι **υπογράφηκε**, όχι **τι** παραδόθηκε. Εδώ ο συμβολαιογράφος
 *    ρίχνει τα αρχεία που πήρε και βλέπει, γραμμή προς γραμμή, ότι είναι **αυτά**, byte προς byte.
 * 🔑 **Ταίριασμα κατά περιεχόμενο, όχι κατά όνομα**: ένα μετονομασμένο αρχείο με ίδια bytes **είναι** το παραδομένο· ένα
 *    ομώνυμο με άλλα bytes **δεν** είναι. Το όνομα χρησιμεύει μόνο για να πει **ποια** γραμμή διαφέρει.
 * ⚠️ `sha256 === null` ⇒ το αρχείο ήταν πολύ μεγάλο για τον browser: η γραμμή λέει `unchecked`, ποτέ «ταιριάζει».
 *
 * **Layering**: leaf — καθαρή συνάρτηση.
 */

import type { HandoverProtocolManifestFile } from './handover-protocol-manifest-parse';

/** Ένα αρχείο που έριξε ο τρίτος — κατακερματισμένο τοπικά, ή `null` όταν ξεπερνά το όριο του browser. */
export interface HandoverPackageFileEvidence {
  readonly name: string;
  readonly size: number;
  readonly sha256: string | null;
}

export type HandoverPackageRowStatus = 'match' | 'differs' | 'unchecked' | 'not-provided';

export interface HandoverPackageRow {
  readonly file: HandoverProtocolManifestFile;
  readonly status: HandoverPackageRowStatus;
  /** Το όνομα του αρχείου που έριξε ο τρίτος για αυτή τη γραμμή — `null` όταν δεν δόθηκε. */
  readonly providedName: string | null;
}

export interface HandoverPackageExtra {
  readonly name: string;
  readonly reason: 'not-in-protocol' | 'unchecked';
}

export interface HandoverPackageCheck {
  readonly rows: readonly HandoverPackageRow[];
  readonly extras: readonly HandoverPackageExtra[];
  /** Κάθε γραμμή του πίνακα δόθηκε **και** ταιριάζει byte προς byte. */
  readonly complete: boolean;
}

/** Η γραμμή του πίνακα για ένα αρχείο — πρώτα κατά bytes, μετά (για να ονομαστεί η διαφορά) κατά όνομα. */
function rowOf(file: HandoverProtocolManifestFile, provided: readonly HandoverPackageFileEvidence[], used: Set<number>): HandoverPackageRow {
  const take = (index: number, status: HandoverPackageRowStatus): HandoverPackageRow => {
    used.add(index);
    return { file, status, providedName: provided[index].name };
  };
  const byContent = provided.findIndex((item, index) => !used.has(index) && item.sha256 === file.sha256);
  if (byContent >= 0) return take(byContent, 'match');
  const byName = file.name === null ? -1 : provided.findIndex((item, index) => !used.has(index) && item.name === file.name);
  if (byName >= 0) return take(byName, provided[byName].sha256 === null ? 'unchecked' : 'differs');
  return { file, status: 'not-provided', providedName: null };
}

/** **Ελέγχει το πακέτο.** Η σειρά των γραμμών = η σειρά του σφραγισμένου πίνακα. */
export function handoverPackageCheckOf(
  files: readonly HandoverProtocolManifestFile[],
  provided: readonly HandoverPackageFileEvidence[],
): HandoverPackageCheck {
  const used = new Set<number>();
  // Πρώτα όλα τα ταιριάσματα περιεχομένου: ένα ομώνυμο αρχείο δεν «κλέβει» το σωστό αρχείο άλλης γραμμής.
  const exact = files.map((file) => provided.findIndex((item) => item.sha256 === file.sha256));
  const rows = files.map((file, index) => {
    const own = exact[index];
    if (own >= 0 && !used.has(own)) {
      used.add(own);
      return { file, status: 'match' as const, providedName: provided[own].name };
    }
    return null;
  });
  const settled = rows.map((row, index) => row ?? rowOf(files[index], provided, used));
  const extras = provided.flatMap((item, index): HandoverPackageExtra[] => (used.has(index) ? [] : [
    { name: item.name, reason: item.sha256 === null ? 'unchecked' : 'not-in-protocol' },
  ]));
  return { rows: settled, extras, complete: settled.every((row) => row.status === 'match') };
}
