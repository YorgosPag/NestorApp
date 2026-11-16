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
 * 🎨 **ΔΥΟ παλέτες, μία ανά επιφάνεια** (ADR-911 §Φ3β-palette, 2026-11-16). Οι ζώνες ζωγραφίζονται είτε πάνω στο
 * **χαρτί** ενός υποβάθρου PDF/εικόνας (λευκό) είτε πάνω στον **μαύρο** καμβά DXF (`CANVAS_BACKGROUND`). Καμία μία
 * παλέτα δεν κρατά WCAG 1.4.11 (≥ 3:1) και στα δύο με ουδέτερο «υπάρχει» — μετρημένο: το slate-700 δίνει 10,4:1 σε
 * λευκό αλλά **2,0:1** σε μαύρο. Το Revit/AutoCAD αφήνουν τον χρήστη να ξαναρυθμίσει τα χρώματα επισήμανσης όταν
 * αλλάζει φόντο· εδώ η επιλογή είναι **αυτόματη** (`preview-surface.ts`) και **εγγυημένη από πύλη**: το CHECK 3.41 κρίνει
 * κάθε παλέτα στη **δική της** επιφάνεια (`preview-zone:light` · `preview-zone:dark`: ΔE ≥ 8 σε protan/deutan, μοναδικό
 * μοτίβο, αντίθεση ≥ 3:1). Το **μοτίβο** δεν αλλάζει με την επιφάνεια — η ταυτότητα δεν εξαρτάται από το φόντο.
 *
 * 🔑 **Οι τόνοι ΓΡΑΜΜΗΣ** (`PREVIEW_LINE_TONES`) ζωγραφίζονται στην **ίδια** επιφάνεια με τα τμήματα της αναγνώρισης
 * κάτοψης (ADR-929) ⇒ το CHECK 3.41 τους κρίνει **μαζί** (οικογένειες `plan-surface` · `plan-surface:dark`): κάθε μοτίβο
 * μοναδικό, κάθε χρώμα ΔE ≥ 8 σε protan/deutan. Ο ζωγράφος (`SegmentStrokes`) δέχεται **μόνο** αυτούς τους τόνους.
 *
 * Πριν από αυτό το module τα χρώματα ζούσαν ως literals μέσα στο `RegionPerimeterPreviewOverlay`
 * και πράσινο/κόκκινο μοιράζονταν την ΙΔΙΑ παύλα — η διάκριση ήταν μόνο χρωματική.
 *
 * Τα πάχη είναι CSS px (μέγεθος οθόνης, ανεξάρτητο από το zoom) — ίδια αρχή με το
 * `auto-breakline-review-style.ts`.
 *
 * ΚΑΘΑΡΟ (pure) — zero React/DOM/store.
 *
 * @see ./preview-surface.ts (ποια επιφάνεια είναι κάτω από τη ζώνη ΤΩΡΑ)
 * @see ../../components/dxf-layout/preview-zone/PreviewZoneShape.tsx (ο ΜΟΝΟΣ ζωγράφος)
 * @see docs/centralized-systems/reference/adrs/ADR-911-model-from-drawing-assistant.md §Φ3β
 */

import { UI_COLORS } from '../../config/color-config';

export type PreviewZoneTone = 'accept' | 'reject' | 'decide' | 'existing' | 'unpaired';

/** Το μη-χρωματικό μέρος της όψης ενός τόνου — ΙΔΙΟ σε κάθε επιφάνεια. */
export interface PreviewZonePattern {
  /** CSS px. */
  readonly strokeWidth: number;
  /** SVG `stroke-dasharray`· `null` = συμπαγής. */
  readonly dash: string | null;
  /** Αδιαφάνεια γεμίσματος στο χρώμα της γραμμής· `0` = χωρίς γέμισμα. */
  readonly fillOpacity: number;
}

/** Η πλήρης όψη ενός τόνου πάνω σε μια επιφάνεια: μοτίβο + χρώμα. */
export interface PreviewZoneStyle extends PreviewZonePattern {
  readonly stroke: string;
}

export const PREVIEW_ZONE_STYLE: Readonly<Record<PreviewZoneTone, PreviewZonePattern>> = {
  accept: { strokeWidth: 2, dash: '8 4', fillOpacity: 0.12 },
  reject: { strokeWidth: 2, dash: '2 4', fillOpacity: 0.1 },
  decide: { strokeWidth: 2, dash: '12 4 2 4', fillOpacity: 0 },
  existing: { strokeWidth: 1, dash: null, fillOpacity: 0 },
  unpaired: { strokeWidth: 2, dash: '8 3 1.5 3 1.5 3', fillOpacity: 0 },
};

/**
 * Οι δύο παλέτες. `surface` = η επιφάνεια απέναντι στην οποία η παλέτα **υπόσχεται** ≥ 3:1 (τη διαβάζει και το
 * CHECK 3.41)· `stroke` = το χρώμα κάθε τόνου. Χρώματα μόνο από το `color-config` (SSoT).
 */
export const PREVIEW_SURFACES = {
  light: {
    surface: UI_COLORS.WHITE,
    stroke: {
      accept: UI_COLORS.PREVIEW_ZONE_ACCEPT,
      reject: UI_COLORS.PREVIEW_ZONE_REJECT,
      decide: UI_COLORS.PREVIEW_ZONE_DECIDE,
      existing: UI_COLORS.PREVIEW_ZONE_EXISTING,
      unpaired: UI_COLORS.PREVIEW_ZONE_UNPAIRED,
    },
  },
  dark: {
    surface: UI_COLORS.CANVAS_BACKGROUND,
    stroke: {
      accept: UI_COLORS.PREVIEW_ZONE_ACCEPT_ON_DARK,
      reject: UI_COLORS.PREVIEW_ZONE_REJECT_ON_DARK,
      decide: UI_COLORS.PREVIEW_ZONE_DECIDE_ON_DARK,
      existing: UI_COLORS.PREVIEW_ZONE_EXISTING_ON_DARK,
      unpaired: UI_COLORS.PREVIEW_ZONE_UNPAIRED_ON_DARK,
    },
  },
} as const satisfies Readonly<Record<string, { readonly surface: string; readonly stroke: Readonly<Record<PreviewZoneTone, string>> }>>;

/** Η επιφάνεια κάτω από τις ζώνες: χαρτί (`light`) ή σκούρος καμβάς (`dark`). */
export type PreviewSurface = keyof typeof PREVIEW_SURFACES;

/** Όλες οι επιφάνειες, σε σταθερή σειρά (για όποιον πρέπει να τις εξετάσει όλες). */
export const PREVIEW_SURFACE_KEYS: readonly PreviewSurface[] = ['light', 'dark'];

/** Η όψη ενός τόνου πάνω σε μια επιφάνεια — ο ΜΟΝΟΣ τρόπος να πάρει ζωγράφος χρώμα ζώνης. */
export function previewZoneStyle(tone: PreviewZoneTone, surface: PreviewSurface): PreviewZoneStyle {
  return { ...PREVIEW_ZONE_STYLE[tone], stroke: PREVIEW_SURFACES[surface].stroke[tone] };
}

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
