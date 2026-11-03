/**
 * @fileoverview **Επικύρωση σώματος ρήτρας** και σύνδεσης σώματος ↔ παραμέτρων (ADR-928 §5.2 · §5.2.2) — καθαρή.
 * @module subapps/procurement/subcontracts/clauses/validate-clause-body
 *
 * 🔑 **Καμία ορφανή, προς καμία κατεύθυνση**: κάθε `{kind:'param', key}` του σώματος δείχνει σε ορισμένη παράμετρο,
 * και κάθε ορισμένη παράμετρος εμφανίζεται στο σώμα. Μια παράμετρος που δεν τυπώνεται πουθενά είναι συμβατικός
 * όρος που ο υπεργολάβος **δεν διαβάζει** — αλλά η εφαρμογή θα τον εφάρμοζε.
 *
 * 🔑 **Μετάφραση = ίδιο σύνολο παραμέτρων** με το ελληνικό: η μετάφραση που «ξεχνά» την κράτηση δεν είναι μετάφραση.
 */

import type { ClauseBlock, ClauseBody, ClauseInline } from '../types/clause';
import type { ClauseParameterDefinition } from '../types/clause-parameter';
import { joinPath, type SubcontractIssue } from './clause-issues';

/** Οι γραμμές τμημάτων ενός μπλοκ, με τη διαδρομή της καθεμιάς. */
function inlineRunsOf(block: ClauseBlock, path: string): readonly { readonly inlines: readonly ClauseInline[]; readonly path: string }[] {
  return block.kind === 'paragraph'
    ? [{ inlines: block.inlines, path: joinPath(path, 'inlines') }]
    : block.items.map((inlines, index) => ({ inlines, path: joinPath(path, 'items', index) }));
}

/** Τα κλειδιά παραμέτρων που αναφέρει ένα σώμα (με επαναλήψεις αφαιρεμένες). */
export function referencedParameterKeys(body: ClauseBody): ReadonlySet<string> {
  const keys = new Set<string>();
  body.blocks.forEach((block) => {
    for (const run of inlineRunsOf(block, '')) {
      for (const inline of run.inlines) if (inline.kind === 'param') keys.add(inline.key);
    }
  });
  return keys;
}

function runIssues(inlines: readonly ClauseInline[], path: string, defined: ReadonlySet<string>): SubcontractIssue[] {
  if (inlines.length === 0) return [{ code: 'blockEmpty', path }];
  const issues: SubcontractIssue[] = [];
  inlines.forEach((inline, index) => {
    const at = joinPath(path, index);
    if (inline.kind === 'text' && inline.text.length === 0) issues.push({ code: 'inlineTextEmpty', path: at });
    if (inline.kind === 'param' && !defined.has(inline.key)) issues.push({ code: 'paramReferenceUnknown', path: at });
  });
  return issues;
}

/**
 * Μη κενά μπλοκ με αναφορές μόνο σε ορισμένες παραμέτρους. Κοινό για το σώμα ρήτρας **και** τον κανόνα επιμέτρησης
 * γραμμής (μπλοκ χωρίς επικεφαλίδα και χωρίς παραμέτρους ⇒ `defined` κενό).
 */
export function validateClauseBlocks(blocks: readonly ClauseBlock[], defined: ReadonlySet<string>, path: string): SubcontractIssue[] {
  if (blocks.length === 0) return [{ code: 'bodyEmpty', path }];
  const issues: SubcontractIssue[] = [];
  blocks.forEach((block, index) => {
    const at = joinPath(path, index);
    if (block.kind === 'list' && block.items.length === 0) issues.push({ code: 'blockEmpty', path: at });
    for (const run of inlineRunsOf(block, at)) issues.push(...runIssues(run.inlines, run.path, defined));
  });
  return issues;
}

/** Το σχήμα του σώματος: επικεφαλίδα, μη κενά μπλοκ, και αναφορές μόνο σε ορισμένες παραμέτρους. */
export function validateClauseBodyShape(body: ClauseBody, defined: ReadonlySet<string>, path: string): SubcontractIssue[] {
  const issues: SubcontractIssue[] = [];
  if (body.heading.trim().length === 0) issues.push({ code: 'headingRequired', path: joinPath(path, 'heading') });
  issues.push(...validateClauseBlocks(body.blocks, defined, joinPath(path, 'blocks')));
  return issues;
}

/** Σώμα **και** παράμετροι μαζί: σχήμα, και καμία ορισμένη παράμετρος που δεν τυπώνεται. */
export function validateClauseBody(
  body: ClauseBody,
  parameters: readonly ClauseParameterDefinition[],
  path: string,
): SubcontractIssue[] {
  const defined = new Set(parameters.map((parameter) => parameter.key));
  const issues = validateClauseBodyShape(body, defined, path);
  const referenced = referencedParameterKeys(body);
  parameters.forEach((parameter, index) => {
    if (!referenced.has(parameter.key)) issues.push({ code: 'parameterUnreferenced', path: joinPath('parameters', index) });
  });
  return issues;
}

/** Η μετάφραση έχει το ίδιο σχήμα **και** αναφέρει ακριβώς το ίδιο σύνολο παραμέτρων με το ελληνικό. */
export function validateTranslationBody(source: ClauseBody, translation: ClauseBody, path: string): SubcontractIssue[] {
  const expected = referencedParameterKeys(source);
  const issues = validateClauseBodyShape(translation, expected, path);
  const actual = referencedParameterKeys(translation);
  const same = actual.size === expected.size && [...expected].every((key) => actual.has(key));
  if (!same) issues.push({ code: 'translationParamsMismatch', path });
  return issues;
}
