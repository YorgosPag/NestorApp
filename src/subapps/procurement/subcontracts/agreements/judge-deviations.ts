/**
 * @fileoverview **Κρίση των ρητρών ενός συμφωνητικού** απέναντι στην εγκεκριμένη βιβλιοθήκη — καρφωμένη έκδοση, τιμές,
 *   αποκλίσεις (ADR-928 §5.2.1 τρόπος 3 · Φ2 αποφάσεις 5, 6).
 * @module subapps/procurement/subcontracts/agreements/judge-deviations
 *
 * 🔑 **Ένας κριτής** (`toleranceVerdict`) για πρότυπα (Φ1), συμφωνητικά (εδώ) και επιφυλάξεις διαγωνισμού (§5.9).
 * 🔑 **Δεσμευμένες παράμετροι** (`source: term`) κρίνονται από τα `CommercialTerms` **του εγγράφου** — η τιμή ζει μία
 *    φορά, στα δεδομένα (Φ1 απόφαση 2)· ο πελάτης δεν τη στέλνει ως τιμή ρήτρας.
 * 🔑 **Η απόκλιση δένεται με την τιμή**: ίδια τιμή + ίδιος λόγος ⇒ η απόφαση μένει· οτιδήποτε άλλο ⇒ `pending`. Τιμή
 *    που γύρισε σε ελεύθερη ζώνη ⇒ η απόκλιση σβήνεται. Το `decision` το γράφει μόνο ο γραφέας.
 *
 * Καθαρό: το καλεί ο γραφέας **μέσα** στη συναλλαγή (με τη βιβλιοθήκη που διάβασε εκεί) και η οθόνη της Φ3.
 */

import { joinPath, type SubcontractIssue } from '../clauses/clause-issues';
import { readBoundTermValue } from '../clauses/commercial-term-bindings';
import { isFreeVerdict, toleranceVerdict } from '../clauses/tolerance-verdict';
import { sameParameterValue, validateParameterValue } from '../clauses/validate-clause-parameter';
import type { ClauseKey } from '../types/clause';
import type { ClauseParameterDefinition, ClauseParameterValue } from '../types/clause-parameter';
import type { ClauseDeviation, ClauseSelection, CommercialTerms } from '../types/commercial-terms';

/** Ό,τι στέλνει ο πελάτης για μια ρήτρα: ποια έκδοση, τιμές των **μη δεσμευμένων** παραμέτρων, λόγοι αποκλίσεων. */
export interface ClauseSelectionInput {
  readonly clauseKey: ClauseKey;
  readonly version: number;
  readonly parameterValues: Readonly<Record<string, ClauseParameterValue>>;
  readonly deviationReasons: Readonly<Record<string, string>>;
}

/** Η εγκεκριμένη έκδοση σε ισχύ μιας ρήτρας, όπως τη διάβασε ο γραφέας. */
export interface ClauseInForce {
  readonly clauseId: string;
  readonly version: number;
  readonly parameters: readonly ClauseParameterDefinition[];
}

/** Βιβλιοθήκη ανά κλειδί: `null` = υπάρχει χωρίς εγκεκριμένη έκδοση· απουσία = άγνωστη ή αρχειοθετημένη. */
export type ApprovedLibrary = ReadonlyMap<ClauseKey, ClauseInForce | null>;

export interface JudgeActor {
  readonly uid: string;
}

export interface JudgedClauses {
  readonly issues: readonly SubcontractIssue[];
  readonly selections: readonly ClauseSelection[];
}

interface ParameterContext {
  readonly input: ClauseSelectionInput;
  readonly terms: CommercialTerms;
  readonly previous: ClauseSelection | undefined;
  readonly actor: JudgeActor;
  readonly path: string;
}

/** Η τιμή μιας παραμέτρου: από τους όρους αν είναι δεσμευμένη, αλλιώς του πελάτη, αλλιώς η προτιμώμενη. */
export function resolveParameterValue(
  definition: ClauseParameterDefinition,
  parameterValues: Readonly<Record<string, ClauseParameterValue>>,
  terms: CommercialTerms,
): ClauseParameterValue | null {
  if (definition.source.kind === 'term') return readBoundTermValue(definition.source.term, terms);
  return parameterValues[definition.key] ?? definition.preferred;
}

/** Η απόκλιση που κρατιέται: ίδια τιμή και ίδιος (ή κανένας νέος) λόγος ⇒ η προηγούμενη, με την απόφασή της. */
function nextDeviation(value: ClauseParameterValue, reason: string | null, previous: ClauseDeviation | undefined, actor: JudgeActor): ClauseDeviation | null {
  const unchanged = previous !== undefined && sameParameterValue(previous.value, value) && (reason === null || reason === previous.reason);
  if (unchanged) return previous;
  if (reason === null) return null;
  return { value, reason, requestedBy: actor.uid, decision: 'pending', decidedBy: null, decidedAt: null, decisionReason: null };
}

