/**
 * @fileoverview **Ο επεξεργαστής προτύπου ειδικότητας — καθαρές πράξεις, ο ένας κριτής, το δείγμα εγγράφου**
 *   (ADR-928 §5.3 · §5.22 · Φ3γ-0b-2).
 * @module subapps/procurement/subcontracts/templates/template-edits
 *
 * 🔑 **Ο κριτής είναι του γραφέα**: `validateTradeTemplateDefinition` + `validateTemplateAgainstLibrary` πάνω στην
 *    **εγκεκριμένη** βιβλιοθήκη (`libraryParametersOf`, η ίδια προβολή με τη σπορά). Προστίθεται μόνο ό,τι ο γραφέας λέει
 *    μετά από ταξίδι: ο κωδικός πιασμένος από άλλο πρότυπο (`templateCodeTaken`, το 409 `duplicate`).
 * 🔑 **«Όπως στη βιβλιοθήκη» = απουσία κλειδιού** στο `parameterOverrides`, ποτέ αντίγραφο της προτιμώμενης: όταν η
 *    βιβλιοθήκη αλλάξει την προτιμώμενη, το πρότυπο την ακολουθεί.
 * 🔑 **Νέο πρότυπο = αντίγραφο ενός υπάρχοντος** (Procore «copy from»): οι όροι ενός προτύπου έχουν δεκάδες πεδία που ο
 *    κριτής θέλει συνεπή· κανείς δεν τα γράφει από το μηδέν, και καμία «προεπιλογή» δεν καρφώνεται στον κώδικα.
 * 🔑 **Το δείγμα εγγράφου** είναι το **ίδιο** μοντέλο εγγράφου με το συμφωνητικό: ο **ίδιος** δρόμος του «Νέο»
 *    (`templateClauseInputsOf`, όπως το `draftFromTemplate`) και ο **ίδιος** κριτής επιλογών (`judgeClauseSelections`), με
 *    κενά μέρη και κενό έργο — ένα έντυπο προς συμπλήρωση. Ό,τι τυπώνεται εδώ είναι ό,τι θα πάρει κάθε νέο συμφωνητικό.
 */

import { removeAt, replaceAt } from '@/lib/array-utils';
import { judgeClauseSelections, type ApprovedLibrary } from '../agreements/judge-deviations';
import { templateClauseInputsOf } from '../agreements/draft-from-template';
import type { SubcontractIssue } from '../clauses/clause-issues';
import { latinKeyOf, uniqueKey } from '../clauses/parameter-definition-edits';
import { libraryParametersOf } from '../library/seed-template-readiness';
import type { SubcontractAgreement } from '../types/agreement';
import type { ClauseKey } from '../types/clause';
import type { ClauseParameterValue } from '../types/clause-parameter';
import type { SubcontractTradeTemplateDefinition, TemplateClauseRef } from '../types/trade-template';
import { CLAUSE_KEY_PATTERN } from '../clauses/validate-clause-version';
import { validateTemplateAgainstLibrary, validateTradeTemplateDefinition } from './validate-trade-template';

const TEMPLATE_CODE_MAX = 64;

export type TemplateEditorMode = 'create' | 'edit';

/** Ό,τι ορίζει ο άνθρωπος από ένα αποθηκευμένο πρότυπο — το περίβλημα το γράφει ο γραφέας. */
export function templateDefinitionOf(template: SubcontractTradeTemplateDefinition): SubcontractTradeTemplateDefinition {
  const { code, trade, title, defaultDocumentMode, lines, clauses, defaultTerms } = template;
  return { code, trade, title, defaultDocumentMode, lines, clauses, defaultTerms };
}

/** Νέο πρότυπο από ένα υπάρχον: ίδιες γραμμές, ρήτρες και όροι· κωδικός και τίτλος από τον άνθρωπο. */
export function newTemplateFrom(source: SubcontractTradeTemplateDefinition): SubcontractTradeTemplateDefinition {
  return { ...templateDefinitionOf(source), code: '', title: { el: '' } };
}

/** Κωδικός από τον τίτλο: «Σκυροδετήσεις» ⇒ `skyrodetiseis`, ποτέ πιασμένος. */
export function templateCodeFromTitle(title: string, taken: ReadonlySet<string>): string {
  return uniqueKey(latinKeyOf(title, 'template', TEMPLATE_CODE_MAX), taken, TEMPLATE_CODE_MAX);
}

