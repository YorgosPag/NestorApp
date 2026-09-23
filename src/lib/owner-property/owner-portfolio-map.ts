/**
 * @fileoverview **Ο χάρτης χαρτοφυλακίου του κατόχου**: καθαρή λογική, χωρίς React, χωρίς χάρτη.
 * @related ADR-777 §8.71 · lib/listings/listing-map-mark · lib/listings/listings-geojson ·
 *          lib/owner-property/owner-property-projection (`ownerListingVisibility`)
 * @module lib/owner-property/owner-portfolio-map
 *
 * 🔑 **Ο χάρτης δείχνει ό,τι βλέπει ο κόσμος: το ΣΗΜΑΔΙ, ποτέ τη ΘΕΣΗ.** Η πηγή είναι το
 * `publication.mapMark`, γραμμένο από τον γραφέα της δημοσίευσης (§8.70.7), και **ποτέ** το
 * ιδιωτικό `place` του κατόχου. Αυτό το module **δεν διαβάζει** το `place`: για μια «Θεσσαλονίκη»
 * ο χάρτης ζωγραφίζει σκιασμένη πόλη, γιατί **δεν υπάρχει** πεδίο από το οποίο να βγει πινέζα.
 *
 * 🔑 **Ένας ζωγράφος.** Κάθε feature βγαίνει από το `listingFeature`, το ίδιο που τρέφει τον
 * δημόσιο χάρτη και τη μικρογραφία της κάρτας. Τρεις επιφάνειες, ένα σχήμα.
 *
 * 🔴 **Το σημάδι ΜΟΝΟ ΤΟΥ ΔΕΝ αρκεί.** Ένα `'published'` αποτύπωμα μπορεί να έχει παλιώσει: ο
 * κάτοχος απέσυρε τη διάθεση ή έληξε η εντολή, και η προβολή σβήστηκε νόμιμα από άλλη διαδρομή.
 * Το σημάδι μένει γραμμένο ώσπου να ξαναγραφτεί. Ο **ένας** κριτής (`ownerListingVisibility`)
 * κρίνει λοιπόν πρώτος: ό,τι δεν είναι δημοσιευμένο **τώρα** δεν μπαίνει στον χάρτη, όποιο
 * σημάδι κι αν κουβαλά.
 */

import { parseListingMapMark, type ListingMapMark } from '@/lib/listings/listing-map-mark';
import { listingFeature, type ListingFeature, type ListingGeoJson } from '@/lib/listings/listings-geojson';
import {
  ownerListingVisibility,
  placeKnowledgeFromOwnerProperty,
} from '@/lib/owner-property/owner-property-projection';
import type { OwnerProperty } from '@/types/owner-property';

/**
 * **Πόσα ακίνητα με σημάδι χρειάζονται για να υπάρχει προβολή χάρτη.**
 *
 * Ένα σημάδι σε χάρτη δεν δείχνει τίποτα που η κάρτα δεν δείχνει ήδη (§8.70.7). Ο χάρτης
 * χαρτοφυλακίου αρχίζει να απαντά σε ερώτηση μόνο από **δύο** και πάνω: «πού είναι τα
 * ακίνητά μου **σε σχέση** μεταξύ τους;».
 */
export const OWNER_PORTFOLIO_MAP_MIN_MARKED = 2;

/** Γιατί ένα ακίνητο **δεν** είναι στον χάρτη. Ο κάτοχος βλέπει την αιτία και τη θεραπεία. */
export type OwnerPortfolioUnmappedReason = 'withdrawn' | 'failed' | 'no-mark' | 'unrecorded';

export interface MappedOwnerProperty {
  readonly property: OwnerProperty;
  readonly mark: ListingMapMark;
}

export interface UnmappedOwnerProperty {
  readonly property: OwnerProperty;
  readonly reason: OwnerPortfolioUnmappedReason;
}

export interface OwnerPortfolioPartition {
  readonly mapped: readonly MappedOwnerProperty[];
  readonly unmapped: readonly UnmappedOwnerProperty[];
}

/**
 * **Πού βρίσκεται ΕΝΑ ακίνητο σε σχέση με τον δημόσιο χάρτη** — πέντε σκέλη, όχι δύο.
 *
 * 🔑 **Ο ΕΝΑΣ κριτής για δύο επιφάνειες** (ADR-777 §8.73): ο χάρτης χαρτοφυλακίου τον ρωτά για να
 * διαμερίσει, η κάρτα για να πει μία πρόταση. Πριν, η κάρτα ρωτούσε μόνο το `ownerListingVisibility`
 * και έλεγε «είναι στον δημόσιο χάρτη» για αγγελία **χωρίς πινέζα** — ενώ ο χάρτης ακριβώς δίπλα
 * την έβαζε στη γραμμή «δεν φαίνονται». Δύο απαντήσεις στην ίδια ερώτηση, από δύο κριτές.
 *
 * `no-mark` = **δημόσια** (στη λίστα αποτελεσμάτων, στη γραμμή «N ακόμη»), **χωρίς** σημάδι.
 * `unrecorded` = **δημόσια**, αλλά το αποτύπωμα γράφτηκε **πριν** υπάρξει το `mapMark` (§8.70.7):
 * **δεν ξέρουμε** αν έχει σημάδι. 🔴 Μετρημένο 2026-09-23: 5/5 δημοσιευμένα ήταν έτσι, και ένα
 * (δηλωμένη θέση) **έχει** πινέζα στον δημόσιο χάρτη — το «χωρίς σημάδι» θα ήταν ψέμα.
 *
 * 🔑 **Ό,τι είναι ΒΕΒΑΙΟ δεν λέγεται «άγνωστο».** Χωρίς αποτύπωμα, ρωτάμε την **ίδια** γνώση
 * θέσης που τρέφει τον γραφέα (`placeKnowledgeFromOwnerProperty` → `resolveListingPosition`):
 * καμία υποψήφια **και** κανένας δεσμός ⇒ η θέση βγαίνει `unknown` ⇒ **βέβαιο** `no-mark`
 * (π.χ. `place.kind === 'declined'`, 4/5 μετρημένα). Διαβάζεται μόνο **αν υπάρχει** θέση, ποτέ
 * σημείο — το σύνορο «σημάδι, ποτέ θέση» μένει ακέραιο.
 */
