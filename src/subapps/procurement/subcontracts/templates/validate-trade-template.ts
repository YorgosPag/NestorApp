/**
 * @fileoverview **Επικύρωση προτύπου ειδικότητας** (ADR-928 §5.3) — σε δύο βήματα, επίτηδες.
 * @module subapps/procurement/subcontracts/templates/validate-trade-template
 *
 * 1. `validateTradeTemplateDefinition` — **μόνο** το πρότυπο: κωδικός, ειδικότητα από το `TRADE_CODES`, γραμμές,
 *    όροι. Καθαρό, τρέχει και στον browser.
 * 2. `validateTemplateAgainstLibrary` — απέναντι στις **εγκεκριμένες** εκδόσεις της βιβλιοθήκης, που ο γραφέας διαβάζει
 *    **μέσα** στη συναλλαγή. 🔑 Το πρότυπο είναι πρότυπο **της εταιρείας**, όχι απόκλιση: κάθε τιμή του (υπέρβαση ή
 *    δεσμευμένος όρος) πρέπει να είναι `preferred` ή `acceptable`. Ό,τι θέλει έγκριση ανήκει σε **ένα** συμφωνητικό
 *    (Φ2, `ClauseDeviation`), όχι στο καλούπι όλων.
 */

import { TRADE_CODES } from '@/subapps/procurement/types/trade';
import { joinPath, type SubcontractIssue } from '../clauses/clause-issues';
import { readBoundTermValue } from '../clauses/commercial-term-bindings';
import { isFreeVerdict, toleranceVerdict } from '../clauses/tolerance-verdict';
import { validateParameterValue } from '../clauses/validate-clause-parameter';
import { CLAUSE_KEY_PATTERN } from '../clauses/validate-clause-version';
import { hasAuthoritativeText } from '../clauses/validate-parameter-definition';
import { validateAgreementLines } from '../lines/validate-agreement-line';
import { validateCommercialTerms } from '../terms/validate-commercial-terms';
import type { ClauseKey } from '../types/clause';
import type { ClauseParameterDefinition, ClauseParameterValue } from '../types/clause-parameter';
import type { CommercialTerms } from '../types/commercial-terms';
import { AGREEMENT_DOCUMENT_MODES, type SubcontractTradeTemplateDefinition, type TemplateClauseRef } from '../types/trade-template';

const KNOWN_TRADES: ReadonlySet<string> = new Set(TRADE_CODES);

export function validateTradeTemplateDefinition(definition: SubcontractTradeTemplateDefinition): SubcontractIssue[] {
  const issues: SubcontractIssue[] = [];
  if (!CLAUSE_KEY_PATTERN.test(definition.code)) issues.push({ code: 'templateCodeInvalid', path: 'code' });
  if (!KNOWN_TRADES.has(definition.trade)) issues.push({ code: 'tradeUnknown', path: 'trade' });
  if (!hasAuthoritativeText(definition.title)) issues.push({ code: 'clauseTitleRequired', path: 'title' });
  if (!AGREEMENT_DOCUMENT_MODES.includes(definition.defaultDocumentMode)) issues.push({ code: 'parameterValueInvalid', path: 'defaultDocumentMode' });
  issues.push(...validateAgreementLines(definition.lines, 'lines'));
  const seen = new Set<ClauseKey>();
  definition.clauses.forEach((ref, index) => {
    if (!CLAUSE_KEY_PATTERN.test(ref.clauseKey) || seen.has(ref.clauseKey)) {
      issues.push({ code: 'clauseRefDuplicate', path: joinPath('clauses', index, 'clauseKey') });
    }
    seen.add(ref.clauseKey);
  });
  const lineIds = new Set(definition.lines.map((line) => line.id));
  issues.push(...validateCommercialTerms(definition.defaultTerms, 'defaultTerms', lineIds));
  return issues;
}

/** Η τιμή κρίνεται: έγκυρη για το είδος **και** μέσα στις ελεύθερες ζώνες. */
function judgeValue(
  definition: ClauseParameterDefinition,
  value: ClauseParameterValue,
  path: string,
  outsideCode: SubcontractIssue['code'],
): SubcontractIssue[] {
  const invalid = validateParameterValue(definition, value, path);
  if (invalid.length > 0) return invalid;
  const verdict = toleranceVerdict(definition, value);
  if (isFreeVerdict(verdict)) return [];
  return [{ code: verdict === 'forbidden' ? 'overrideForbidden' : outsideCode, path }];
}

function clauseRefIssues(
  ref: TemplateClauseRef,
  parameters: readonly ClauseParameterDefinition[],
  terms: CommercialTerms,
  path: string,
): SubcontractIssue[] {
  const byKey = new Map(parameters.map((parameter) => [parameter.key, parameter]));
  const issues: SubcontractIssue[] = [];
  for (const [key, value] of Object.entries(ref.parameterOverrides)) {
    const at = joinPath(path, 'parameterOverrides', key);
    const definition = byKey.get(key);
    if (!definition) issues.push({ code: 'overrideUnknownParameter', path: at });
    else if (definition.source.kind === 'term') issues.push({ code: 'overrideOnBoundParameter', path: at });
    else issues.push(...judgeValue(definition, value, at, 'overrideNeedsApproval'));
  }
  for (const definition of parameters) {
    if (definition.source.kind !== 'term') continue;
    const at = joinPath(path, 'bound', definition.key);
    const bound = readBoundTermValue(definition.source.term, terms);
    if (bound === null) issues.push({ code: 'bindingTermMissing', path: at });
    else issues.push(...judgeValue(definition, bound, at, 'termOutsideTolerance'));
  }
  return issues;
}

/**
 * `library`: για κάθε κλειδί, οι παράμετροι της **εγκεκριμένης** έκδοσης σε ισχύ — `null` αν η ρήτρα υπάρχει χωρίς
 * εγκεκριμένη έκδοση. Απουσία κλειδιού ⇒ ρήτρα που δεν υπάρχει (ή είναι αρχειοθετημένη).
 */
export function validateTemplateAgainstLibrary(
  definition: SubcontractTradeTemplateDefinition,
  library: ReadonlyMap<ClauseKey, readonly ClauseParameterDefinition[] | null>,
): SubcontractIssue[] {
  return definition.clauses.flatMap((ref, index) => {
    const path = joinPath('clauses', index);
    if (!library.has(ref.clauseKey)) return [{ code: 'clauseRefUnknown' as const, path }];
    const parameters = library.get(ref.clauseKey);
    if (!parameters) return [{ code: 'clauseRefNotApproved' as const, path }];
    return clauseRefIssues(ref, parameters, definition.defaultTerms, path);
  });
}
