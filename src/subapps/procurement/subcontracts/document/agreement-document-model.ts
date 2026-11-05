/**
 * @fileoverview **Το έγγραφο της υπεργολαβίας ως δεδομένα** — στιγμιότυπο → `AgreementDocument` σε μία γλώσσα
 *   (ADR-928 §5.17). Το διαβάζουν η προεπισκόπηση HTML (Φ3) και το Typst (Φ4).
 * @module subapps/procurement/subcontracts/document/agreement-document-model
 *
 * 🔑 Είσοδος = `SubcontractAgreementSnapshot`, το **ίδιο** που παγώνει ο γραφέας στο `issue` (`buildAgreementSnapshot`).
 *    Προεπισκόπηση πρόχειρου και PDF αναθεώρησης περνούν από εδώ ⇒ WYSIWYG δομικά, όχι με σύγκριση.
 * 🔑 Μετάφραση που λείπει ⇒ ο όρος τυπώνεται ελληνικά με ορατή σημείωση **και** εύρημα `translationMissing`
 *    (ο ίδιος κωδικός με τον γραφέα, `bilingualIssues`): η οθόνη δείχνει γιατί το δίγλωσσο δεν θα εκδοθεί.
 */

import type { HumanLanguage } from '@/i18n/languages';
import { bilingualIssues } from '../agreements/agreement-snapshot';
import { estimatedAgreementValue, estimatedLineAmount } from '../lines/line-amount';
import { CLAUSE_AUTHORITATIVE_LANGUAGE } from '../types/clause';
import type { AgreementLine } from '../types/agreement-line';
import type { AgreementParties, FrozenClause, SubcontractAgreementSnapshot } from '../types/agreement';
import type { CommercialTerms } from '../types/commercial-terms';
import { describePaymentPlan } from './describe-payment-plan';
import { documentLocaleOf, type DocumentLocale } from './document-locale';
import type { AgreementDocument, DocumentClause, DocumentLineRow, DocumentParty, DocumentTotals } from './document-types';
import { scopeFields, workOrderSections } from './document-work-orders';
import { renderClauseBlocks } from './render-clause-body';
import { localizedIn } from './render-parameter-value';

const MILLI = 1000;
const WHOLE_PERCENT_IN_BP = 100;

const present = (values: readonly (string | null | undefined)[]): string[] =>
  values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

interface PartyFacts {
  readonly vatNumber: string | null;
  readonly taxOffice: string | null;
  readonly profession: string | null;
  readonly address: readonly (string | null)[];
  readonly phone: string | null;
  readonly email: string | null;
}

function partyDetails(facts: PartyFacts, locale: DocumentLocale): string[] {
  return present([
    facts.profession,
    facts.vatNumber ? locale.phrase('parties.vat', { vat: facts.vatNumber }) : null,
    facts.taxOffice ? locale.phrase('parties.taxOffice', { office: facts.taxOffice }) : null,
    present(facts.address).join(', '),
    facts.phone,
    facts.email,
  ]);
}

function ownersParty(parties: AgreementParties, locale: DocumentLocale): DocumentParty[] {
  const owners = parties.projectOwners;
  const role = locale.phrase('parties.projectOwner');
  if (owners.kind === 'none') return [];
  if (owners.kind === 'collective') return [{ role, name: locale.phrase('parties.projectOwnersCollective'), details: [] }];
  return owners.owners.map((owner) => ({
    role,
    name: owner.name,
    details: partyDetails({ ...owner, address: [owner.street, owner.postalCode, owner.city] }, locale),
  }));
}

function partiesOf(parties: AgreementParties, locale: DocumentLocale): DocumentParty[] {
  const { issuer, subcontractor } = parties;
  const subcontractorName = subcontractor.fatherName
    ? `${subcontractor.name} ${locale.phrase('parties.fatherName', { name: subcontractor.fatherName })}`
    : subcontractor.name;
  return [
    { role: locale.phrase('parties.issuer'), name: issuer.name, details: partyDetails({ ...issuer, address: [issuer.address, issuer.postalCode, issuer.city] }, locale) },
    { role: locale.phrase('parties.subcontractor'), name: subcontractorName, details: partyDetails({ ...subcontractor, address: [subcontractor.street, subcontractor.postalCode, subcontractor.city] }, locale) },
    ...ownersParty(parties, locale),
  ];
}

