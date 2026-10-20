/**
 * @fileoverview ADR-915 §35 — **οι λέξεις της ενότητας «Μόνιμες υποχρεώσεις»**: κάθε χάρτης δεμένος στη ρίζα του
 *   λεξιλογίου (`lib/document-validity/property-upkeep.ts`).
 * @related document-registry-labels.ts (το ιδίωμα) · RegistryUpkeepPanel.tsx
 * @module components/document-registry/upkeep-labels
 *
 * 🔑 Οι κατάλογοι `upkeep.decision` · `upkeep.exemption` · `upkeep.verdict` είναι **οι ίδιοι** με του ιστορικού
 *    (`audit-value-catalogs.ts`, CHECK 3.14): μία ετικέτα ανά τιμή, στην οθόνη και στην καρτέλα «Ιστορικό». Γι' αυτό τα
 *    κλειδιά είναι camelCase ενώ οι τιμές kebab (`not-required` → `notRequired`).
 * ⚠️ Κυριολεκτικά κλειδιά (template σε σταθερά module): ο γεννήτορας του route slice τα **λύνει** στατικά.
 */

import type {
  UpkeepDecision,
  UpkeepExemptionReason,
  UpkeepProposalReason,
} from '@/lib/document-validity/property-upkeep';
import type { UpkeepDeclarationRefusal } from '@/lib/document-validity/upkeep-declaration-request';

const K = 'document-registry:upkeep.';

export const UPKEEP_KEYS = {
  title: `${K}title`,
  lead: `${K}lead`,
  pending: `${K}pending`,
  statute: `${K}statute`,
  decidedOn: `${K}decidedOn`,
  overrode: `${K}overrode`,
  confirm: `${K}confirm`,
  exempt: `${K}exempt`,
  exemptLegend: `${K}exemptLegend`,
  saveExempt: `${K}saveExempt`,
  reask: `${K}reask`,
  cancel: `${K}cancel`,
  saving: `${K}saving`,
  saved: `${K}saved`,
  proposalChanged: `${K}proposalChanged`,
  loadFailed: `${K}loadFailed`,
} as const;

/**
 * §36 — **πού** ζει η ενότητα: μητρώο (όλο το χαρτοφυλάκιο) ή καρτέλα ενός ακινήτου. Χάρτης με κυριολεκτικές τιμές, όχι
 * κλειδί ως prop: ο γεννήτορας του route slice (3.34) λύνει μόνο ό,τι βλέπει στατικά.
 */
export const UPKEEP_SECTION_PLACES = ['registry', 'property'] as const;
export type UpkeepSectionPlace = (typeof UPKEEP_SECTION_PLACES)[number];

export const UPKEEP_SECTION_TITLE_KEYS: Readonly<Record<UpkeepSectionPlace, string>> = {
  registry: `${K}title`,
  property: `${K}propertyTitle`,
};

export const UPKEEP_PROPOSAL_KEYS: Readonly<Record<UpkeepProposalReason, string>> = {
  'in-use': `${K}proposal.inUse`,
  'phase-undeclared': `${K}proposal.phaseUndeclared`,
  class: `${K}proposal.class`,
  phase: `${K}proposal.phase`,
  'class-unknown': `${K}proposal.classUnknown`,
};

export const UPKEEP_DECISION_KEYS: Readonly<Record<UpkeepDecision, string>> = {
  required: `${K}decision.required`,
  'not-required': `${K}decision.notRequired`,
};

export const UPKEEP_EXEMPTION_KEYS: Readonly<Record<UpkeepExemptionReason, string>> = {
  'no-own-supply': `${K}exemption.noOwnSupply`,
  'not-connected': `${K}exemption.notConnected`,
  other: `${K}exemption.other`,
};

/** Κάθε άρνηση λέει **γιατί**· `failed` = δίκτυο / άγνωστος κωδικός. */
export const UPKEEP_ERROR_KEYS: Readonly<Record<UpkeepDeclarationRefusal | 'failed', string>> = {
  failed: `${K}error.failed`,
  absent: `${K}error.absent`,
  retired: `${K}error.retired`,
  'not-standing': `${K}error.notStanding`,
};
