/**
 * =============================================================================
 * `/pro` — Ο ΚΑΤΑΛΟΓΟΣ ΑΝΟΙΧΤΟΣ «ΓΙΑ» ΕΝΑ ΑΚΙΝΗΤΟ ΚΑΙ ΕΝΑ ΕΓΓΡΑΦΟ (ADR-945 §7.6 · Δ4)
 * =============================================================================
 *
 * **«Ψάχνω επαγγελματία για ΑΥΤΟ το ακίνητο και ΑΥΤΟ το έγγραφο.»** Ο ιδιώτης ξεκινά από το ακίνητό του («Βρες
 * επαγγελματία»), ο κατάλογος ανοίγει **με πλαίσιο**, και κάθε κάρτα που μπορεί να εκδώσει το έγγραφο προσφέρει
 * «Ζήτησε προσφορά» (Thumbtack: το αίτημα ξεκινά από το έργο, όχι από τον κατάλογο).
 *
 * 🔑 **Υπόδειξη, ποτέ απόφαση**: το πλαίσιο είναι διεύθυνση που ο καθένας μπορεί να γράψει. Ο διακομιστής **ξανακρίνει**
 *    κατοχή στην πράξη (ξένο ακίνητο ≡ 404) — εδώ μόνο διαβάζεται και ελέγχεται το **σχήμα**.
 * 🔑 **Δίπλα στα `ShowcaseFilters`, όχι μέσα τους**: τα φίλτρα είναι **κλειστό σχήμα δύο αξόνων** (Φ1 — δήλωση του
 *    επαγγελματία)· το πλαίσιο δεν κόβει κανέναν, άρα δεν είναι άξονας. Ζει στην **ίδια** διεύθυνση και επιβιώνει κάθε
 *    αλλαγής φίλτρου (`withIssuanceContext`).
 * 🔑 **Μία γραφή, μία ανάγνωση**: τα ονόματα των παραμέτρων υπάρχουν **μόνο** εδώ (άγκυρα κύκλου στο test).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 *
 * @module lib/agency/issuance-context-query
 */

import { DOCUMENT_KINDS, type DocumentKind } from '@/config/document-validity/document-validity';

/** Για ποιο ακίνητο και ποιο έγγραφο ανοίχτηκε ο κατάλογος. */
export interface IssuanceContext {
  readonly propertyId: string;
  readonly documentKind: DocumentKind;
}

const PROPERTY_PARAM = 'forProperty';
const DOCUMENT_PARAM = 'forDocument';

/** Αμυντικά, όχι πολιτική: μια ταυτότητα δεν έχει κενά και δεν είναι μυθιστόρημα. */
const PROPERTY_ID_MAX = 128;

function readPropertyId(raw: string | null): string | null {
  const value = raw?.trim() ?? '';
  return value === '' || value.length > PROPERTY_ID_MAX || /\s/.test(value) ? null : value;
}

function readDocumentKind(raw: string | null): DocumentKind | null {
  return DOCUMENT_KINDS.find((kind) => kind === raw) ?? null;
}

/** Το πλαίσιο της διεύθυνσης — **και τα δύο ή κανένα**: μισό πλαίσιο δεν είναι μερικώς χρήσιμο. */
export function parseIssuanceContext(params: URLSearchParams): IssuanceContext | null {
  const propertyId = readPropertyId(params.get(PROPERTY_PARAM));
  const documentKind = readDocumentKind(params.get(DOCUMENT_PARAM));
  return propertyId === null || documentKind === null ? null : { propertyId, documentKind };
}

/**
 * Οι παράμετροι **μαζί με** το πλαίσιο — νέο αντικείμενο, το όρισμα μένει ανέγγιχτο. `null` ⇒ αφαιρείται: δύο
 * διευθύνσεις για την ίδια σελίδα (με και χωρίς κενό πλαίσιο) δεν γράφονται ποτέ.
 */
export function withIssuanceContext(params: URLSearchParams, context: IssuanceContext | null): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete(PROPERTY_PARAM);
  next.delete(DOCUMENT_PARAM);
  if (context !== null) {
    next.set(PROPERTY_PARAM, context.propertyId);
    next.set(DOCUMENT_PARAM, context.documentKind);
  }
  return next;
}
