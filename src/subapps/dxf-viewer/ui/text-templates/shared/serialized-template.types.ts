/**
 * ADR-344 Phase 7.D — Wire shape for user text templates.
 *
 * ⚠️ ADR-651 Φάση Θ: ο **κανονικός** ορισμός μετακόμισε στο
 * `text-engine/templates/text-template-api.ts` (τον χρειάζονται και ο manager και η
 * βιβλιοθήκη πινακίδας — ένας τύπος, μία πηγή· N.18). Εδώ μένει μόνο ένα re-export ώστε
 * να μη σπάσουν οι υπάρχοντες importers.
 */
export type { SerializedUserTextTemplate } from '@/subapps/dxf-viewer/text-engine/templates/text-template-api';
