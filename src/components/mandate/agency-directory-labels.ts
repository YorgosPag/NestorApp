/**
 * @fileoverview **ΚΩΔΙΚΟΣ → ΚΛΕΙΔΙ ΚΕΙΜΕΝΟΥ** για τον δημόσιο κατάλογο και τη σελίδα προφίλ.
 * @related ADR-827 §9.6 · §9.8 · §9.9 · N.11 · CHECK 3.8
 * @module components/mandate/agency-directory-labels
 *
 * ⚠️ **Ίδιο ιδίωμα με το `agency-showcase-labels.ts`, ξεχωριστό αρχείο — και δεν είναι
 * δίδυμο**: εκείνο ονομάζει τα κλειδιά της οθόνης **του γραφείου** *(«θέλω να με
 * βρίσκουν»)*, αυτό τα κλειδιά των **δημόσιων** οθονών *(«ποιος υπάρχει και πώς του
 * μιλάω»)*. Δύο ακροατήρια, δύο υποδέντρα i18n, μηδέν κοινό κλειδί — μια κοινή
 * σταθερά θα ένωνε τα route slices τους και θα κουβαλούσε το ένα κείμενο στην οθόνη
 * του άλλου *(και τα δύο έχουν μετρημένο budget στο `.i18n-shell-slice.json`)*.
 *
 * ⛔ **ΚΑΝΕΝΑ δυναμικό κλειδί.** Ο τεμαχιστής επιλύει **μόνο** `t(TABLE[x])` με πίνακα
 * σταθερό στο ίδιο module, ή literal — μετρημένο στη (δ): `t(failureKey(f))` και
 * `{...A, ...B}` βγήκαν *«unresolved dynamic t()»*.
 */

/** Το namespace — **`property-market`**, το ίδιο με τη βιτρίνα και τις αγγελίες. */
export const AGENCY_PUBLIC_NS = 'property-market';

const D = 'property-market:mandate.directory';
const P = 'property-market:mandate.profile';

/** Ο κατάλογος — `/pro`. */
export const DIRECTORY_KEYS = {
  title: `${D}.title`,
  lead: `${D}.lead`,
  loading: `${D}.loading`,
  empty: `${D}.empty`,
  emptyHint: `${D}.emptyHint`,
  failed: `${D}.failed`,
  count: `${D}.count`,
  gemi: `${D}.gemi`,
  open: `${D}.open`,
} as const;

/** Η μία βιτρίνα — `/pro/<ψευδώνυμο>`. */
export const PROFILE_KEYS = {
  loading: `${P}.loading`,
  absentTitle: `${P}.absentTitle`,
  absentLead: `${P}.absentLead`,
  absentAction: `${P}.absentAction`,
  failedTitle: `${P}.failedTitle`,
  failedLead: `${P}.failedLead`,
  gemiLabel: `${P}.gemiLabel`,
  gemiHint: `${P}.gemiHint`,
  placeLabel: `${P}.placeLabel`,
  placeUnknown: `${P}.placeUnknown`,
  publishedAt: `${P}.publishedAt`,
  requestCta: `${P}.requestCta`,
  requestHint: `${P}.requestHint`,
  noChannel: `${P}.noChannel`,
  backToDirectory: `${P}.backToDirectory`,
  // ── ADR-841 §7 (Α6) — ΤΙ ΠΟΥΛΑ, ΟΧΙ ΜΟΝΟ ΠΟΙΟΣ ΕΙΝΑΙ ──────────────────────
  //
  // ⚠️ **Το `listingsFailed` ΔΕΝ συγχωνεύεται με το `listingsEmpty`** (N.12): «δεν
  //    μπόρεσα να ρωτήσω» και «δεν έχει αγγελίες» είναι **διαφορετικές αλήθειες** για
  //    τον επισκέπτη — η μία λέει «ξαναδοκίμασε», η άλλη «ρώτα τον απευθείας». Ίδια
  //    διάκριση με τα `absentTitle` ⇄ `failedTitle` δύο γραμμές πιο πάνω.
  listingsTitle: `${P}.listingsTitle`,
  listingsCount: `${P}.listingsCount`,
  listingsLoading: `${P}.listingsLoading`,
  listingsEmpty: `${P}.listingsEmpty`,
  listingsEmptyHint: `${P}.listingsEmptyHint`,
  listingsFailed: `${P}.listingsFailed`,
} as const;
