/**
 * Τα **φυσικά κλειδιά** των οντοτήτων τιμολόγησης (ADR-923 §5.11 «3β», Β4) — από αυτά βγαίνουν τα
 * ντετερμινιστικά id (`enterprise-id-catalog-generators`). Ένα σημείο, ώστε γραφέας, αντιγραφή έκδοσης
 * και επιλυτής να ζητούν **το ίδιο** έγγραφο με τα ίδια συστατικά.
 *
 * 🔑 Η μοναδικότητα είναι **δομική**: δεύτερη «έκδοση 3» της ίδιας λίστας, δεύτερη γραμμή για το ίδιο
 * υποκείμενο, δεύτερη ομάδα για τον ίδιο συμβαλλόμενο ⇒ **ίδιο** id ⇒ σύγκρουση στη συναλλαγή.
 * 🔑 Οι **υποδοχές ασάφειας** μαζεύουν όσα δεν επιτρέπεται να επικαλύπτονται. Το ερώτημα του Firestore
 * μέσα σε συναλλαγή **δεν** κλειδώνει έγγραφα που δεν υπάρχουν ακόμα («φαντάσματα»)· το έγγραφο της
 * υποδοχής ναι, άρα δύο ταυτόχρονες ασαφείς εγγραφές συγκρούονται.
 *
 * @module subapps/catalog/pricing/pricing-keys
 */

import type { DiscountConditionDefinition, PriceAudience } from '../types/price-list';
import { audienceIdentity } from './price-audience';

export function priceListVersionKey(priceListId: string, versionNumber: number): string {
  return `${priceListId}:${versionNumber}`;
}

export function priceListLineKey(versionId: string, subjectKey: string): string {
  return `${versionId}:${subjectKey}`;
}

// Η ανάθεση ομάδας πελάτη έχει κλειδί τον ίδιο τον συμβαλλόμενο: `pricingPartyKey` (price-audience), κανένα ψευδώνυμο.

/** Οι συνθήκες του ίδιου «ομάδα έκπτωσης (ή `*`) × κοινό» δεν επικαλύπτονται χρονικά. */
export function conditionSlotKey(condition: Pick<DiscountConditionDefinition, 'discountGroupId' | 'audience'>): string {
  return `condition:${condition.discountGroupId ?? '*'}:${audienceIdentity(condition.audience)}`;
}

/** Δύο τιμοκατάλογοι πώλησης δεν προσφέρονται στο ίδιο κοινό (ποιος θα ίσχυε;). */
export function priceListAudienceSlotKey(audience: PriceAudience): string {
  return `priceListAudience:${audienceIdentity(audience)}`;
}
