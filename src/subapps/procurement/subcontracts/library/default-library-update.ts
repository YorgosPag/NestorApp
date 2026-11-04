/**
 * @fileoverview **Ο κανόνας «upstream» της προεπιλεγμένης βιβλιοθήκης** (ADR-928 §5.20) — καθαρή απόφαση, χωρίς Firestore.
 *
 * Όταν αλλάζει το κείμενο μιας ρήτρας του Νέστορα (`DEFAULT_CLAUSE_LIBRARY`), ένας χώρος που έχει ήδη σπαρθεί πρέπει να
 * το μάθει — όπως οι LegalOn / Ironclad / Ariba διανέμουν ενημερώσεις τυποποιημένου περιεχομένου: **νέα έκδοση προς
 * έγκριση**, ποτέ σιωπηλή αντικατάσταση.
 *
 * 🔑 **Τριμερής σύγκριση, όχι διμερής.** Δεν ρωτάμε «διαφέρει η ρήτρα του χώρου από του Νέστορα;» (θα ξαναπρόσφερε για
 * πάντα ό,τι ο χώρος απέρριψε ή άλλαξε σκόπιμα). Ρωτάμε «άλλαξε ο **Νέστορας** από την τελευταία φορά που **πρόσφερε**;»
 * — η βάση είναι η τελευταία έκδοση με προτείνοντα το σύστημα. Άρα:
 * - η απόρριψη τιμάται (ίδιο κείμενο ⇒ καμία νέα προσφορά),
 * - η παραλλαγή του χώρου δεν πατιέται (η ενημέρωση φτάνει ως πρόταση, την κρίνει άνθρωπος),
 * - ρήτρα που ο Νέστορας δεν πρόσφερε ποτέ (ο χώρος την έγραψε μόνος του με το ίδιο κλειδί) δεν αγγίζεται.
 *
 * 🔑 Τα τέσσερα μάτια μένουν ακέραια: προτείνων = σύστημα, εγκρίνων = άνθρωπος. Το σύστημα κλείνει μόνο **δική του**
 * ανοιχτή πρόταση — ακριβώς όσα επιτρέπει σε άνθρωπο η απόσυρση (`refuseWithdrawal`).
 * @module subapps/procurement/subcontracts/library/default-library-update
 */

import { DEFAULT_LIBRARY_PROPOSER, type SubcontractClause, type SubcontractClauseVersion } from '../types/clause';

export type DefaultLibraryUpdate =
  /** Τίποτα να προσφερθεί. */
  | { readonly kind: 'none' }
  /** Καμία ανοιχτή πρόταση ⇒ νέα έκδοση από το σύστημα. */
  | { readonly kind: 'propose' }
  /** Ανοιχτή πρόταση **του συστήματος** με παλιότερο κείμενο ⇒ κλείνει και τη διαδέχεται η νέα. */
  | { readonly kind: 'replace'; readonly stale: SubcontractClauseVersion }
  /** Ανοιχτή πρόταση **ανθρώπου** ⇒ καμία εγγραφή τώρα. */
  | { readonly kind: 'deferred' };

const NONE: DefaultLibraryUpdate = { kind: 'none' };

/** Η τελευταία έκδοση που πρόσφερε ο Νέστορας (η βάση της τριμερούς σύγκρισης), ή `null` αν δεν πρόσφερε ποτέ. */
export function lastOfferedVersion(versions: readonly SubcontractClauseVersion[]): SubcontractClauseVersion | null {
  return versions.reduce<SubcontractClauseVersion | null>(
    (latest, version) => (version.proposedBy === DEFAULT_LIBRARY_PROPOSER && (latest === null || version.version > latest.version) ? version : latest),
    null,
  );
}

/**
 * Τι κάνει η σπορά σε μια **υπάρχουσα** ρήτρα, δεδομένου του σημερινού κειμένου του Νέστορα (`shippedContentHash`).
 * `versions` = όλες οι εκδόσεις της ρήτρας που διαβάστηκαν (λείπουσες απλώς παραλείπονται).
 */
export function defaultLibraryUpdateOf(
  clause: SubcontractClause,
  versions: readonly SubcontractClauseVersion[],
  shippedContentHash: string,
): DefaultLibraryUpdate {
  if (clause.isArchived) return NONE;
  const offered = lastOfferedVersion(versions);
  if (offered === null || offered.contentHash === shippedContentHash) return NONE;
  const current = versions.find((version) => version.version === clause.currentVersion);
  if (current?.contentHash === shippedContentHash) return NONE;
  if (clause.openProposal === null) return { kind: 'propose' };
  const open = versions.find((version) => version.version === clause.openProposal);
  if (open?.state === 'proposed' && open.proposedBy === DEFAULT_LIBRARY_PROPOSER) return { kind: 'replace', stale: open };
  return { kind: 'deferred' };
}