function lineRow(line: AgreementLine, index: number, locale: DocumentLocale): DocumentLineRow {
  const amount = estimatedLineAmount(line);
  const quantity = line.estimatedMilliQuantity === null || line.pricing === 'lump_sum' ? null : locale.number(line.estimatedMilliQuantity / MILLI);
  return {
    number: index + 1,
    description: localizedIn(line.description, locale.language),
    kind: locale.phrase(`lines.kind.${line.kind}`),
    pricing: locale.phrase(`lines.pricing.${line.pricing}`),
    unit: locale.unit(line.unit),
    quantity,
    unitPrice: locale.money(line.unitPrice),
    amount: amount === null ? null : locale.money(amount),
    amountInWords: amount === null ? null : locale.words(amount),
    comment: line.comment,
    measurementRule: line.measurementRule ? renderClauseBlocks(line.measurementRule.blocks, { parameters: [], values: {} }, locale) : [],
  };
}

function totalsOf(lines: readonly AgreementLine[], terms: CommercialTerms, locale: DocumentLocale): DocumentTotals {
  const { amount, unpricedLines } = estimatedAgreementValue(lines);
  const isLowerBound = unpricedLines > 0;
  const vatRate = locale.percent(terms.vat.rate * WHOLE_PERCENT_IN_BP);
  return {
    label: locale.phrase('totals.value'),
    value: isLowerBound ? locale.phrase('totals.lowerBound', { amount: locale.money(amount) }) : locale.money(amount),
    isLowerBound,
    unpricedNote: isLowerBound ? locale.phrase('totals.unpriced', { count: unpricedLines }) : null,
    valueInWords: isLowerBound ? null : locale.words(amount),
    vatNote: locale.phrase(terms.vat.treatment === 'excluded' ? 'totals.vatExcluded' : 'totals.vatIncluded', { rate: vatRate }),
  };
}

function crewSentences(terms: CommercialTerms, locale: DocumentLocale): string[] {
  if (!terms.crew) return [];
  const members = terms.crew.members.map((member) => {
    const base = { role: localizedIn(member.role, locale.language), parts: locale.number(member.ratioParts) };
    return member.dailyWage === null ? locale.phrase('terms.crewMember', base) : locale.phrase('terms.crewWage', { ...base, wage: locale.money(member.dailyWage) });
  });
  return [locale.phrase('terms.crew', { count: terms.crew.minimumHeadcount }), ...members];
}

function documentsSentence(terms: CommercialTerms, locale: DocumentLocale): string[] {
  if (terms.requiredDocuments.length === 0) return [];
  const documents = terms.requiredDocuments.map((document) => {
    const { when } = document;
    const whenText = when.kind === 'before_each_payment'
      ? locale.phrase('terms.documentWhen.before_each_payment')
      : when.days === 0 ? locale.phrase('terms.documentWhen.on_start') : locale.phrase('terms.documentWhen.days_before_start', { days: when.days });
    return locale.phrase('terms.requiredDocument', { document: locale.phrase(`terms.documentKind.${document.kind}`), when: whenText });
  });
  return [locale.phrase('terms.requiredDocuments', { documents: locale.list(documents) })];
}

