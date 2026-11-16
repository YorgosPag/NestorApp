/**
 * @fileoverview ADR-915 §45.15 — **οι λέξεις του υπευθύνου αυτοψίας** στο πάνελ του γραφείου: γραμμή · διάλογος ·
 *   φόρμα. Οι ιδιότητες ζουν στο `INSPECTION_ROLE_LABEL_KEYS` (`document-registry-labels.ts`) — ο ΙΔΙΟΣ κατάλογος με
 *   τον χώρο του μηχανικού και το ιστορικό.
 * @related RegistryIssuanceInspection.tsx · RegistryIssuanceInspectionForm.tsx
 * @module components/document-registry/issuance-inspection-labels
 *
 * ⚠️ Κυριολεκτικά κλειδιά (template σε σταθερά module): ο γεννήτορας του route slice τα **λύνει** στατικά.
 */

const K = 'document-registry:issuance.inspection.';

export const INSPECTION_KEYS = {
  line: `${K}line`,
  none: `${K}none`,
  setTrigger: `${K}setTrigger`,
  changeTrigger: `${K}changeTrigger`,
  title: `${K}title`,
  description: `${K}description`,
  whoLegend: `${K}whoLegend`,
  whoLead: `${K}whoLead`,
  whoOther: `${K}whoOther`,
  searchPlaceholder: `${K}searchPlaceholder`,
  roleLegend: `${K}roleLegend`,
  roleOtherLabel: `${K}roleOtherLabel`,
  noPhone: `${K}noPhone`,
  submit: `${K}submit`,
} as const;
