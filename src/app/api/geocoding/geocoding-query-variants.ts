/**
 * @fileoverview **ΠΩΣ ΓΡΑΦΕΤΑΙ ΤΟ ΕΡΩΤΗΜΑ ΚΑΘΕ ΠΑΡΑΛΛΑΓΗΣ** — καθαρές συναρτήσεις, μηδέν δίκτυο.
 * @related ADR-332 D13/D14 · ADR-777 §7 (Α14) · geocoding-engine
 * @module app/api/geocoding/geocoding-query-variants
 *
 * 🔑 **Εξήχθη από τη μηχανή (2026-09-02), που ήταν 497 γραμμές — ΤΡΕΙΣ από το όριο των
 * 500** (N.7.1). Η τομή δεν είναι αυθαίρετη: εδώ ζει **τι ρωτάμε**, εκεί **πόσες φορές
 * και με ποια σειρά**. Καμία από αυτές τις συναρτήσεις δεν αγγίζει δίκτυο ή καταγραφή,
 * και όλες είναι ντετερμινιστικές — γι' αυτό ελέγχονται χωρίς άρμα.
 *
 * ⚠️ **Ο `composeStreet` είναι ΚΟΙΝΟΣ και γι' αυτό μετακόμισε μαζί τους**: τον
 * χρησιμοποιεί και ο δομημένος κατασκευαστής URL της μηχανής. Δύο αντίγραφα της
 * σειράς «αριθμός πρώτα ⇄ αριθμός τελευταίος» είναι ακριβώς το σχήμα που αποκλίνει.
 */

import { normalizeGreekText } from '@/services/ai-pipeline/shared/greek-text-utils';
import { transliterateGreeklish, containsGreek } from '@/services/ai-pipeline/shared/greek-nlp';
import type { GeocodingRequestBody } from '@/lib/geocoding/geocoding-types';

/**
 * Join street name and house number. Nominatim's structured `street` slot wants
 * "<number> <name>", while free-form text follows the local written convention —
 * in Greek, "<name> <number>" («Τσιμισκή 43»). One composer so the two orders
 * cannot drift apart.
 *
 * Kept out of the caller's `street` field, which must stay the bare street name.
 */
export function composeStreet(
  params: GeocodingRequestBody,
  order: 'number-first' | 'number-last',
): string | undefined {
  if (!params.street) return undefined;
  if (!params.number) return params.street;
  return order === 'number-first'
    ? `${params.number} ${params.street}`
    : `${params.street} ${params.number}`;
}

// =============================================================================
// SEARCH VARIANTS (query builders)
// =============================================================================

/**
 * Tight first-pass query: street + number, locality, postal code — comma
 * separated. Measured (2026-07-26): space-joining these, as this builder used to
 * do, returns an empty set where the comma-separated form matches.
 */
export function toOsmStyleQuery(params: GeocodingRequestBody): string {
  const locality = (params.neighborhood || params.city)?.replace(/-/g, ' ');
  return [composeStreet(params, 'number-last'), locality, params.postalCode]
    .filter(Boolean).join(', ');
}

/** Widest query: the full administrative chain, for when the tight one misses. */
export function toFreeformQuery(params: GeocodingRequestBody): string {
  const locality = params.neighborhood || params.city;
  return [
    composeStreet(params, 'number-last'), locality, params.municipality,
    params.county, params.postalCode, params.region,
  ].filter(Boolean).join(', ');
}

export function createAccentStrippedVariant(params: GeocodingRequestBody): GeocodingRequestBody {
  const n = (v: string | undefined) => v ? normalizeGreekText(v) : undefined;
  return {
    street: n(params.street), number: params.number,
    city: n(params.city), neighborhood: n(params.neighborhood),
    postalCode: params.postalCode, county: n(params.county),
    municipality: n(params.municipality), region: n(params.region), country: params.country,
  };
}

export function createGreeklishVariant(params: GeocodingRequestBody): GeocodingRequestBody | null {
  const hasNonGreek =
    (params.street && !containsGreek(params.street)) ||
    (params.city && !containsGreek(params.city)) ||
    (params.neighborhood && !containsGreek(params.neighborhood));
  if (!hasNonGreek) return null;
  const tr = (v: string | undefined) => v && !containsGreek(v) ? transliterateGreeklish(v) : v;
  return {
    street: tr(params.street), number: params.number,
    city: tr(params.city), neighborhood: tr(params.neighborhood),
    postalCode: params.postalCode, county: params.county, municipality: params.municipality,
    region: tr(params.region), country: params.country,
  };
}


