/**
 * @fileoverview Η **μία** πόρτα επικύρωσης ρήτρας: ταυτότητα · περιεχόμενο έκδοσης · γλώσσα μετάφρασης (ADR-928 Φ1).
 * @module subapps/procurement/subcontracts/clauses/validate-clause-version
 *
 * Ο γραφέας, η προεπιλεγμένη βιβλιοθήκη (άγκυρα δεδομένων) και η οθόνη της Φ3 καλούν **αυτές** τις συναρτήσεις —
 * καμία δεύτερη εκδοχή του «έγκυρη ρήτρα».
 */

import { CLAUSE_AUTHORITATIVE_LANGUAGE, type ClauseBody, type ClauseKey } from '../types/clause';
import type { ClauseLanguage, ClauseParameterDefinition, LocalizedText } from '../types/clause-parameter';
import { joinPath, type SubcontractIssue } from './clause-issues';
import { validateClauseBody, validateTranslationBody } from './validate-clause-body';
import { hasAuthoritativeText, validateParameterDefinitions } from './validate-parameter-definition';

/** `payment.schedule` · `tax.withholding_technical_works`: 1–4 τμήματα με τελεία, πεζά λατινικά/ψηφία/`_`. */
export const CLAUSE_KEY_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){0,3}$/;

/** Κωδικός γλώσσας ISO 639-1 (`en`, `sq`, `bg`, `ro`…). */
const LANGUAGE_PATTERN = /^[a-z]{2}$/;

export function validateClauseIdentity(clauseKey: ClauseKey, title: LocalizedText): SubcontractIssue[] {
  const issues: SubcontractIssue[] = [];
  if (!CLAUSE_KEY_PATTERN.test(clauseKey)) issues.push({ code: 'clauseKeyInvalid', path: 'clauseKey' });
  if (!hasAuthoritativeText(title)) issues.push({ code: 'clauseTitleRequired', path: 'title' });
  return issues;
}

/** Ορισμοί παραμέτρων **και** σώμα, με τη σύνδεσή τους (καμία ορφανή προς καμία κατεύθυνση). */
export function validateClauseContent(body: ClauseBody, parameters: readonly ClauseParameterDefinition[]): SubcontractIssue[] {
  return [...validateParameterDefinitions(parameters, 'parameters'), ...validateClauseBody(body, parameters, 'body')];
}

/**
 * Δεύτερη γλώσσα: έγκυρος κωδικός **και** όχι τα ελληνικά (η αυθεντία δεν «μεταφράζεται»). Κοινό για τη μετάφραση
 * ρήτρας και για τη δεύτερη στήλη του συμφωνητικού (§5.2.2).
 */
export function isSecondaryLanguage(language: ClauseLanguage): boolean {
  return LANGUAGE_PATTERN.test(language) && language !== CLAUSE_AUTHORITATIVE_LANGUAGE;
}

/** Μετάφραση: γλώσσα ≠ ελληνικά, ίδιο σύνολο παραμέτρων με το ελληνικό. */
export function validateClauseTranslation(language: ClauseLanguage, source: ClauseBody, translation: ClauseBody): SubcontractIssue[] {
  const issues: SubcontractIssue[] = [];
  if (!isSecondaryLanguage(language)) {
    issues.push({ code: 'translationLanguageInvalid', path: 'language' });
  }
  issues.push(...validateTranslationBody(source, translation, joinPath('translation')));
  return issues;
}
