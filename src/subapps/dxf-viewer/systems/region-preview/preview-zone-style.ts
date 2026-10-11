/**
 * preview-zone-style — το ΕΝΑ λεξιλόγιο όψης μιας ζώνης προεπισκόπησης (ADR-911 Φ3β).
 *
 * Μια ζώνη απαντά στο «τι θα συμβεί σε αυτό το σχήμα αν εγκρίνω;». Τέσσερις απαντήσεις, και
 * καμία δεν μεταφέρεται ΜΟΝΟ με χρώμα: κάθε τόνος έχει δικό του **μοτίβο γραμμής**, ώστε να
 * ξεχωρίζουν και σε αχρωματοψία, και σε ασπρόμαυρη εκτύπωση οθόνης, και πάνω σε σχέδιο που
 * τυχαίνει να έχει το ίδιο χρώμα (WCAG 1.4.1 «Use of Color»).
 *
 *   · `accept`   — θα δημιουργηθεί ακριβώς όπως φωτίζεται. Παύλα 8-4, με γέμισμα.
 *   · `reject`   — ΔΕΝ θα δημιουργηθεί· ο λόγος φαίνεται. Κοντή παύλα 2-4, με γέμισμα.
 *   · `decide`   — θέλει απόφαση ανθρώπου. Παύλα-τελεία 12-4-2-4, χωρίς γέμισμα.
 *   · `existing` — υπάρχει ήδη· δεν γράφεται τίποτα. Συμπαγής λεπτή, χωρίς γέμισμα.
 *
 * Πριν από αυτό το module τα χρώματα ζούσαν ως literals μέσα στο `RegionPerimeterPreviewOverlay`
 * και πράσινο/κόκκινο μοιράζονταν την ΙΔΙΑ παύλα — η διάκριση ήταν μόνο χρωματική.
 *
 * Τα πάχη είναι CSS px (μέγεθος οθόνης, ανεξάρτητο από το zoom) — ίδια αρχή με το
 * `auto-breakline-review-style.ts`.
 *
 * ΚΑΘΑΡΟ (pure) — zero React/DOM/store.
 *
 * @see ../../components/dxf-layout/preview-zone/PreviewZoneShape.tsx (ο ΜΟΝΟΣ ζωγράφος)
 * @see docs/centralized-systems/reference/adrs/ADR-911-model-from-drawing-assistant.md §Φ3β
 */

import { UI_COLORS } from '../../config/color-config';

export type PreviewZoneTone = 'accept' | 'reject' | 'decide' | 'existing';

export interface PreviewZoneStyle {
  readonly stroke: string;
  /** CSS px. */
  readonly strokeWidth: number;
  /** SVG `stroke-dasharray`· `null` = συμπαγής. */
  readonly dash: string | null;
  /** Αδιαφάνεια γεμίσματος στο χρώμα του `stroke`· `0` = χωρίς γέμισμα. */
  readonly fillOpacity: number;
}

export const PREVIEW_ZONE_STYLE: Readonly<Record<PreviewZoneTone, PreviewZoneStyle>> = {
  accept: { stroke: UI_COLORS.PREVIEW_ZONE_ACCEPT, strokeWidth: 2, dash: '8 4', fillOpacity: 0.12 },
  reject: { stroke: UI_COLORS.PREVIEW_ZONE_REJECT, strokeWidth: 2, dash: '2 4', fillOpacity: 0.1 },
  decide: { stroke: UI_COLORS.PREVIEW_ZONE_DECIDE, strokeWidth: 2, dash: '12 4 2 4', fillOpacity: 0 },
  existing: { stroke: UI_COLORS.PREVIEW_ZONE_EXISTING, strokeWidth: 1, dash: null, fillOpacity: 0 },
};

/** Όλοι οι τόνοι, στη σειρά ζωγραφικής: ό,τι θέλει προσοχή μπαίνει τελευταίο (από πάνω). */
export const PREVIEW_ZONE_PAINT_ORDER: readonly PreviewZoneTone[] = ['existing', 'accept', 'decide', 'reject'];

/** Η ετικέτα μιας ζώνης (CSS px). */
export const PREVIEW_ZONE_LABEL = {
  fontSize: 12,
  fontWeight: 600,
  casing: UI_COLORS.PREVIEW_ZONE_LABEL_CASING,
  casingWidth: 0.5,
} as const;
