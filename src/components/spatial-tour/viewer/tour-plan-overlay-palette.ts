/**
 * @fileoverview **ΤΑ ΧΡΩΜΑΤΑ ΠΑΝΩ ΣΤΗΝ ΚΑΤΟΨΗ** — χώροι, τελείες, κώνος, ετικέτες (ADR-884 Φ2στ-γ Γ3γ-1 · §4.14 σημείο 4).
 * @related `TourPlanMap.tsx` · `TourPlanSpaces.tsx` (οι καταναλωτές) · `TourLinkButton.tsx` / `TourFloorCursor.tsx` (ίδια αρχή
 *   πάνω στη **φωτογραφία**: λευκό/μαύρο με διαφάνεια)
 * @module components/spatial-tour/viewer/tour-plan-overlay-palette
 *
 * 🎨 **Πάνω σε ΕΙΚΟΝΑ, όχι πάνω στο θέμα**: η κάτοψη είναι λευκό χαρτί με μαύρες γραμμές και στα **δύο** θέματα — ένα
 *   `fill-card`/`stroke-foreground` θα άλλαζε με το θέμα ενώ το χαρτί από κάτω όχι. Άρα κυριολεκτικά χρώματα, **ένα** σημείο
 *   δήλωσης (αυτό το αρχείο), όπως ορίζει η Zillow: **κίτρινος** ο χώρος όπου είσαι, **κόκκινη** η τρέχουσα τελεία, **μπλε** οι
 *   άλλες. Το μπλε είναι το `chart-1` (ADR-710 θέση 1 — **ίδιο** και στα δύο θέματα, `globals.css`).
 * ♿ **Ποτέ μόνο χρώμα** (CHECK 3.41): η τρέχουσα τελεία είναι και **μεγαλύτερη**, έχει τον **κώνο** θέασης και `aria-current`.
 * 🔎 **Ετικέτες με άλω** (τεχνική χαρτογραφίας — Mapbox `text-halo`): σκούρο κείμενο με λευκό περίγραμμα **πίσω** από τα γράμματα
 *   (`paint-order: stroke`) διαβάζεται πάνω σε κάθε γραμμή, διαγράμμιση ή κίτρινο.
 */

import type { TourSpaceTone } from '@/lib/spatial-tour/viewer/tour-space-view';

/** Ο χώρος ανά ρόλο (Δ8.2 · Δ8.5): εδώ = έντονο κίτρινο · ενιαίος γείτονας = απαλό · χωρίς σημείο λήψης = γκρι · άλλος = τίποτα. */
export const SPACE_TONE_CLASS: Readonly<Record<TourSpaceTone, string>> = {
  here: 'fill-yellow-300/60 stroke-yellow-500',
  joined: 'fill-yellow-200/35 stroke-yellow-400/70',
  uncaptured: 'fill-neutral-500/15 stroke-neutral-500/40',
  idle: 'fill-transparent stroke-transparent',
};

export const PLAN_DOT_CLASS = {
  here: 'fill-red-600 stroke-white',
  other: 'fill-chart-1 stroke-white',
} as const;

export const PLAN_CONE_CLASS = 'fill-red-600/25 stroke-red-600';

/** Κείμενο ετικέτας χώρου με λευκή άλω (`paint-order: stroke` ⇒ το περίγραμμα ζωγραφίζεται **πριν** το γέμισμα). */
export const SPACE_LABEL_CLASS = 'fill-neutral-900 stroke-white [paint-order:stroke] font-medium';
export const SPACE_LABEL_UNCAPTURED_CLASS = 'fill-neutral-600 stroke-white [paint-order:stroke]';
