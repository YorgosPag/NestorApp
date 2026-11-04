/**
 * @fileoverview **Ποια ρήτρα δένει αυτό το πεδίο των όρων, και σε ποια ζώνη είναι** — η γέφυρα όρος ↔ ρήτρα της οθόνης
 *   (ADR-928 Φ3γ-2 απόφαση 2).
 * @module subapps/procurement/subcontracts/agreements/bound-terms
 *
 * 🔴 Το κενό που κλείνει: η τιμή μιας δεσμευμένης παραμέτρου (κράτηση, παρακράτηση, ποινή…) ζει **στους όρους**, ενώ ο
 *    κριτής γράφει τη ζώνη και το εύρημά της **στη ρήτρα** (`clauses.N.parameterValues.<key>`). Ο άνθρωπος που αλλάζει
 *    την κράτηση στους όρους δεν έβλεπε ότι μόλις βγήκε από το playbook.
 * 🔑 Ίδιος κριτής με τον γραφέα (`resolveParameterValue` + `toleranceVerdict`), ίδιο μονοπάτι (`joinPath`), ίδιο
 *    `termPath` με το `read` του δεσίματος. Τίποτα δεν ξανακρίνεται εδώ.
 * 🔑 Κρίνεται μόνο ρήτρα καρφωμένη στην έκδοση σε ισχύ, όπως στον κριτή: παλιά έκδοση ⇒ `clauseVersionOutdated` στη
 *    ρήτρα, όχι ζώνη με παλιές ανοχές.
 */

import { joinPath } from '../clauses/clause-issues';
import { COMMERCIAL_TERM_BINDINGS } from '../clauses/commercial-term-bindings';
import { toleranceVerdict } from '../clauses/tolerance-verdict';
import type { ClauseKey } from '../types/clause';
import type { ClauseParameterDefinition, ClauseParameterValue, ToleranceVerdict } from '../types/clause-parameter';
import type { CommercialTerms } from '../types/commercial-terms';
import { resolveParameterValue, type ApprovedLibrary, type ClauseSelectionInput } from './judge-deviations';

export interface BoundTerm {
  readonly clauseIndex: number;
  readonly clauseKey: ClauseKey;
  readonly definition: ClauseParameterDefinition;
  readonly value: ClauseParameterValue;
  readonly verdict: ToleranceVerdict;
  /** Ο λόγος απόκλισης του πρόχειρου (`''` αν δεν γράφτηκε). */
  readonly reason: string;
  /** Το μονοπάτι όπου ο κριτής γράφει τα ευρήματα αυτής της παραμέτρου. */
  readonly clausePath: string;
}

/** Ανά `termPath` (σχετικό με το `CommercialTerms`), οι δεσμευμένες παράμετροι που το διαβάζουν. */
export type BoundTerms = ReadonlyMap<string, readonly BoundTerm[]>;

/** Ερώτηση ανά πεδίο, σχετική με το τμήμα των όρων που κρατά η ενότητα (`''` = οι όροι ολόκληροι). */
export type BoundTermsAt = (relativePath: string) => readonly BoundTerm[];

export const NO_BOUND_TERMS: BoundTermsAt = () => [];

function boundOfClause(input: ClauseSelectionInput, index: number, library: ApprovedLibrary, terms: CommercialTerms): [string, BoundTerm][] {
  const inForce = library.get(input.clauseKey);
  if (!inForce || inForce.version !== input.version) return [];
  return inForce.parameters.flatMap((definition): [string, BoundTerm][] => {
    if (definition.source.kind !== 'term') return [];
    const value = resolveParameterValue(definition, input.parameterValues, terms);
    if (value === null) return [];
    const clausePath = joinPath('clauses', index, 'parameterValues', definition.key);
    const reason = input.deviationReasons[definition.key] ?? '';
    const bound: BoundTerm = { clauseIndex: index, clauseKey: input.clauseKey, definition, value, verdict: toleranceVerdict(definition, value), reason, clausePath };
    return [[COMMERCIAL_TERM_BINDINGS[definition.source.term].termPath, bound]];
  });
}

export function boundTermsOf(clauses: readonly ClauseSelectionInput[], library: ApprovedLibrary, terms: CommercialTerms): BoundTerms {
  const byPath = new Map<string, BoundTerm[]>();
  clauses.forEach((input, index) => {
    for (const [termPath, bound] of boundOfClause(input, index, library, terms)) byPath.set(termPath, [...(byPath.get(termPath) ?? []), bound]);
  });
  return byPath;
}

/** Η ερώτηση μιας ενότητας που κρατά το τμήμα `prefix` των όρων (π.χ. `paymentPlan`). */
export function boundTermsAt(bound: BoundTerms, prefix: string): BoundTermsAt {
  return (relativePath) => bound.get(joinPath(prefix, relativePath)) ?? [];
}
