/**
 * @fileoverview **Από το «δες αν κάποιος ενδιαφέρεται» στην καταχώριση — χωρίς να ξαναγραφτεί τίποτα.**
 * @related ADR-900 · lib/demand/prospect-interest.ts (το ΕΝΑ συμβόλαιο URL) · OwnerPropertyCreationGate
 * @module lib/owner-property/owner-property-prospect-prefill
 *
 * 🔑 **Ο ίδιος parser, οι ίδιες παράμετροι.** Η σελίδα ελέγχου ενδιαφέροντος στέλνει τον άνθρωπο στο
 * `/offers/new` με **το ίδιο** ερώτημα που ρώτησε ({@link prospectQueryParams}), και η φόρμα το διαβάζει
 * με **τον ίδιο** {@link parseProspectQuery}. Δύο σύνολα ονομάτων παραμέτρων θα απέκλιναν σιωπηλά.
 *
 * ⚠️ **Η διεύθυνση ΔΕΝ προσυμπληρώνεται, επίτηδες.** Η φόρμα του κατόχου κρατά **σημείο + ακρίβεια**
 * από τον γεωκωδικοποιητή (Α5 — το σχήμα στον χάρτη *είναι* η ακρίβεια). Ένα σημείο κληρονομημένο από
 * τη γη θα ήταν ακρίβεια που **δεν μετρήθηκε**. Ο άνθρωπος γράφει τη διεύθυνσή του· το **κτίριο** που
 * έδειξε έρχεται έτοιμο, και αυτό είναι που κάνει την προσφορά να συναντά τη ζήτηση (§14.5).
 *
 * **Layering**: leaf — καθαρή συνάρτηση.
 */

import { parseProspectQuery, prospectQueryParams, type ProspectQuery } from '@/lib/demand/prospect-interest';
import { NEW_OFFER_ROUTE } from '@/lib/owner-property/owner-property-routes';
import { typedHref } from '@/lib/workspace/route-worlds';

import { EMPTY_OWNER_PROPERTY_FORM, type OwnerPropertyFormValues } from './owner-property-form-values';
import { floorRefKey } from '@/lib/floor/floor-ref';

/** **Ερώτημα ελέγχου → σύνδεσμος καταχώρισης**, με το ερώτημα αυτούσιο. */
export function newOfferFromProspectHref(query: ProspectQuery) {
  return typedHref(`${NEW_OFFER_ROUTE}?${prospectQueryParams(query).toString()}`);
}

/**
 * **Παράμετροι URL → αρχικές τιμές της φόρμας**, ή `null` αν το URL δεν κουβαλά έγκυρο ερώτημα
 * (τότε η φόρμα ανοίγει κενή, όπως πάντα — ένα χαλασμένο URL δεν μπλοκάρει την καταχώριση).
 */
export function ownerFormFromProspect(params: URLSearchParams): OwnerPropertyFormValues | null {
  const parsed = parseProspectQuery(params);
  if (parsed.kind === 'invalid') return null;

  const { ref, description } = parsed.query;
  return {
    ...EMPTY_OWNER_PROPERTY_FORM,
    type: description.type,
    areaSqm: description.areaSqm,
    // ADR-903 §9 — η στάθμη ταξιδεύει ΜΕ το είδος της (η πυλωτή μένει πυλωτή, όχι «ισόγειο»).
    floorLevel: description.floor === null ? '' : floorRefKey(description.floor),
    placeRef: { landId: ref.landId, buildingId: ref.buildingId },
  };
}
