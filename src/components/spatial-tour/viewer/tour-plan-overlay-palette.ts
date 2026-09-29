/**
 * @fileoverview **ΤΑ ΧΡΩΜΑΤΑ ΠΑΝΩ ΣΤΗΝ ΚΑΤΟΨΗ** — χώροι, τελείες, κώνος, ετικέτες (ADR-884 Φ2στ-γ Γ3γ-1 · §4.14 σημείο 4).
 * @related `TourPlanMap.tsx` · `TourPlanSpaces.tsx` (οι καταναλωτές) · `TourLinkButton.tsx` / `TourFloorCursor.tsx` (ίδια αρχή
 *   πάνω στη **φωτογραφία**: λευκό/μαύρο με διαφάνεια)
 * @module components/spatial-tour/viewer/tour-plan-overlay-palette
 *
 * 🎨 **Πάνω σε ΕΙΚΟΝΑ, όχι πάνω στο θέμα**: η κάτοψη είναι λευκό χαρτί με μαύρες γραμμές και στα **δύο** θέματα — ένα
 *   `fill-card`/`stroke-foreground` θα άλλαζε με το θέμα ενώ το χαρτί από κάτω όχι. Όπως ορίζει η Zillow: **κίτρινος** ο χώρος
 *   όπου είσαι, **κόκκινη** η τρέχουσα τελεία, **μπλε** οι άλλες. Οι τιμές ζουν στο `globals.css` (`--plan-*`, **ίδιες** και στα
 *   δύο θέματα — πρότυπο `--map-seq-*` του ADR-889), ποτέ ωμή παλέτα Tailwind (ADR-365, CHECK 3.7)· το μπλε είναι το `chart-1`
 *   (ADR-710 θέση 1, ίδιο σε δύο θέματα). Εδώ είναι το **ΕΝΑ** σημείο που τα ονομάζει ως κλάσεις.
 * ♿ **Ποτέ μόνο χρώμα** (CHECK 3.41): η τρέχουσα τελεία είναι και **μεγαλύτερη**, έχει τον **κώνο** θέασης και `aria-current`.
 * 🔎 **Ετικέτες με άλω** (τεχνική χαρτογραφίας — Mapbox `text-halo`): σκούρο κείμενο με λευκό περίγραμμα **πίσω** από τα γράμματα
 *   (`paint-order: stroke`) διαβάζεται πάνω σε κάθε γραμμή, διαγράμμιση ή κίτρινο.
 */

import type { TourSpaceTone } from '@/lib/spatial-tour/viewer/tour-space-view';

/** Ο χώρος ανά ρόλο (Δ8.2 · Δ8.5): εδώ = έντονο κίτρινο · ενιαίος γείτονας = απαλό · χωρίς σημείο λήψης = γκρι · άλλος = τίποτα. */
export const SPACE_TONE_CLASS: Readonly<Record<TourSpaceTone, string>> = {
  here: 'fill-[hsl(var(--plan-space-here)/0.6)] stroke-[hsl(var(--plan-space-edge))]',
  joined: 'fill-[hsl(var(--plan-space-here)/0.3)] stroke-[hsl(var(--plan-space-edge)/0.6)]',
  uncaptured: 'fill-[hsl(var(--plan-space-idle)/0.15)] stroke-[hsl(var(--plan-space-idle)/0.4)]',
  idle: 'fill-transparent stroke-transparent',
};

export const PLAN_DOT_CLASS = {
  here: 'fill-[hsl(var(--plan-here))] stroke-white',
  other: 'fill-chart-1 stroke-white',
} as const;

export const PLAN_CONE_CLASS = 'fill-[hsl(var(--plan-here)/0.25)] stroke-[hsl(var(--plan-here))]';

/** Κείμενο ετικέτας χώρου με λευκή άλω (`paint-order: stroke` ⇒ το περίγραμμα ζωγραφίζεται **πριν** το γέμισμα). */
export const SPACE_LABEL_CLASS = 'fill-[hsl(var(--plan-ink))] stroke-white [paint-order:stroke] font-medium';
export const SPACE_LABEL_UNCAPTURED_CLASS = 'fill-[hsl(var(--plan-ink-muted))] stroke-white [paint-order:stroke]';

/**
 * **Ο επεξεργαστής χώρων** (Γ3γ-2β · Δ9): εκεί ΚΑΘΕ εγκεκριμένος χώρος πρέπει να φαίνεται (στον θεατή ο «άλλος» χώρος είναι
 * διάφανος) · η **πρόταση** είναι διακεκομμένη κίτρινη (δεν έχει εγκριθεί — Δ8.1) · η **επιλογή** και οι λαβές είναι μπλε
 * (`chart-1`, ίδιο σε δύο θέματα) — όπως η επιλογή στο Figma/Revit, ξεχωριστή από το κίτρινο «εδώ» του θεατή.
 */
const SPACE_APPROVED_CLASS = 'fill-[hsl(var(--plan-space-idle)/0.12)] stroke-[hsl(var(--plan-space-idle))]';
export const SPACE_EDITOR_TONE_CLASS: Readonly<Record<TourSpaceTone, string>> = {
  here: SPACE_APPROVED_CLASS, joined: SPACE_APPROVED_CLASS, uncaptured: SPACE_APPROVED_CLASS, idle: SPACE_APPROVED_CLASS,
};
export const SPACE_PROPOSAL_CLASS = 'fill-[hsl(var(--plan-space-here)/0.25)] stroke-[hsl(var(--plan-space-edge))]';
export const SPACE_SELECTED_CLASS = 'fill-chart-1/15 stroke-chart-1';
export const SPACE_HANDLE_CLASS = 'fill-white stroke-chart-1 cursor-move outline-none focus-visible:fill-chart-1';
export const SPACE_MIDPOINT_CLASS = 'fill-chart-1/60 stroke-white cursor-copy outline-none focus-visible:fill-chart-1';
export const SPACE_SEPARATION_CLASS = 'stroke-[hsl(var(--plan-ink))]';
export const SPACE_SEPARATION_SUGGESTED_CLASS = 'stroke-[hsl(var(--plan-here))]';
export const SPACE_PEN_CLASS = 'fill-chart-1/10 stroke-chart-1';
