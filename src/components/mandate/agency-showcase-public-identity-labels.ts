/**
 * @fileoverview **ΚΩΔΙΚΟΣ → ΚΛΕΙΔΙ ΚΕΙΜΕΝΟΥ** για την ενότητα «Τι θα δει ο κόσμος» της βιτρίνας (ADR-841 §7 Α23.14).
 * @related components/mandate/agency-showcase-labels.ts (το πρότυπο) · N.11 · CHECK 3.8 · CHECK 3.34
 * @module components/mandate/agency-showcase-public-identity-labels
 *
 * 🔴 **ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ**: το `agency-showcase-labels.ts` έχει ήδη ξεπεράσει τις 500 γραμμές (N.7.1).
 *
 * 🔑 `Record<SeatDisclosure, …>` πάνω στο **κλειστό** σύνολο `SEAT_DISCLOSURES`: τέταρτη επιλογή έδρας **δεν
 * μεταγλωττίζεται** χωρίς τίτλο και εξήγηση. Κυριολεκτικά πρότυπα, μία ευρετηρίαση — ποτέ δυναμικό κλειδί.
 */

import type { SeatDisclosure } from '@/types/showcase-legal-identity';

const K = 'property-market:mandate.showcase.publicIdentity';

export const SHOWCASE_PUBLIC_IDENTITY_KEYS = {
  title: `${K}.title`,
  lead: `${K}.lead`,
  loading: `${K}.loading`,
  /** 🔴 `forbidden` ≠ «δεν υπάρχει έδρα»: η απάντηση φέρει την πλήρη έδρα, άρα τη βλέπει μόνο ο διαχειριστής. */
  forbidden: `${K}.forbidden`,
  unavailable: `${K}.unavailable`,
  nameLegend: `${K}.nameLegend`,
  nameLegal: `${K}.nameLegal`,
  nameTitle: `${K}.nameTitle`,
  noTitles: `${K}.noTitles`,
  registryLink: `${K}.registryLink`,
  seatLegend: `${K}.seatLegend`,
  /** ⚖️ GDPR άρθ. 25(2) — γιατί δεν υπάρχει προεπιλογή για ατομική και ΟΕ (Δ7). */
  seatRequired: `${K}.seatRequired`,
  recommended: `${K}.recommended`,
  willShow: `${K}.willShow`,
  fixProfile: `${K}.fixProfile`,
  fixCard: `${K}.fixCard`,
  previewTitle: `${K}.previewTitle`,
  previewEmpty: `${K}.previewEmpty`,
  /** ⚖️ GDPR άρθ. 13/14 — η πλήρης έδρα φυλάσσεται και **δεν** δημοσιεύεται χωρίς επιλογή. */
  privacy: `${K}.privacy`,
} as const;

export const SEAT_DISCLOSURE_TITLE_KEYS: Record<SeatDisclosure, string> = {
  full: `${K}.seat.full.title`,
  'business-address': `${K}.seat.business-address.title`,
  municipality: `${K}.seat.municipality.title`,
};

export const SEAT_DISCLOSURE_HINT_KEYS: Record<SeatDisclosure, string> = {
  full: `${K}.seat.full.hint`,
  'business-address': `${K}.seat.business-address.hint`,
  municipality: `${K}.seat.municipality.hint`,
};
