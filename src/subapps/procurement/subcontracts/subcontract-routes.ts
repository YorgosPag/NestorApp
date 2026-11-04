/**
 * Οι **διαδρομές API** των συμφωνητικών υπεργολαβίας (ADR-928 §5.14 · Φ3α-2) — η **μία** ονομασία τους για τον πελάτη,
 * όπως το `catalog-routes` του ADR-923: τα routes του Next.js ζουν στο σύστημα αρχείων, και μετονομασία φακέλου πρέπει να
 * σπάει **ένα** σημείο, όχι κάθε κουμπί.
 * @module subapps/procurement/subcontracts/subcontract-routes
 */

import type { SubcontractAgreementTransition } from './types/agreement';

const AGREEMENTS = '/api/subcontracts/agreements';

const agreement = (id: string) => `${AGREEMENTS}/${encodeURIComponent(id)}`;

const CLAUSES = '/api/subcontracts/clauses';
const TRADE_TEMPLATES = '/api/subcontracts/trade-templates';

const clause = (clauseId: string) => `${CLAUSES}/${encodeURIComponent(clauseId)}`;
const clauseVersion = (clauseId: string, version: number) => `${clause(clauseId)}/versions/${version}`;
const tradeTemplate = (id: string) => `${TRADE_TEMPLATES}/${encodeURIComponent(id)}`;

/** Πράξεις πάνω σε **μία** έκδοση ρήτρας (ADR-928 §5.13 · Φ3γ-0). */
export const CLAUSE_VERSION_ACTIONS = ['approve', 'reject', 'withdraw', 'review'] as const;
export type ClauseVersionAction = (typeof CLAUSE_VERSION_ACTIONS)[number];

export const SUBCONTRACT_API = {
  library: {
    seed: '/api/subcontracts/library/seed',
  },
  clauses: {
    collection: CLAUSES,
    archive: (clauseId: string) => `${clause(clauseId)}/archive`,
    versions: (clauseId: string) => `${clause(clauseId)}/versions`,
    versionAction: (clauseId: string, version: number, action: ClauseVersionAction) => `${clauseVersion(clauseId, version)}/${action}`,
    translations: (clauseId: string, version: number) => `${clauseVersion(clauseId, version)}/translations`,
    approveTranslation: (clauseId: string, version: number, language: string) =>
      `${clauseVersion(clauseId, version)}/translations/${encodeURIComponent(language)}/approve`,
  },
  tradeTemplates: {
    collection: TRADE_TEMPLATES,
    item: tradeTemplate,
    archive: (id: string) => `${tradeTemplate(id)}/archive`,
  },
  agreements: {
    collection: AGREEMENTS,
    item: agreement,
    transition: (id: string, transition: SubcontractAgreementTransition) => `${agreement(id)}/transitions/${transition}`,
    assignments: (id: string) => `${agreement(id)}/assignments`,
    decideDeviation: (id: string) => `${agreement(id)}/deviations/decide`,
  },
} as const;
