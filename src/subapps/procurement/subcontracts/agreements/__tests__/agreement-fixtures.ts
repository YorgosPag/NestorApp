/**
 * Κοινά δεδομένα των tests του συμφωνητικού (ADR-928 Φ2) — ένας ορισμός, πολλές σουίτες (CHECK 3.28).
 */

import { DEFAULT_TRADE_TEMPLATES } from '@/config/subcontracts/default-trade-templates';
import { paymentInstrument, retentionRate } from '../../clauses/__tests__/clause-fixtures';
import type { ClauseParameterDefinition } from '../../types/clause-parameter';
import type { CommercialTerms } from '../../types/commercial-terms';
import type { AgreementLine } from '../../types/agreement-line';
import type { ProjectIdentitySnapshot, SubcontractAgreement } from '../../types/agreement';
import type { SubcontractAgreementDraftInput } from '../agreement-draft';
import type { ApprovedLibrary, ClauseSelectionInput } from '../judge-deviations';

/** Η κράτηση **δεμένη** στον εμπορικό όρο: η τιμή ζει στα `CommercialTerms` (Φ1 απόφαση 2). Ζώνες 5–10%, όριο 3–15%. */
export const boundRetention: ClauseParameterDefinition = { ...retentionRate, source: { kind: 'term', term: 'retention.rate' } };

/** Οι όροι του προτύπου επιχρισμάτων (κράτηση 5%, ποινή) — περνούν ήδη τους επικυρωτές της Φ1. */
export const plasteringTerms: CommercialTerms = (() => {
  const template = DEFAULT_TRADE_TEMPLATES.find((candidate) => candidate.defaultTerms.paymentPlan.retention !== null);
  if (!template) throw new Error('fixture: δεν βρέθηκε πρότυπο με κράτηση');
  return template.defaultTerms;
})();

export function termsWithRetention(rate: number): CommercialTerms {
  const retention = plasteringTerms.paymentPlan.retention;
  if (!retention) throw new Error('fixture: χωρίς κράτηση');
  return { ...plasteringTerms, paymentPlan: { ...plasteringTerms.paymentPlan, retention: { ...retention, rate } } };
}

export const LIBRARY: ApprovedLibrary = new Map([
  ['retention.performance', { clauseId: 'sccl_retention', version: 1, parameters: [boundRetention] }],
  ['payment.instruments', { clauseId: 'sccl_instruments', version: 2, parameters: [paymentInstrument] }],
  ['crew.composition', null],
]);

export const retentionInput: ClauseSelectionInput = { clauseKey: 'retention.performance', version: 1, parameterValues: {}, deviationReasons: {} };

export const instrumentInput = (value: string, reason?: string): ClauseSelectionInput => ({
  clauseKey: 'payment.instruments',
  version: 2,
  parameterValues: { instrument: { kind: 'enum', value } },
  deviationReasons: reason ? { instrument: reason } : {},
});

/** Μία γραμμή επιχρίσματος που περνά τον επικυρωτή γραμμών. */
export const SAMPLE_LINE: AgreementLine = {
  id: 'plaster', kind: 'labor', pricing: 'unit_rate', description: { el: 'Επίχρισμα τριπτό' }, atoeCode: null, skuRef: null,
  unit: 'm2', estimatedMilliQuantity: null, unitPrice: 900, clientUnitPrice: null, printClientPrice: false, comment: null,
  measurementRule: null, stages: [], insuredDaysCap: null, paymentOverride: null,
};

/** Ταυτότητα έργου όπως τη στιγμιοτυπεί ο γραφέας. */
export function sampleProjectIdentity(projectId = 'proj_1'): ProjectIdentitySnapshot {
  return {
    projectId, name: 'Πολυκατοικία Ευόσμου', address: 'Μ. Αλεξάνδρου 12, Εύοσμος', licenseNumber: null, issuingAuthority: null,
    buildingBlock: null, plotNumber: null, buildingIds: ['bld_1'],
  };
}

