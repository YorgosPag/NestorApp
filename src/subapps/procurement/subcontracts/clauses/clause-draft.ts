/**
 * @fileoverview **Το πρόχειρο της συγγραφής ρήτρας** — αφετηρία και ο ένας κριτής (ADR-928 §5.22 · Φ3γ-0b-1) — καθαρό.
 * @module subapps/procurement/subcontracts/clauses/clause-draft
 *
 * Δύο τρόποι, ένα πρόχειρο:
 *   - `create` — νέα ρήτρα: κλειδί + τίτλος + σώμα + παράμετροι ⇒ `POST /api/subcontracts/clauses`·
 *   - `propose` — νέα έκδοση υπάρχουσας: σώμα + παράμετροι πάνω στη **βάση** ⇒ `POST …/clauses/[id]/versions`.
 *
 * 🔑 **Αφετηρία = η έκδοση σε ισχύ**, αλλιώς η τελευταία που γράφτηκε (π.χ. μόνο απορριφθείσες): ο άνθρωπος διορθώνει
 *    ό,τι διάβασε, δεν ξαναγράφει από το μηδέν (Ironclad «redline», Figma «branch from main»).
 * 🔑 **Ένας κριτής**: ο ίδιος `validateClauseIdentity` + `validateClauseContent` του γραφέα. Το μόνο που προστίθεται
 *    είναι ό,τι ο γραφέας λέει μόνο **μετά** από ταξίδι (`duplicate` 409): το κλειδί πιασμένο από άλλη ρήτρα του χώρου.
 * 🔑 **Κλειδωμένα κλειδιά** (`lockedParameterKeys`): όσα υπάρχουν στη βάση. Οι τιμές των συμφωνητικών (`parameterValues`)
 *    και οι μεταφράσεις που κληρονομεί η νέα έκδοση (`carriedTranslations`) δείχνουν με αυτά.
 */

import { dequal } from 'dequal';
import type { ClauseBody, ClauseKey, SubcontractClause, SubcontractClauseVersion } from '../types/clause';
import type { ClauseParameterDefinition, LocalizedText } from '../types/clause-parameter';
import type { SubcontractIssue } from './clause-issues';
import { latinKeyOf, uniqueKey } from './parameter-definition-edits';
import { CLAUSE_KEY_PATTERN, validateClauseContent, validateClauseIdentity } from './validate-clause-version';

export type ClauseAuthoringMode = 'create' | 'propose';

export interface ClauseAuthoringDraft {
  readonly clauseKey: ClauseKey;
  readonly title: LocalizedText;
  readonly body: ClauseBody;
  readonly parameters: readonly ClauseParameterDefinition[];
}

const CLAUSE_KEY_MAX = 64;

export function emptyClauseDraft(): ClauseAuthoringDraft {
  return { clauseKey: '', title: { el: '' }, body: { heading: '', blocks: [] }, parameters: [] };
}

/** Η βάση μιας πρότασης: η έκδοση σε ισχύ, αλλιώς η νεότερη που γράφτηκε, αλλιώς καμία. */
export function proposalBaseOf(
  clause: Pick<SubcontractClause, 'currentVersion'>,
  versions: readonly SubcontractClauseVersion[],
): SubcontractClauseVersion | null {
  const current = versions.find((version) => version.version === clause.currentVersion);
  if (current) return current;
  return versions.reduce<SubcontractClauseVersion | null>((latest, version) => (latest === null || version.version > latest.version ? version : latest), null);
}

export function clauseDraftOf(clause: Pick<SubcontractClause, 'clauseKey' | 'title'>, base: SubcontractClauseVersion | null): ClauseAuthoringDraft {
  return {
    clauseKey: clause.clauseKey,
    title: clause.title,
    body: base?.body ?? { heading: '', blocks: [] },
    parameters: base?.parameters ?? [],
  };
}

/** Τα κλειδιά παραμέτρων της βάσης — δεν μετονομάζονται στην πρόταση. */
export function lockedParameterKeys(base: Pick<SubcontractClauseVersion, 'parameters'> | null): ReadonlySet<string> {
  return new Set((base?.parameters ?? []).map((parameter) => parameter.key));
}

/** Κλειδί ρήτρας από τον τίτλο: «Ασφάλιση εργοταξίου» ⇒ `asfalisi_ergotaxiou`, ποτέ πιασμένο. */
export function clauseKeyFromTitle(title: string, taken: ReadonlySet<string>): ClauseKey {
  return uniqueKey(latinKeyOf(title, 'clause', CLAUSE_KEY_MAX), taken, CLAUSE_KEY_MAX);
}

export interface ClauseDraftContext {
  readonly mode: ClauseAuthoringMode;
  /** Τα κλειδιά των ρητρών του χώρου (και αρχειοθετημένων: το id είναι ντετερμινιστικό από το κλειδί). */
  readonly takenKeys: ReadonlySet<ClauseKey>;
}

export function judgeClauseDraft(draft: ClauseAuthoringDraft, context: ClauseDraftContext): SubcontractIssue[] {
  const content = validateClauseContent(draft.body, draft.parameters);
  if (context.mode === 'propose') return content;
  const identity = validateClauseIdentity(draft.clauseKey, draft.title);
  const taken = CLAUSE_KEY_PATTERN.test(draft.clauseKey) && context.takenKeys.has(draft.clauseKey);
  return [...identity, ...(taken ? [{ code: 'clauseKeyTaken' as const, path: 'clauseKey' }] : []), ...content];
}

/** Το περιεχόμενο είναι ίδιο με τη βάση ⇒ καμία πρόταση (μια «έκδοση» χωρίς αλλαγή θα ζητούσε έγκριση για το τίποτα). */
export function sameClauseContent(draft: Pick<ClauseAuthoringDraft, 'body' | 'parameters'>, base: Pick<SubcontractClauseVersion, 'body' | 'parameters'> | null): boolean {
  return base !== null && dequal(draft.body, base.body) && dequal(draft.parameters, base.parameters);
}
