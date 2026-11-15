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
 *   · `unpaired` — ADR-929 §6.21.10 (Ε3): **μονή γραμμή του σχεδίου**, χωρίς δεύτερη παρειά — δεν είναι τοίχος και
 *                  δεν θα χτιστεί ως τοίχος, αλλά **δεν** είναι σφάλμα (ως τις 2026-11-16 ζωγραφιζόταν `reject`).
 *                  Βιολετί (ρόλος «discovery» του Atlassian, καμία σημασία σφάλματος/προειδοποίησης), παύλα-τελεία-τελεία
 *                  (ISO 128 «phantom»). Μόνο γραμμή, ποτέ ζώνη.
 *
 * 🔑 **Οι τόνοι ΓΡΑΜΜΗΣ** (`PREVIEW_LINE_TONES`) ζωγραφίζονται στην **ίδια** επιφάνεια με τα τμήματα της αναγνώρισης
 * κάτοψης (ADR-929) ⇒ το CHECK 3.41 τους κρίνει **μαζί** (οικογένεια `plan-surface`): κάθε μοτίβο μοναδικό, κάθε
 * χρώμα ΔE ≥ 8 σε protan/deutan. Ο ζωγράφος (`SegmentStrokes`) δέχεται **μόνο** αυτούς τους τόνους.
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

export type PreviewZoneTone = 'accept' | 'reject' | 'decide' | 'existing' | 'unpaired';

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
  unpaired: { stroke: UI_COLORS.PREVIEW_ZONE_UNPAIRED, strokeWidth: 2, dash: '8 3 1.5 3 1.5 3', fillOpacity: 0 },
};

/** Όλοι οι τόνοι, στη σειρά ζωγραφικής: ό,τι θέλει προσοχή μπαίνει τελευταίο (από πάνω). */
export const PREVIEW_ZONE_PAINT_ORDER: readonly PreviewZoneTone[] = ['existing', 'unpaired', 'accept', 'decide', 'reject'];

/** Οι τόνοι που ζωγραφίζονται ως **γραμμές** του σχεδίου (ένοικοι · σύμβολα χωρίς λωρίδα · μονές γραμμές). */
export type PreviewLineTone = Extract<PreviewZoneTone, 'decide' | 'unpaired'>;

/** Ο κλειστός κατάλογος των τόνων γραμμής — τον διαβάζει και το CHECK 3.41 (οικογένεια `plan-surface`). */
export const PREVIEW_LINE_TONES: readonly PreviewLineTone[] = ['decide', 'unpaired'];

/** Η ετικέτα μιας ζώνης (CSS px). */
export const PREVIEW_ZONE_LABEL = {
  fontSize: 12,
  fontWeight: 600,
  casing: UI_COLORS.PREVIEW_ZONE_LABEL_CASING,
  casingWidth: 0.5,
} as const;