/** Μία παράμετρος: εγκυρότητα, ετυμηγορία ζώνης, απόκλιση. */
function judgeParameter(
  definition: ClauseParameterDefinition,
  context: ParameterContext,
): { issues: SubcontractIssue[]; value: ClauseParameterValue | null; deviation: ClauseDeviation | null } {
  const at = joinPath(context.path, 'parameterValues', definition.key);
  const value = resolveParameterValue(definition, context.input.parameterValues, context.terms);
  if (value === null) return { issues: [{ code: 'bindingTermMissing', path: at }], value: null, deviation: null };
  const invalid = validateParameterValue(definition, value, at);
  if (invalid.length > 0) return { issues: invalid, value, deviation: null };
  const verdict = toleranceVerdict(definition, value);
  if (isFreeVerdict(verdict)) return { issues: [], value, deviation: null };
  if (verdict === 'forbidden') return { issues: [{ code: 'deviationForbidden', path: at }], value, deviation: null };
  const reason = context.input.deviationReasons[definition.key]?.trim() || null;
  const deviation = nextDeviation(value, reason, context.previous?.deviations[definition.key], context.actor);
  return deviation ? { issues: [], value, deviation } : { issues: [{ code: 'deviationReasonRequired', path: at }], value, deviation: null };
}

/** Κλειδιά τιμών που ο πελάτης δεν δικαιούται να στείλει: άγνωστα, ή δεσμευμένα σε εμπορικό όρο. */
function foreignValueIssues(input: ClauseSelectionInput, parameters: readonly ClauseParameterDefinition[], path: string): SubcontractIssue[] {
  const byKey = new Map(parameters.map((parameter) => [parameter.key, parameter]));
  return Object.keys(input.parameterValues).flatMap((key) => {
    const definition = byKey.get(key);
    if (!definition) return [{ code: 'overrideUnknownParameter' as const, path: joinPath(path, 'parameterValues', key) }];
    return definition.source.kind === 'term' ? [{ code: 'overrideOnBoundParameter' as const, path: joinPath(path, 'parameterValues', key) }] : [];
  });
}

/** Η ρήτρα υπάρχει, έχει εγκεκριμένη έκδοση, και ο πελάτης κάρφωσε **αυτήν**. */
function inForceOrIssue(input: ClauseSelectionInput, library: ApprovedLibrary, path: string): ClauseInForce | SubcontractIssue {
  if (!library.has(input.clauseKey)) return { code: 'clauseRefUnknown', path };
  const inForce = library.get(input.clauseKey);
  if (!inForce) return { code: 'clauseRefNotApproved', path };
  return inForce.version === input.version ? inForce : { code: 'clauseVersionOutdated', path: joinPath(path, 'version') };
}

function judgeSelection(
  input: ClauseSelectionInput,
  inForce: ClauseInForce,
  context: Omit<ParameterContext, 'input'>,
): { issues: SubcontractIssue[]; selection: ClauseSelection } {
  const issues: SubcontractIssue[] = foreignValueIssues(input, inForce.parameters, context.path);
  const parameterValues: Record<string, ClauseParameterValue> = {};
  const deviations: Record<string, ClauseDeviation> = {};
  for (const definition of inForce.parameters) {
    const judged = judgeParameter(definition, { ...context, input });
    issues.push(...judged.issues);
    if (judged.value !== null && definition.source.kind === 'clause') parameterValues[definition.key] = judged.value;
    if (judged.deviation) deviations[definition.key] = judged.deviation;
  }
  return { issues, selection: { clauseId: inForce.clauseId, clauseKey: input.clauseKey, version: inForce.version, parameterValues, deviations } };
}

/**
 * Κρίνει **όλες** τις επιλογές ρητρών ενός πρόχειρου. `previous`: οι αποθηκευμένες επιλογές (για να κρατηθούν οι
 * αποφάσεις όπου η τιμή δεν άλλαξε). Επιστρέφει **όλα** τα ευρήματα, όχι το πρώτο.
 */
export function judgeClauseSelections(
  inputs: readonly ClauseSelectionInput[],
  library: ApprovedLibrary,
  terms: CommercialTerms,
  previous: readonly ClauseSelection[],
  actor: JudgeActor,
): JudgedClauses {
  const previousByKey = new Map(previous.map((selection) => [selection.clauseKey, selection]));
  const seen = new Set<ClauseKey>();
  const issues: SubcontractIssue[] = [];
  const selections: ClauseSelection[] = [];
  inputs.forEach((input, index) => {
    const path = joinPath('clauses', index);
    if (seen.has(input.clauseKey)) return void issues.push({ code: 'clauseRefDuplicate', path: joinPath(path, 'clauseKey') });
    seen.add(input.clauseKey);
    const inForce = inForceOrIssue(input, library, path);
    if ('code' in inForce) return void issues.push(inForce);
    const judged = judgeSelection(input, inForce, { terms, previous: previousByKey.get(input.clauseKey), actor, path });
    issues.push(...judged.issues);
    selections.push(judged.selection);
  });
  return { issues, selections };
}

/** Οι επιλογές ως είσοδος — για να ξανακριθεί ένα αποθηκευμένο πρόχειρο (π.χ. στο `issue`) με τον ίδιο κριτή. */
export function selectionInputsOf(selections: readonly ClauseSelection[]): ClauseSelectionInput[] {
  return selections.map((selection) => ({
    clauseKey: selection.clauseKey,
    version: selection.version,
    parameterValues: selection.parameterValues,
    deviationReasons: {},
  }));
}
