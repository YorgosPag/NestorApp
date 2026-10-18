/**
 * Κατάλογος — Α. Έγγραφα ΑΚΙΝΗΤΟΥ (ADR-901 §5.5 πίνακας Α).
 *
 * Πάροχος: πωλητής/εργολάβος ή ο μηχανικός του. Ορατά σε **όλους** (Ε-7: και ο αγοραστής,
 * μόνο ανάγνωση). ⚠️ v0 από δευτερογενείς πηγές — `verifiedAt: null` μέχρι τον έλεγχο Φ0.
 *
 * Οι αντιστοιχίσεις σε entry points είναι **μετρημένες** (ADR-901 §2 Ε-Γ): οι μελέτες
 * (`study-admin-*`, `study-energy-certificate`) και η `building-permit` προσφέρονται
 * ΜΟΝΟ στο επίπεδο `project`.
 *
 * @module config/conveyance-checklist/items-property
 */

import { documentKindSpec } from '@/config/document-validity/document-validity';
import { checklistProviderOfKind } from './document-kind-provider';
import type { ChecklistItem } from './types';
import { EVERYONE } from './visibility';

export const PROPERTY_ITEMS: readonly ChecklistItem[] = [
  {
    id: 'title_deed',
    section: 'property',
    labelKey: 'items.title_deed.label',
    provider: 'seller',
    visibleTo: EVERYONE,
    requirement: { kind: 'mandatory' },
    validity: { kind: 'none' },
    satisfaction: {
      kind: 'files',
      matchers: [
        { level: 'project', entryPointIds: ['study-admin-title-deed'] },
        { level: 'property', entryPointIds: ['unit-deed'] },
      ],
    },
    verifiedAt: null,
  },
  {
    id: 'antiparochi_contract',
    section: 'property',
    labelKey: 'items.antiparochi_contract.label',
    provider: 'seller',
    visibleTo: EVERYONE,
    requirement: { kind: 'when', fact: 'has_antiparochi', equals: true },
    validity: { kind: 'none' },
    satisfaction: { kind: 'files', matchers: [{ level: 'project', entryPointIds: ['project-contract'] }] },
    verifiedAt: null,
  },
  {
    id: 'cadastral_extract',
    section: 'property',
    labelKey: 'items.cadastral_extract.label',
    provider: 'seller',
    visibleTo: EVERYONE,
    requirement: { kind: 'mandatory' },
    validity: { kind: 'unverified' },
    satisfaction: {
      kind: 'files',
      matchers: [{ level: 'project', entryPointIds: ['study-admin-cadastre'] }],
      notaryFallback: true,
    },
    verifiedAt: null,
  },
  {
    id: 'encumbrance_certificate',
    section: 'property',
    labelKey: 'items.encumbrance_certificate.label',
    provider: 'notary',
    visibleTo: EVERYONE,
    requirement: { kind: 'mandatory' },
    validity: { kind: 'act_day' },
    satisfaction: {
      kind: 'files',
      matchers: [{ level: 'project', entryPointIds: ['study-admin-legal-status'] }],
      notaryFallback: true,
    },
    verifiedAt: null,
  },
  {
    id: 'building_permit',
    section: 'property',
    labelKey: 'items.building_permit.label',
    provider: 'seller',
    visibleTo: EVERYONE,
    requirement: { kind: 'mandatory' },
    validity: { kind: 'none' },
    satisfaction: {
      kind: 'files',
      matchers: [
        { level: 'project', entryPointIds: ['building-permit'] },
        { level: 'property', entryPointIds: ['unit-permit'] },
      ],
    },
    verifiedAt: null,
  },
  {
    id: 'topographic_plan',
    section: 'property',
    labelKey: 'items.topographic_plan.label',
    provider: 'engineer',
    visibleTo: EVERYONE,
    requirement: { kind: 'mandatory' },
    validity: { kind: 'none' },
    satisfaction: { kind: 'files', matchers: [{ level: 'project', entryPointIds: ['study-admin-topographic'] }] },
    verifiedAt: null,
  },
  {
    id: 'unit_floor_plans',
    section: 'property',
    labelKey: 'items.unit_floor_plans.label',
    provider: 'engineer',
    visibleTo: EVERYONE,
    requirement: { kind: 'mandatory' },
    validity: { kind: 'none' },
    satisfaction: { kind: 'files', matchers: [{ level: 'property', entryPointIds: ['unit-floor-plan'] }] },
    verifiedAt: null,
  },
  {
    id: 'appurtenance_floor_plans',
    section: 'property',
    labelKey: 'items.appurtenance_floor_plans.label',
    provider: 'engineer',
    visibleTo: EVERYONE,
    requirement: { kind: 'when', fact: 'has_appurtenances', equals: true },
    validity: { kind: 'none' },
    satisfaction: {
      kind: 'files',
      matchers: [{ level: 'appurtenance', entryPointIds: ['parking-floor-plan', 'storage-floor-plan'] }],
    },
    verifiedAt: null,
  },
  {
    id: 'section_drawings',
    section: 'property',
    labelKey: 'items.section_drawings.label',
    provider: 'engineer',
    visibleTo: EVERYONE,
    requirement: { kind: 'mandatory' },
    validity: { kind: 'none' },
    satisfaction: {
      kind: 'files',
      matchers: [
        { level: 'property', entryPointIds: ['unit-section-drawing'] },
        { level: 'project', entryPointIds: ['study-arch-section'] },
      ],
    },
    verifiedAt: null,
  },
  {
    id: 'horizontal_property_deed',
    section: 'property',
    labelKey: 'items.horizontal_property_deed.label',
    provider: 'seller',
    visibleTo: EVERYONE,
    requirement: { kind: 'when', fact: 'is_unit_in_multi_owner_building', equals: true },
    validity: { kind: 'none' },
    satisfaction: { kind: 'files', matchers: [{ level: 'project', entryPointIds: ['study-admin-regulation'] }] },
    verifiedAt: null,
  },
  {
    id: 'building_identity',
    section: 'property',
    labelKey: 'items.building_identity.label',
    provider: checklistProviderOfKind('building-identity'),
    visibleTo: EVERYONE,
    requirement: { kind: 'mandatory' },
    documentKind: 'building-identity',
    validity: documentKindSpec('building-identity').rule,
    satisfaction: { kind: 'offline' },
    verifiedAt: null,
  },
  {
    id: 'engineer_legality_certificate',
    section: 'property',
    labelKey: 'items.engineer_legality_certificate.label',
    provider: 'engineer',
    visibleTo: EVERYONE,
    requirement: { kind: 'when', fact: 'has_unauthorized_works', equals: true },
    validity: { kind: 'unverified' },
    satisfaction: { kind: 'offline' },
    verifiedAt: null,
  },
  {
    id: 'energy_certificate',
    section: 'property',
    labelKey: 'items.energy_certificate.label',
    // ADR-915 §18 — ο πάροχος παράγεται από τον εκδότη του είδους (επαγγελματίας ⇒ `engineer`).
    provider: checklistProviderOfKind('energy-certificate'),
    visibleTo: EVERYONE,
    requirement: { kind: 'mandatory' },
    // ADR-915 Φ1 — ο ΕΝΑΣ κανόνας του ΠΕΑ (120 μήνες), ίδιος με της αγγελίας· ποτέ ξανά 3650 ημέρες.
    // ADR-915 Φ2 — το `documentKind` κάνει τη γραμμή **απαίτηση** που βλέπει το «τι σταματά αν λήξει».
    documentKind: 'energy-certificate',
    validity: documentKindSpec('energy-certificate').rule,
    satisfaction: {
      kind: 'files',
      matchers: [
        // ADR-915 §33 — γενική θέση «Πιστοποιητικό» (ενεργειακό, ιδιοκτησίας, κτλ.): φιλοξενεί ΠΕΑ, δεν το υπόσχεται.
        { level: 'property', entryPointIds: ['unit-certificate'], promise: 'candidate' },
        { level: 'project', entryPointIds: ['study-energy-certificate'] },
      ],
    },
    verifiedAt: null,
  },
  {
    id: 'building_manager_certificate',
    section: 'property',
    labelKey: 'items.building_manager_certificate.label',
    provider: 'seller',
    visibleTo: EVERYONE,
    requirement: { kind: 'when', fact: 'existing_building_with_manager', equals: true },
    validity: { kind: 'unverified' },
    satisfaction: { kind: 'offline' },
    verifiedAt: null,
  },
  // ⛔ ΟΧΙ γραμμή `municipal_clearance` (βεβαίωση μη οφειλής ΤΑΠ): καταργήθηκε με το άρθρο 33 παρ. 1 Ν.5076/2023
  //    από 13.12.2023 — τυχόν οφειλή ΤΑΠ βεβαιώνεται στον δικαιοπάροχο, χωρίς βεβαίωση (ADR-915 §13). Αποθηκευμένη
  //    απόκλιση παλιών υποθέσεων πέφτει στο `getChecklistItem → undefined`. Το σημείο ανεβάσματος `municipal-tap`
  //    μένει για το αρχείο παλιών βεβαιώσεων.
  {
    id: 'special_zone_clearances',
    section: 'property',
    labelKey: 'items.special_zone_clearances.label',
    provider: 'authority',
    visibleTo: EVERYONE,
    requirement: { kind: 'when', fact: 'special_zone', equals: true },
    validity: { kind: 'unverified' },
    satisfaction: {
      kind: 'files',
      matchers: [{ level: 'project', entryPointIds: ['study-admin-authority-approval'] }],
    },
    verifiedAt: null,
  },
];
