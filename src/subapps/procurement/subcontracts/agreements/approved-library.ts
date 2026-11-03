/**
 * @fileoverview **Η εγκεκριμένη βιβλιοθήκη ως είσοδος του κριτή** (ADR-928 §5.2.1 · Φ2 απόφαση 5 · Φ3α-2).
 * @module subapps/procurement/subcontracts/agreements/approved-library
 *
 * 🔑 **Μία** προβολή «ρήτρα + έκδοση σε ισχύ» → `ApprovedLibrary`, για τον γραφέα (μέσα στη συναλλαγή,
 *    `clause-library-reads.server`) **και** για την οθόνη (ζωντανή ανάγνωση, `useSubcontractLibrary`). Έτσι ο **ίδιος**
 *    `judgeClauseSelections` κρίνει το ίδιο πρόχειρο με την ίδια βιβλιοθήκη και στις δύο πλευρές: το κουμπί δεν λέει
 *    «εντάξει» εκεί όπου ο διακομιστής θα πει 422.
 * 🔑 Κανόνας: αρχειοθετημένη ρήτρα ⇒ **εκτός** χάρτη («άγνωστη»)· ζωντανή χωρίς εγκεκριμένη έκδοση, ή με έκδοση που δεν
 *    έχει φτάσει ακόμη στον πελάτη ⇒ `null` («υπάρχει χωρίς έκδοση σε ισχύ»). Fail-closed: τίποτα δεν υποτίθεται εγκεκριμένο.
 */

import type { SubcontractClause, SubcontractClauseVersion } from '../types/clause';
import type { PinnedClause } from './agreement-snapshot';
import type { ApprovedLibrary, ClauseInForce } from './judge-deviations';

/** Η έκδοση σε ισχύ μιας καρφωμένης ρήτρας, όπως τη βλέπει ο κριτής. */
export function clauseInForceOf(pinned: PinnedClause | null): ClauseInForce | null {
  if (pinned === null) return null;
  return { clauseId: pinned.clause.id, version: pinned.version.version, parameters: pinned.version.parameters };
}

/** Προβολή του χάρτη που διάβασε ο γραφέας (`readApprovedClauses`). */
export function approvedLibraryOf(pinned: ReadonlyMap<string, PinnedClause | null>): ApprovedLibrary {
  return new Map([...pinned].map(([key, entry]) => [key, clauseInForceOf(entry)]));
}

/**
 * Από τα έγγραφα ρητρών και τις εκδόσεις που έφτασαν στον πελάτη (ανά id ρήτρας) — η καρφωμένη ρήτρα ή `null`.
 * Δέχεται **μόνο** την έκδοση που λέει το `currentVersion`: μια παλιότερη που έμεινε στη μνήμη δεν γίνεται ποτέ «σε ισχύ».
 */
export function pinnedClauseOf(
  clause: SubcontractClause,
  versionsByClauseId: ReadonlyMap<string, SubcontractClauseVersion>,
): PinnedClause | null {
  if (clause.currentVersion === null) return null;
  const version = versionsByClauseId.get(clause.id);
  return version !== undefined && version.version === clause.currentVersion ? { clause, version } : null;
}

/** Η βιβλιοθήκη της οθόνης: ζωντανές ρήτρες ανά κλειδί, η καθεμία με την έκδοσή της σε ισχύ ή `null`. */
export function approvedLibraryFrom(
  clauses: readonly SubcontractClause[],
  versionsByClauseId: ReadonlyMap<string, SubcontractClauseVersion>,
): ApprovedLibrary {
  const live = clauses.filter((clause) => !clause.isArchived);
  return new Map(live.map((clause) => [clause.clauseKey, clauseInForceOf(pinnedClauseOf(clause, versionsByClauseId))]));
}
