/**
 * @fileoverview **Το πρόχειρο συμφωνητικού όπως το στέλνει ο άνθρωπος** — και η επικύρωσή του (ADR-928 §5.4 · Φ2).
 * @module subapps/procurement/subcontracts/agreements/agreement-draft
 *
 * 🔑 **Ids, όχι στιγμιότυπα** (Φ2 απόφαση 4): ο πελάτης λέει *ποιο* έργο, *ποια* επαφή, *ποιοι* οικοπεδούχοι· τα
 * στοιχεία που τυπώνονται τα διαβάζει ο διακομιστής από τις πηγές τους. Δεν υπάρχει πεδίο για να «πλαστογραφηθεί» ο
 * εκδότης ή ο ΑΦΜ του υπεργολάβου.
 * 🔑 Η επικύρωση εδώ είναι **καθαρή** και συνθέτει τους επικυρωτές της Φ1 (γραμμές · όροι · σχέδιο πληρωμών) — η κρίση
 * απέναντι στη βιβλιοθήκη (`judge-deviations`) και στις πηγές μερών γίνεται μέσα στη συναλλαγή.
 */

import type { CalendarDay } from '@/constants/platform-operator';
import type { SignatoryFieldSet } from '@/subapps/procurement/types/signatory-fields';
import { TRADE_CODES, type TradeCode } from '@/subapps/procurement/types/trade';
import { joinPath, type SubcontractIssue } from '../clauses/clause-issues';
import { hasAuthoritativeText } from '../clauses/validate-parameter-definition';
import { isSecondaryLanguage } from '../clauses/validate-clause-version';
import { validateAgreementLines } from '../lines/validate-agreement-line';
import { validateCommercialTerms } from '../terms/validate-commercial-terms';
import type { AgreementLine } from '../types/agreement-line';
import type { AgreementLanguages, AgreementOrigin } from '../types/agreement';
import type { LocalizedText } from '../types/clause-parameter';
import type { CommercialTerms } from '../types/commercial-terms';
import { AGREEMENT_DOCUMENT_MODES, type AgreementDocumentMode } from '../types/trade-template';
import type { ClauseSelectionInput } from './judge-deviations';
import { isPastValidity } from './agreement-lifecycle';

export type AgreementScopeInput =
  | { readonly kind: 'single_project'; readonly projectId: string; readonly buildingIds: readonly string[] }
  | { readonly kind: 'multi_project' };

export type ProjectOwnersInput =
  | { readonly kind: 'none' }
  | { readonly kind: 'collective' }
  | { readonly kind: 'named'; readonly contactIds: readonly string[] };

/** Ό,τι γράφει ο άνθρωπος — το περίβλημα (id, αριθμός, κατάσταση, στιγμιότυπα, σφραγίδες) το γράφει ο γραφέας. */
export interface SubcontractAgreementDraftInput {
  readonly documentMode: AgreementDocumentMode;
  readonly origin: AgreementOrigin;
  readonly trade: TradeCode;
  readonly templateId: string | null;
  readonly title: LocalizedText;
  readonly scope: AgreementScopeInput;
  readonly subcontractorContactId: string;
  readonly projectOwners: ProjectOwnersInput;
  readonly issuerSignatory: SignatoryFieldSet | null;
  readonly lines: readonly AgreementLine[];
  readonly terms: CommercialTerms;
  readonly clauses: readonly ClauseSelectionInput[];
  readonly languages: AgreementLanguages;
  readonly validUntil: CalendarDay | null;
}

const KNOWN_TRADES: ReadonlySet<string> = new Set(TRADE_CODES);

function identityIssues(input: SubcontractAgreementDraftInput, today: CalendarDay): SubcontractIssue[] {
  const issues: SubcontractIssue[] = [];
  if (!KNOWN_TRADES.has(input.trade)) issues.push({ code: 'tradeUnknown', path: 'trade' });
  if (!hasAuthoritativeText(input.title)) issues.push({ code: 'clauseTitleRequired', path: 'title' });
  if (!AGREEMENT_DOCUMENT_MODES.includes(input.documentMode)) issues.push({ code: 'parameterValueInvalid', path: 'documentMode' });
  if (input.languages.secondary !== null && !isSecondaryLanguage(input.languages.secondary)) {
    issues.push({ code: 'translationLanguageInvalid', path: 'languages.secondary' });
  }
  if (isPastValidity(input.validUntil, today)) issues.push({ code: 'validUntilPast', path: 'validUntil' });
  return issues;
}

/** Μοναδικά, μη κενά ids — κτίρια του έργου, οικοπεδούχοι. */
function idListIssues(ids: readonly string[], path: string): SubcontractIssue[] {
  const seen = new Set<string>();
  return ids.flatMap((id, index) => {
    const bad = id.trim().length === 0 || seen.has(id);
    seen.add(id);
    return bad ? [{ code: 'parameterValueInvalid' as const, path: joinPath(path, index) }] : [];
  });
}

function partyIssues(input: SubcontractAgreementDraftInput): SubcontractIssue[] {
  const issues: SubcontractIssue[] = [];
  if (input.subcontractorContactId.trim().length === 0) issues.push({ code: 'contactUnknown', path: 'subcontractorContactId' });
  if (input.scope.kind === 'single_project') {
    if (input.scope.projectId.trim().length === 0) issues.push({ code: 'projectUnknown', path: 'scope.projectId' });
    issues.push(...idListIssues(input.scope.buildingIds, 'scope.buildingIds'));
  }
  if (input.projectOwners.kind === 'named') {
    if (input.projectOwners.contactIds.length === 0) issues.push({ code: 'contactUnknown', path: 'projectOwners.contactIds' });
    issues.push(...idListIssues(input.projectOwners.contactIds, 'projectOwners.contactIds'));
  }
  return issues;
}

/** Η καθαρή επικύρωση του πρόχειρου — όλα τα ευρήματα, όχι το πρώτο. `today`: ημερολογιακή μέρα Ελλάδας. */
export function validateAgreementDraft(input: SubcontractAgreementDraftInput, today: CalendarDay): SubcontractIssue[] {
  const lineIds = new Set(input.lines.map((line) => line.id));
  return [
    ...identityIssues(input, today),
    ...partyIssues(input),
    ...validateAgreementLines(input.lines, 'lines'),
    ...validateCommercialTerms(input.terms, 'terms', lineIds),
  ];
}