function termSentences(terms: CommercialTerms, locale: DocumentLocale): string[] {
  const sentences = [
    terms.withholding.applies ? locale.phrase('terms.withholding', { rate: locale.percent(terms.withholding.rate) }) : locale.phrase('terms.noWithholding'),
  ];
  if (terms.penalty) {
    sentences.push(locale.phrase('terms.penalty', { perDay: locale.money(terms.penalty.perDay), cap: locale.percent(terms.penalty.capOfContractValue) }));
  }
  sentences.push(...crewSentences(terms, locale));
  for (const item of terms.costSharing) {
    const shares = locale.list(item.shares.map((share) => locale.phrase('terms.share', { party: locale.phrase(`parameter.party.${share.party}`), share: locale.percent(share.share) })));
    sentences.push(locale.phrase('terms.costSharing', { description: localizedIn(item.description, locale.language), shares }));
  }
  sentences.push(...documentsSentence(terms, locale), locale.phrase('terms.cashLimit', { amount: locale.money(terms.cashLimitPerPayment) }));
  return sentences;
}

function clauseOf(clause: FrozenClause, index: number, locale: DocumentLocale): DocumentClause {
  const authoritative = locale.language === CLAUSE_AUTHORITATIVE_LANGUAGE;
  const translated = authoritative ? clause.body : clause.translations[locale.language]?.body;
  const body = translated ?? clause.body;
  return {
    clauseKey: clause.clauseKey,
    number: index + 1,
    heading: body.heading,
    blocks: renderClauseBlocks(body.blocks, clause, locale),
    untranslatedNote: translated ? null : locale.phrase('document.untranslatedClause'),
  };
}

function signatoryOf(parties: AgreementParties, locale: DocumentLocale): string | null {
  const signatory = parties.issuerSignatory;
  if (!signatory) return null;
  const name = present([signatory.firstName, signatory.lastName]).join(' ');
  return locale.phrase('parties.signatory', { name: present([name, signatory.role]).join(', ') });
}

/** Το έγγραφο σε μία γλώσσα. Δίγλωσσο = δύο κλήσεις (el + δεύτερη), σε παράλληλες στήλες. */
export function buildAgreementDocument(snapshot: SubcontractAgreementSnapshot, language: HumanLanguage): AgreementDocument {
  const locale = documentLocaleOf(language);
  const isAuthoritative = language === CLAUSE_AUTHORITATIVE_LANGUAGE;
  return {
    language,
    isAuthoritative,
    prevailingNotice: isAuthoritative ? null : locale.phrase('document.prevailing'),
    kindLabel: locale.phrase(`document.role.${snapshot.role}`),
    documentNumber: locale.phrase('document.number', { number: snapshot.documentNumber }),
    title: localizedIn(snapshot.title, language),
    validUntil: snapshot.validUntil ? locale.phrase('document.validUntil', { day: locale.day(snapshot.validUntil) }) : null,
    labels: sectionLabels(locale),
    parties: partiesOf(snapshot.parties, locale),
    signatory: signatoryOf(snapshot.parties, locale),
    project: scopeFields(snapshot.scope, locale),
    workOrders: workOrderSections(snapshot.scope, locale),
    lines: snapshot.lines.map((line, index) => lineRow(line, index, locale)),
    totals: totalsOf(snapshot.lines, snapshot.terms, locale),
    terms: termSentences(snapshot.terms, locale),
    paymentPlan: describePaymentPlan(snapshot.terms.paymentPlan, locale),
    clauses: snapshot.frozenClauses.map((clause, index) => clauseOf(clause, index, locale)),
    issues: isAuthoritative ? [] : bilingualIssues(snapshot.frozenClauses, language),
  };
}

function sectionLabels(locale: DocumentLocale): AgreementDocument['labels'] {
  const column = (key: string) => locale.phrase(`lines.columns.${key}`);
  return {
    parties: locale.phrase('sections.parties'),
    project: locale.phrase('sections.project'),
    workOrders: locale.phrase('sections.workOrders'),
    lines: locale.phrase('sections.lines'),
    terms: locale.phrase('sections.terms'),
    paymentPlan: locale.phrase('sections.paymentPlan'),
    clauses: locale.phrase('sections.clauses'),
    columns: {
      number: column('number'), description: column('description'), unit: column('unit'),
      quantity: column('quantity'), unitPrice: column('unitPrice'), amount: column('amount'),
    },
    byMeasurement: locale.phrase('lines.byMeasurement'),
  };
}
