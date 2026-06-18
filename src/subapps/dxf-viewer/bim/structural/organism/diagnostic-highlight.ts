/**
 * diagnostic-highlight — SSoT για το «ποια μέλη επισημαίνονται οπτικά + πόσο σοβαρά»
 * (ADR-490). Παράγωγο των ΥΠΑΡΧΟΝΤΩΝ diagnostics (organism ADR-459 + FEM ADR-481) —
 * ΜΗΔΕΝ νέα λογική «τι είναι πρόβλημα»· μόνο projection για το canvas warning overlay.
 *
 * Ενώνει τα δύο diagnostics sets ανά entityId και κρατά τη **χειρότερη** severity ανά
 * μέλος (error > warning). Τα `info` αγνοούνται (μένουν μόνο στο property panel — δεν
 * «μολύνουν» την κάτοψη). Pure — zero React/DOM/store deps.
 *
 * @see ./structural-diagnostics-store.ts — organism getAll()
 * @see ../analytical/analysis-diagnostics-store.ts — FEM getAll()
 * @see ./diagnostics-index.ts — ο αδελφός indexer (per-entity panel)
 */

import type {
  StructuralDiagnostic,
  StructuralDiagnosticSeverity,
} from './structural-organism-types';

/** Σοβαρότητες που επισημαίνονται στην κάτοψη (το `info` μένει μόνο στο panel). */
export type HighlightSeverity = 'error' | 'warning';

/** Ένα επισημασμένο μέλος — χειρότερη severity + οι κωδικοί που το αφορούν. */
export interface EntityHighlight {
  readonly severity: HighlightSeverity;
  readonly codes: readonly string[];
}

/** error νικά warning· ό,τι δεν επισημαίνεται → 0. */
function highlightRank(severity: StructuralDiagnosticSeverity): number {
  if (severity === 'error') return 2;
  if (severity === 'warning') return 1;
  return 0; // info — δεν επισημαίνεται
}

/**
 * Index ανά entityId με τη χειρότερη severity + τους εμπλεκόμενους κωδικούς. Ένα
 * εύρημα επισημαίνει ΟΛΑ τα `entityIds` του (όπως ο per-entity indexer). Δέχεται ένα
 * ή περισσότερα sets (organism + analysis) και τα ενώνει.
 */
export function collectEntityHighlights(
  ...diagnosticSets: ReadonlyArray<readonly StructuralDiagnostic[]>
): ReadonlyMap<string, EntityHighlight> {
  const worst = new Map<string, { rank: number; severity: HighlightSeverity; codes: string[] }>();
  for (const set of diagnosticSets) {
    for (const d of set) {
      const rank = highlightRank(d.severity);
      if (rank === 0) continue; // info → skip
      const severity = d.severity as HighlightSeverity;
      for (const id of d.entityIds) {
        const prev = worst.get(id);
        if (!prev) {
          worst.set(id, { rank, severity, codes: [d.code] });
        } else {
          if (!prev.codes.includes(d.code)) prev.codes.push(d.code);
          if (rank > prev.rank) {
            prev.rank = rank;
            prev.severity = severity;
          }
        }
      }
    }
  }
  const out = new Map<string, EntityHighlight>();
  for (const [id, v] of worst) out.set(id, { severity: v.severity, codes: v.codes });
  return out;
}
