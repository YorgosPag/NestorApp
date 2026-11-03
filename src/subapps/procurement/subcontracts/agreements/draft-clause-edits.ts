/**
 * @fileoverview **Οι πράξεις του επεξεργαστή πάνω στις ρήτρες ενός πρόχειρου** — καθαρές, αμετάβλητες (ADR-928 Φ3γ).
 * @module subapps/procurement/subcontracts/agreements/draft-clause-edits
 *
 * 🔑 Η οθόνη δεν γράφει ποτέ «με το χέρι» στο σχήμα του πρόχειρου: κάθε αλλαγή περνά από εδώ, ώστε ο κανόνας να είναι
 *    ένας και να ελέγχεται (π.χ. «επιστροφή στην προτιμώμενη» σβήνει **και** τον λόγο απόκλισης — αλλιώς θα ζητούσε
 *    έγκριση για τιμή που δεν αποκλίνει πια).
 * 🔑 «Ενημέρωση στην έκδοση σε ισχύ» (Figma «update available», Φ2 απόφαση 5): κρατά μόνο τιμές παραμέτρων που
 *    υπάρχουν **ακόμη** στη νέα έκδοση και ανήκουν στη ρήτρα — ό,τι άλλο θα ήταν `overrideUnknownParameter`.
 */

import type { ClauseKey } from '../types/clause';
import type { ClauseParameterValue } from '../types/clause-parameter';
import type { SubcontractAgreementDraftInput } from './agreement-draft';
import type { ClauseInForce, ClauseSelectionInput } from './judge-deviations';

type Draft = SubcontractAgreementDraftInput;

function withClause(draft: Draft, index: number, edit: (clause: ClauseSelectionInput) => ClauseSelectionInput): Draft {
  return { ...draft, clauses: draft.clauses.map((clause, at) => (at === index ? edit(clause) : clause)) };
}

function without<T>(record: Readonly<Record<string, T>>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([candidate]) => candidate !== key));
}

export function setClauseParameterValue(draft: Draft, index: number, key: string, value: ClauseParameterValue): Draft {
  return withClause(draft, index, (clause) => ({ ...clause, parameterValues: { ...clause.parameterValues, [key]: value } }));
}

export function setClauseDeviationReason(draft: Draft, index: number, key: string, reason: string): Draft {
  return withClause(draft, index, (clause) => ({ ...clause, deviationReasons: { ...clause.deviationReasons, [key]: reason } }));
}

/** Πίσω στην προτιμώμενη της βιβλιοθήκης: χωρίς τιμή και χωρίς λόγο (δεν αποκλίνει πια). */
export function resetClauseParameter(draft: Draft, index: number, key: string): Draft {
  return withClause(draft, index, (clause) => ({
    ...clause,
    parameterValues: without(clause.parameterValues, key),
    deviationReasons: without(clause.deviationReasons, key),
  }));
}

/** Νέα ρήτρα, καρφωμένη στην έκδοση σε ισχύ, με τις προτιμώμενες τιμές. Ιδεμποτικό: υπάρχουσα ρήτρα δεν διπλασιάζεται. */
export function addClause(draft: Draft, clauseKey: ClauseKey, inForce: ClauseInForce): Draft {
  if (draft.clauses.some((clause) => clause.clauseKey === clauseKey)) return draft;
  return { ...draft, clauses: [...draft.clauses, { clauseKey, version: inForce.version, parameterValues: {}, deviationReasons: {} }] };
}

export function removeClause(draft: Draft, index: number): Draft {
  return { ...draft, clauses: draft.clauses.filter((_, at) => at !== index) };
}

/** Η ρήτρα στην έκδοση σε ισχύ — κρατά τις τιμές και τους λόγους μόνο όπου η παράμετρος επιβιώνει στη νέα έκδοση. */
export function upgradeClauseVersion(draft: Draft, index: number, inForce: ClauseInForce): Draft {
  const kept = new Set(inForce.parameters.filter((parameter) => parameter.source.kind === 'clause').map((parameter) => parameter.key));
  const keep = <T,>(record: Readonly<Record<string, T>>) => Object.fromEntries(Object.entries(record).filter(([key]) => kept.has(key)));
  return withClause(draft, index, (clause) => ({
    ...clause,
    version: inForce.version,
    parameterValues: keep(clause.parameterValues),
    deviationReasons: keep(clause.deviationReasons),
  }));
}