export type OwnerMapPresence =
  | { readonly kind: 'marked'; readonly mark: ListingMapMark }
  | { readonly kind: OwnerPortfolioUnmappedReason };

export function ownerMapPresence(property: OwnerProperty, at: string): OwnerMapPresence {
  const visibility = ownerListingVisibility(property, at);
  if (visibility !== 'published') return { kind: visibility };
  const raw = property.publication?.mapMark;
  if (raw === undefined) return hasNoPositionSource(property, at) ? { kind: 'no-mark' } : { kind: 'unrecorded' };
  const mark = parseListingMapMark(raw);
  return mark === null ? { kind: 'no-mark' } : { kind: 'marked', mark };
}

/** Καμία υποψήφια θέση και κανένας δεσμός ⇒ ο γραφέας **δεν μπορεί** να βγάλει σημάδι. */
function hasNoPositionSource(property: OwnerProperty, at: string): boolean {
  const knowledge = placeKnowledgeFromOwnerProperty(property, at);
  return knowledge.candidates.length === 0 && knowledge.ref === null;
}

/** Είναι η αγγελία **δημόσια** (στην αγορά), με ή χωρίς σημάδι — ή με άγνωστο σημάδι; */
export function isOwnerListingPublic(presence: OwnerMapPresence): boolean {
  return presence.kind !== 'withdrawn' && presence.kind !== 'failed';
}

/**
 * Χωρίζει το χαρτοφυλάκιο σε όσα **ζωγραφίζονται** και όσα **λέγονται**. Η σειρά διατηρείται.
 *
 * @param at Η στιγμή της κρίσης: **μία** ανάγνωση ρολογιού για όλη τη λίστα, όπως στην κάρτα.
 */
export function partitionOwnerPortfolio(
  properties: readonly OwnerProperty[],
  at: string,
): OwnerPortfolioPartition {
  const mapped: MappedOwnerProperty[] = [];
  const unmapped: UnmappedOwnerProperty[] = [];

  for (const property of properties) {
    const presence = ownerMapPresence(property, at);
    if (presence.kind === 'marked') mapped.push({ property, mark: presence.mark });
    else unmapped.push({ property, reason: presence.kind });
  }

  return { mapped, unmapped };
}

/** Τα ζωγραφισμένα → GeoJSON, από τον **έναν** ζωγράφο. */
export function ownerPortfolioGeoJson(mapped: readonly MappedOwnerProperty[]): ListingGeoJson {
  const features: ListingFeature[] = mapped.map(({ property, mark }) =>
    listingFeature(property.id, property.title, mark),
  );
  return { type: 'FeatureCollection', features };
}

/** Έχει νόημα η προβολή χάρτη; Η **μία** ερώτηση, για τον διακόπτη και για την απόδοση. */
export function hasOwnerPortfolioMap(partition: OwnerPortfolioPartition): boolean {
  return partition.mapped.length >= OWNER_PORTFOLIO_MAP_MIN_MARKED;
}

// ─── Η προβολή στο URL (`?view=map`) ────────────────────────────────────────────

/** Οι προβολές της σελίδας. Η `list` είναι η προεπιλογή και **δεν** γράφεται στο URL. */
export const OWNER_PORTFOLIO_VIEWS = ['list', 'map'] as const;
export type OwnerPortfolioView = (typeof OWNER_PORTFOLIO_VIEWS)[number];

/** Το κλειδί του query string: το ίδιο όνομα που χρησιμοποιούν τα portals (`view=map`). */
export const OWNER_PORTFOLIO_VIEW_PARAM = 'view';

export function isOwnerPortfolioView(value: unknown): value is OwnerPortfolioView {
  return typeof value === 'string' && (OWNER_PORTFOLIO_VIEWS as readonly string[]).includes(value);
}

/** Ανάγνωση. Άγνωστη ή απούσα τιμή ⇒ `list`, ποτέ σφάλμα (ο σύνδεσμος μπορεί να είναι παλιός). */
export function parseOwnerPortfolioView(params: URLSearchParams): OwnerPortfolioView {
  const raw = params.get(OWNER_PORTFOLIO_VIEW_PARAM);
  return isOwnerPortfolioView(raw) ? raw : 'list';
}

/** Γραφή. Η προεπιλογή **σβήνει** το κλειδί: ένα URL, μία μορφή για την ίδια οθόνη. */
export function writeOwnerPortfolioView(view: OwnerPortfolioView, params: URLSearchParams): void {
  if (view === 'list') params.delete(OWNER_PORTFOLIO_VIEW_PARAM);
  else params.set(OWNER_PORTFOLIO_VIEW_PARAM, view);
}