// ── Ρήτρες του προτύπου ──────────────────────────────────────────────────────

export function addClauseRef(definition: SubcontractTradeTemplateDefinition, clauseKey: ClauseKey): SubcontractTradeTemplateDefinition {
  if (definition.clauses.some((ref) => ref.clauseKey === clauseKey)) return definition;
  return { ...definition, clauses: [...definition.clauses, { clauseKey, parameterOverrides: {} }] };
}

export function removeClauseRef(definition: SubcontractTradeTemplateDefinition, index: number): SubcontractTradeTemplateDefinition {
  return { ...definition, clauses: removeAt(definition.clauses, index) };
}

/** Τιμή του προτύπου για μια παράμετρο· `null` = «όπως στη βιβλιοθήκη» (το κλειδί **φεύγει**). */
export function setOverride(
  definition: SubcontractTradeTemplateDefinition,
  index: number,
  key: string,
  value: ClauseParameterValue | null,
): SubcontractTradeTemplateDefinition {
  const ref = definition.clauses[index];
  if (!ref) return definition;
  const rest = Object.fromEntries(Object.entries(ref.parameterOverrides).filter(([existing]) => existing !== key));
  const next: TemplateClauseRef = { ...ref, parameterOverrides: value === null ? rest : { ...rest, [key]: value } };
  return { ...definition, clauses: replaceAt(definition.clauses, index, next) };
}

// ── Ο κριτής ─────────────────────────────────────────────────────────────────

export interface TemplateDraftContext {
  readonly mode: TemplateEditorMode;
  /** Οι κωδικοί των άλλων προτύπων του χώρου (και αρχειοθετημένων: το id είναι ντετερμινιστικό από τον κωδικό). */
  readonly takenCodes: ReadonlySet<string>;
  readonly library: ApprovedLibrary;
}

export function judgeTemplateDraft(definition: SubcontractTradeTemplateDefinition, context: TemplateDraftContext): SubcontractIssue[] {
  const own = validateTradeTemplateDefinition(definition);
  const taken = context.mode === 'create' && CLAUSE_KEY_PATTERN.test(definition.code) && context.takenCodes.has(definition.code);
  const library = validateTemplateAgainstLibrary(definition, libraryParametersOf(context.library));
  return [...own, ...(taken ? [{ code: 'templateCodeTaken' as const, path: 'code' }] : []), ...library];
}

// ── Δείγμα εγγράφου ──────────────────────────────────────────────────────────

const BLANK_PARTY = {
  contactId: '', fatherName: null, name: '', vatNumber: '', profession: null, hasTaxIdentity: true, taxOffice: null,
  street: '', city: null, postalCode: null, country: null, phone: null, email: null,
} as const;

const BLANK_ISSUER = {
  name: '', vatNumber: '', taxOffice: '', address: '', city: '', postalCode: '', phone: null, mobile: null, email: null,
  website: null, profession: '', bankAccounts: [],
} as const;

const BLANK_PROJECT = {
  projectId: '', name: '', address: '', licenseNumber: null, issuingAuthority: null, buildingBlock: null, plotNumber: null, buildingIds: [],
} as const;

/** Το συμφωνητικό που θα έβγαινε από αυτό το πρότυπο σήμερα — κενά μέρη και έργο, όπως ένα έντυπο. */
export function specimenAgreementOf(definition: SubcontractTradeTemplateDefinition, library: ApprovedLibrary): SubcontractAgreement {
  const { inputs } = templateClauseInputsOf(definition.clauses, library);
  const { selections } = judgeClauseSelections(inputs, library, definition.defaultTerms, [], { uid: '' });
  return {
    id: '', companyId: '', documentNumber: '', role: 'offer', documentMode: definition.defaultDocumentMode, sourceOfferId: null,
    agreementId: null, origin: { kind: 'direct' }, trade: definition.trade, templateId: null, title: definition.title, status: 'draft',
    parties: { issuer: BLANK_ISSUER, subcontractor: BLANK_PARTY, projectOwners: { kind: 'none' }, issuerSignatory: null },
    scope: { kind: 'single_project', project: BLANK_PROJECT }, projectIds: [], lines: definition.lines, terms: definition.defaultTerms,
    clauses: selections, languages: { secondary: null }, validUntil: null, mobilizedOn: null, issuedRevision: null, revision: 0,
    createdAt: '', updatedAt: '', issuedAt: null, acceptedAt: null, createdBy: '', updatedBy: '',
  };
}

