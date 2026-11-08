/**
 * =============================================================================
 * ΟΙ ΡΟΛΟΙ ΤΩΝ ΜΕΣΩΝ ΤΟΥ ΚΑΤΑΛΟΓΟΥ (ADR-923 §5.10 Δ9) — ΡΙΖΑ, CHECK 3.73
 * =============================================================================
 *
 * Ο ρόλος λέει **τι είναι** ένα μέσο (φωτογραφία προϊόντος · τεχνικό σχέδιο · φύλλο
 * δεδομένων · πιστοποιητικό · EPD · μοντέλο BIM …) — **όχι πού χρησιμοποιείται**.
 *
 * 🔑 **Γιατί ΟΧΙ «κύρια» / «γκαλερί»** (το αρχικό σχέδιο τα είχε ως ρόλους): είναι **χρήση**,
 * και τη χρήση την εκφράζει ήδη **η ιδιότητα** που δείχνει στο μέσο (η `imageAttributeId` της
 * οικογένειας = κύρια εικόνα, μια ιδιότητα `asset` «Γκαλερί» = γκαλερί). Η ίδια φωτογραφία
 * μπορεί να είναι κύρια στο ένα προϊόν και δευτερεύουσα στο άλλο· ρόλος «κύρια» πάνω στο
 * μέσο θα ήταν **δεύτερη αλήθεια** που διαψεύδεται από το πρώτο κιόλας προϊόν. Ίδια διάκριση
 * με το Akeneo Asset Manager (asset family = τι είναι · asset collection attribute = πού).
 *
 * Το **είδος αρχείου** (`AssetKind`: εικόνα · έγγραφο · BIM · βίντεο) είναι **άλλος** άξονας —
 * τι bytes είναι — και ο πίνακας {@link ASSET_ROLE_KINDS} λέει ποια είδη ταιριάζουν σε κάθε ρόλο.
 *
 * @module subapps/catalog/vocabulary/asset-roles
 */

import type { AssetKind } from './attribute-types';

export const CATALOG_ASSET_ROLES = [
  'photo',
  'drawing',
  'datasheet',
  'manual',
  'certificate',
  'epd',
  'bim',
  'video',
  'logo',
  'font',
  // ADR-934 §5.2 Μ11 — κανονιστικά έγγραφα, χωριστά από το `certificate` επειδή ο καθένας έχει δικό του νόμο:
  'declaration', // DoP/DoC — Κανονισμός (ΕΕ) 2024/3110 (CPR), υπόδειγμα Παραρτήματος V · ETIM ATX004
  'energyLabel', // ενεργειακή σήμανση — Κανονισμός (ΕΕ) 2017/1369: στην πώληση από απόσταση δίπλα στην τιμή · ETIM ATX012
  'safetyDataSheet', // SDS — REACH άρθρο 31: στη γλώσσα του κράτους μέλους, με ημερομηνία αναθεώρησης · ETIM ATX019
] as const;

export type CatalogAssetRole = (typeof CATALOG_ASSET_ROLES)[number];

export function isCatalogAssetRole(value: unknown): value is CatalogAssetRole {
  return (CATALOG_ASSET_ROLES as readonly unknown[]).includes(value);
}

/**
 * Ποια είδη αρχείου δέχεται κάθε ρόλος. Δεμένο στη ρίζα (`Record<CatalogAssetRole,…>`): νέος
 * ρόλος χωρίς γραμμή εδώ σπάει τη μεταγλώττιση αντί να δεχτεί οποιοδήποτε αρχείο.
 * Το σχέδιο δέχεται και εικόνα (σαρωμένο/εξαγόμενο PNG) και έγγραφο (PDF/DWG-ως-PDF).
 */
export const ASSET_ROLE_KINDS: Readonly<Record<CatalogAssetRole, readonly AssetKind[]>> = {
  photo: ['image'],
  drawing: ['image', 'document'],
  datasheet: ['document'],
  manual: ['document'],
  certificate: ['document'],
  epd: ['document'],
  bim: ['bim'],
  video: ['video'],
  logo: ['image'],
  font: ['font'],
  declaration: ['document'],
  // Η σήμανση κυκλοφορεί ως εικόνα (το σχήμα με την κλίμακα) ΚΑΙ ως PDF (σήμανση + δελτίο προϊόντος).
  energyLabel: ['image', 'document'],
  safetyDataSheet: ['document'],
};

export function isKindAllowedForRole(role: CatalogAssetRole, kind: AssetKind): boolean {
  return ASSET_ROLE_KINDS[role].includes(kind);
}
