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
import { COMMERCIAL_TERM_BINDINGS, readBoundTermValue } from '../clauses/commercial-term-bindings';
import { toleranceVerdict } from '../clauses/tolerance-verdict';
import type { ClauseKey } from '../types/clause';
import type { ClauseParameterDefinition, ClauseParameterValue, ToleranceVerdict } from '../types/clause-parameter';
import type { CommercialTerms } from '../types/commercial-terms';
import type { TemplateClauseRef } from '../types/trade-template';
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

interface BoundSource {
  readonly index: number;
  readonly clauseKey: ClauseKey;
  readonly parameters: readonly ClauseParameterDefinition[];
  /** Η τιμή της δεσμευμένης παραμέτρου από τους όρους (`null` = ο όρος δεν ισχύει). */
  readonly valueOf: (definition: ClauseParameterDefinition) => ClauseParameterValue | null;
  /** Πού γράφει ο κριτής τα ευρήματα αυτής της παραμέτρου. */
  readonly clausePathOf: (key: string) => string;
  readonly reasons: Readonly<Record<string, string>>;
}

/** Ο ένας πυρήνας: κάθε δεσμευμένη παράμετρος → (`termPath`, ζώνη, λόγος, μονοπάτι του κριτή). */
function boundOfSource(source: BoundSource): [string, BoundTerm][] {
  return source.parameters.flatMap((definition): [string, BoundTerm][] => {
    if (definition.source.kind !== 'term') return [];
    const value = source.valueOf(definition);
    if (value === null) return [];
    const bound: BoundTerm = {
      clauseIndex: source.index, clauseKey: source.clauseKey, definition, value, verdict: toleranceVerdict(definition, value),
      reason: source.reasons[definition.key] ?? '', clausePath: source.clausePathOf(definition.key),
    };
    return [[COMMERCIAL_TERM_BINDINGS[definition.source.term].termPath, bound]];
  });
}

function collect(entries: readonly [string, BoundTerm][]): BoundTerms {
  const byPath = new Map<string, BoundTerm[]>();
  for (const [termPath, bound] of entries) byPath.set(termPath, [...(byPath.get(termPath) ?? []), bound]);
  return byPath;
}

/** Συμφωνητικό: ρήτρα καρφωμένη στην έκδοση σε ισχύ · ευρήματα στο `clauses.N.parameterValues.<key>`. */
export function boundTermsOf(clauses: readonly ClauseSelectionInput[], library: ApprovedLibrary, terms: CommercialTerms): BoundTerms {
  return collect(clauses.flatMap((input, index) => {
    const inForce = library.get(input.clauseKey);
    if (!inForce || inForce.version !== input.version) return [];
    return boundOfSource({
      index, clauseKey: input.clauseKey, parameters: inForce.parameters, reasons: input.deviationReasons,
      valueOf: (definition) => resolveParameterValue(definition, input.parameterValues, terms),
      clausePathOf: (key) => joinPath('clauses', index, 'parameterValues', key),
    });
  }));
}

/**
 * Πρότυπο (ADR-928 §5.22): κάθε ρήτρα κρίνεται στην έκδοση σε ισχύ (το πρότυπο δεν καρφώνει έκδοση) · ευρήματα στο
 * `clauses.N.bound.<key>` — **ακριβώς** όπως ο `validateTemplateAgainstLibrary` · κανένας λόγος (το πρότυπο δεν δέχεται
 * αποκλίσεις).
 */
export function templateBoundTermsOf(refs: readonly TemplateClauseRef[], library: ApprovedLibrary, terms: CommercialTerms): BoundTerms {
  return collect(refs.flatMap((ref, index) => {
    const inForce = library.get(ref.clauseKey);
    if (!inForce) return [];
    return boundOfSource({
      index, clauseKey: ref.clauseKey, parameters: inForce.parameters, reasons: {},
      valueOf: (definition) => (definition.source.kind === 'term' ? readBoundTermValue(definition.source.term, terms) : null),
      clausePathOf: (key) => joinPath('clauses', index, 'bound', key),
    });
  }));
}

/** Η ερώτηση μιας ενότητας που κρατά το τμήμα `prefix` των όρων (π.χ. `paymentPlan`). */
export function boundTermsAt(bound: BoundTerms, prefix: string): BoundTermsAt {
  return (relativePath) => bound.get(joinPath(prefix, relativePath)) ?? [];
}
