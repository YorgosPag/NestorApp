/**
 * Κατάλογος — Δ. Έγγραφα της ΣΥΝΑΛΛΑΓΗΣ (ADR-901 §5.5 πίνακας Δ).
 *
 * Παράγονται μέσα στην υπόθεση. Τα συμβόλαια του εργολάβου (ADR-230) ανεβαίνουν ως
 * `unit-contract` στη μονάδα. Η έκθεση νομικού ελέγχου είναι `ownSideOnly` (Σ-3).
 *
 * ⚠️ v0 — `verifiedAt: null` μέχρι τον έλεγχο Φ0 (ADR-901 §11).
 *
 * @module config/conveyance-checklist/items-transaction
 */

import type { ChecklistItem } from './types';
import { EVERYONE, LAWYERS_ONLY } from './visibility';

export const TRANSACTION_ITEMS: readonly ChecklistItem[] = [
  {
    id: 'preliminary_agreement',
    section: 'transaction',
    labelKey: 'items.preliminary_agreement.label',
    provider: 'seller',
    visibleTo: EVERYONE,
    requirement: { kind: 'mandatory' },
    validity: { kind: 'none' },
    satisfaction: { kind: 'files', matchers: [{ level: 'property', entryPointIds: ['unit-contract'] }] },
    verifiedAt: null,
  },
  {
    id: 'vat_or_suspension',
    section: 'transaction',
    labelKey: 'items.vat_or_suspension.label',
    provider: 'seller',
    visibleTo: EVERYONE,
    requirement: { kind: 'when', fact: 'is_new_build', equals: true },
    validity: { kind: 'act_day' },
    satisfaction: { kind: 'offline' },
    verifiedAt: null,
  },
  {
    id: 'transfer_tax_proof',
    section: 'transaction',
    labelKey: 'items.transfer_tax_proof.label',
    provider: 'notary',
    visibleTo: EVERYONE,
    requirement: { kind: 'when', fact: 'is_new_build', equals: false },
    validity: { kind: 'act_day' },
    satisfaction: { kind: 'notary_issued' },
    verifiedAt: null,
  },
  {
    id: 'legal_due_diligence_report',
    section: 'transaction',
    labelKey: 'items.legal_due_diligence_report.label',
    provider: 'lawyer',
    visibleTo: LAWYERS_ONLY,
    ownSideOnly: true,
    requirement: { kind: 'mandatory' },
    validity: { kind: 'none' },
    satisfaction: { kind: 'offline' },
    verifiedAt: null,
  },
  {
    id: 'contract_draft',
    section: 'transaction',
    labelKey: 'items.contract_draft.label',
    provider: 'notary',
    visibleTo: EVERYONE,
    requirement: { kind: 'mandatory' },
    validity: { kind: 'none' },
    satisfaction: { kind: 'notary_issued' },
    verifiedAt: null,
  },
  {
    id: 'final_contract',
    section: 'transaction',
    labelKey: 'items.final_contract.label',
    provider: 'notary',
    visibleTo: EVERYONE,
    requirement: { kind: 'mandatory' },
    validity: { kind: 'none' },
    satisfaction: { kind: 'notary_issued' },
    verifiedAt: null,
  },
  {
    id: 'payoff_receipt',
    section: 'transaction',
    labelKey: 'items.payoff_receipt.label',
    provider: 'seller',
    visibleTo: EVERYONE,
    requirement: { kind: 'mandatory' },
    validity: { kind: 'none' },
    satisfaction: { kind: 'offline' },
    verifiedAt: null,
  },
  {
    id: 'cadastre_registration_proof',
    section: 'transaction',
    labelKey: 'items.cadastre_registration_proof.label',
    provider: 'notary',
    visibleTo: EVERYONE,
    requirement: { kind: 'mandatory' },
    validity: { kind: 'none' },
    satisfaction: { kind: 'notary_issued' },
    verifiedAt: null,
  },
];
