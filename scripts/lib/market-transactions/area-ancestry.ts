/**
 * @fileoverview **Οι εγγραφές κάθε περιοχής με σελίδα — από τα φύλλα προς τα πάνω** (ADR-889 §4 · ADR-890 §16).
 * @related `scripts/build-market-transactions.ts` (ο καλών) · `src/types/area-market.ts` (`hasAreaMarketPage`)
 * @module scripts/lib/market-transactions/area-ancestry
 *
 * 🔑 **Η διάμεσος ΞΑΝΑΥΠΟΛΟΓΙΖΕΤΑΙ, δεν συντίθεται**: διάμεσος διαμέσων ≠ διάμεσος. Κάθε πρόγονος (Δήμος · Π.Ε. ·
 *   Περιφέρεια) παίρνει **τις ίδιες τις εγγραφές** των φύλλων του, και το στατιστικό του υπολογίζεται από αυτές.
 * 🔑 **Καμία διπλομέτρηση**: η πηγή μιλά σε βαθμίδα φύλλου (Δ.Ε., ή Δήμος χωρίς Δ.Ε.), άρα κάθε εγγραφή ανήκει σε
 *   **ένα** φύλλο, και η αλυσίδα προγόνων ενός φύλλου δεν περνά δύο φορές από την ίδια περιοχή.
 * 🔑 **Byte-ταυτότητα**: οι ομάδες γεμίζουν με τη σειρά επανάληψης των φύλλων — ό,τι υπήρχε πριν (Δ.Ε. · Δήμοι) παίρνει
 *   τις εγγραφές του με την ίδια σειρά όπως όταν η άθροιση ανέβαινε μόνο ένα επίπεδο.
 */

export interface AncestryArea {
  readonly level: number;
  readonly parentId: string | null;
}

/**
 * @param leaves οι εγγραφές ανά φύλλο, όπως τις μάζεψε ο συσσωρευτής
 * @param areaOf η περιοχή μιας ταυτότητας (ρίχνει για άγνωστη — σφάλμα δεδομένων, όχι σιωπή)
 * @param keep ποιες βαθμίδες προγόνων παίρνουν ομάδα (οι βαθμίδες με σελίδα περιοχής)
 */
export function groupByAreaAncestry<T>(
  leaves: ReadonlyMap<string, readonly T[]>,
  areaOf: (id: string) => AncestryArea,
  keep: (level: number) => boolean,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  const add = (id: string, items: readonly T[]): void => {
    const group = groups.get(id);
    if (group === undefined) groups.set(id, [...items]);
    else group.push(...items);
  };
  for (const [leafId, items] of leaves) {
    add(leafId, items);
    for (let id = areaOf(leafId).parentId; id !== null; id = areaOf(id).parentId) {
      if (keep(areaOf(id).level)) add(id, items);
    }
  }
  return groups;
}