/**
 * Αποθηκευμένο συμφωνητικό όπως το διαβάζει η οθόνη (Φ3α-2: λίστα, ενέργειες) — πρόχειρο `single_project` με τις δύο
 * ρήτρες του `LIBRARY`, καρφωμένες στις εκδόσεις του. Ένα σημείο για κάθε σουίτα της οθόνης.
 */
export function sampleAgreement(patch: Partial<SubcontractAgreement> = {}): SubcontractAgreement {
  const party = { profession: null, hasTaxIdentity: true, taxOffice: null, street: '', city: null, postalCode: null, country: null, phone: null, email: null };
  return {
    id: 'sca_1', companyId: 'comp_1', documentNumber: 'ΠΡΟΣ-2026-001', role: 'offer', documentMode: 'offer_becomes_agreement',
    sourceOfferId: null, agreementId: null, origin: { kind: 'direct' }, trade: 'plastering', templateId: null,
    title: { el: 'Επιχρίσματα Β΄ φάσης', en: 'Plastering, phase B' }, status: 'draft',
    parties: {
      issuer: { name: 'Παγώνης ΑΕ', vatNumber: '099999999', taxOffice: 'Ζ΄ Θεσσαλονίκης', address: '', city: '', postalCode: '', phone: null, mobile: null, email: null, website: null, profession: '', bankAccounts: [] },
      subcontractor: { ...party, contactId: 'ct_sub', fatherName: null, name: 'Ιωάννης Σοβατζής', vatNumber: '123456789' },
      projectOwners: { kind: 'collective' }, issuerSignatory: null,
    },
    scope: { kind: 'single_project', project: sampleProjectIdentity() }, projectIds: ['proj_1'],
    lines: [SAMPLE_LINE], terms: { ...plasteringTerms, minimumOutputs: [] },
    clauses: [
      { clauseId: 'sccl_retention', clauseKey: 'retention.performance', version: 1, parameterValues: {}, deviations: {} },
      { clauseId: 'sccl_instruments', clauseKey: 'payment.instruments', version: 2, parameterValues: { instrument: { kind: 'enum', value: 'bank' } }, deviations: {} },
    ],
    languages: { secondary: null }, validUntil: '2099-12-31', mobilizedOn: null, issuedRevision: null, revision: 3,
    createdAt: '2026-11-01T08:00:00.000Z', updatedAt: '2026-11-02T08:00:00.000Z', issuedAt: null, acceptedAt: null,
    createdBy: 'u_author', updatedBy: 'u_author',
    ...patch,
  };
}

/** Έγκυρο πρόχειρο `single_project` (γραφείς Φ2 · κριτής δικαιωμάτων §5.15) — ένα σημείο, όχι αντίγραφο ανά σουίτα. */
export function sampleDraftInput(patch: Partial<SubcontractAgreementDraftInput> = {}): SubcontractAgreementDraftInput {
  return {
    documentMode: 'offer_becomes_agreement', origin: { kind: 'direct' }, trade: 'plastering', templateId: null,
    title: { el: 'Επιχρίσματα Β΄ φάσης' }, scope: { kind: 'single_project', projectId: 'proj_1', buildingIds: ['bld_1'] },
    subcontractorContactId: 'ct_sub', projectOwners: { kind: 'collective' }, issuerSignatory: null,
    lines: [SAMPLE_LINE], terms: { ...plasteringTerms, minimumOutputs: [] },
    clauses: [
      { clauseKey: 'retention.performance', version: 1, parameterValues: {}, deviationReasons: {} },
      { clauseKey: 'payment.instruments', version: 1, parameterValues: { instrument: { kind: 'enum', value: 'bank' } }, deviationReasons: {} },
    ],
    languages: { secondary: null }, validUntil: '2099-12-31',
    ...patch,
  };
}
