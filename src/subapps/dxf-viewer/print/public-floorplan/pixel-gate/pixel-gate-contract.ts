/**
 * @fileoverview **ΤΟ ΣΥΜΒΟΛΑΙΟ ΤΗΣ ΠΥΛΗΣ PIXELS** — ό,τι γράφει το όργανο και διαβάζει η κρίση (CHECK 3.101).
 * @related ADR-909 §6.7 · ./judge-pixel-gate · ./measure-public-floorplan-pixels · docs/gates/3.101.md
 * @module subapps/dxf-viewer/print/public-floorplan/pixel-gate/pixel-gate-contract
 *
 * 🔑 **ΜΙΑ ΣΤΑΘΕΡΑ, ΔΥΟ ΑΝΑΓΝΩΣΤΕΣ**: το όργανο (σελίδα δοκιμής, πραγματικός browser) και η κρίση (καθαρή
 * συνάρτηση, jest). Οι ορισμοί «τι είναι μελάνι» και «τι είναι χρωματιστό» ζουν **εδώ** — αριθμός μελανιού
 * χωρίς ορισμό δεν συγκρίνεται (ADR-909 §6.5: το ίδιο PNG έδινε 4.101.261 ή 4.107.863 ανάλογα με το κατώφλι).
 */

import type { PublicFloorplanPlotStyle } from '../public-floorplan-presets';

/** Το `<script type="application/json">` απ' όπου διαβάζει η πύλη. */
export const PIXEL_GATE_RESULTS_ELEMENT_ID = 'public-floorplan-pixel-gate-results';

/** Pixel με **οποιοδήποτε** κανάλι κάτω από αυτό είναι «μελάνι» (ο ορισμός των μετρήσεων της §6.5 / §6.6). */
export const INK_CHANNEL_THRESHOLD = 250;

/** Pixel με απόκλιση καναλιών **πάνω** από αυτό είναι «χρωματιστό» (ίδιος ορισμός με την §6.6). */
export const CHROMA_SPREAD_THRESHOLD = 8;

/** Ό,τι μετρήθηκε στο **κελί** ενός δείγματος — το ορθογώνιο της εικόνας που του ανήκει. */
export interface PixelGateCell {
  /** Ο τύπος στοιχείου του δείγματος (`RenderableEntityType`). */
  readonly sample: string;
  /** Το δείχνει το προφίλ με **όλες** τις ομάδες αναμμένες; `false` ⇒ το κελί οφείλει να είναι άδειο. */
  readonly shown: boolean;
  /** Το δείγμα **χάθηκε στη μετατροπή** της σκηνής: ο τύπος δεν έχει δρόμο προς την εικόνα. */
  readonly unconvertible: boolean;
  readonly inkPx: number;
  readonly chromaticPx: number;
  readonly maxChannelSpread: number;
}

/** Μία ομάδα `stroke()` με το ίδιο χρώμα και πάχος μέσα στο ίδιο κελί. */
export interface PixelGateStroke {
  /** Το δείγμα στο κελί του οποίου ξεκινά η γραμμή· `null` ⇒ η θέση της δεν βρέθηκε. */
  readonly sample: string | null;
  /** Το χρώμα **όπως φτάνει στο χαρτί**: `strokeStyle` × διαφάνεια, πάνω στο λευκό. */
  readonly colourHex: string;
  /** Πάχος σε px **της εικόνας** (`lineWidth` × κλίμακα του μετασχηματισμού). */
  readonly widthPx: number;
  readonly count: number;
}

/** Μία λήψη — μία στάθμη χρώματος, όλες οι ομάδες αναμμένες. */
export interface PixelGateLevel {
  readonly plotStyle: PublicFloorplanPlotStyle;
  /** Οι ομάδες με τις οποίες **πράγματι** ζωγραφίστηκε (από τη συνταγή της λήψης, όχι από το όργανο). */
  readonly groups: readonly string[];
  readonly widthPx: number;
  readonly heightPx: number;
  readonly cells: readonly PixelGateCell[];
  readonly strokes: readonly PixelGateStroke[];
  readonly unruledTypes: readonly string[];
  /** Αποτύπωμα των pixels της λήψης, και μιας **δεύτερης** ίδιας λήψης. */
  readonly digest: string;
  readonly repeatDigest: string;
  /**
   * Τα δείγματα που το κελί τους **άλλαξε** ανάμεσα στις δύο λήψεις (με πλήθος pixels) — ώστε το Κ5 να λέει
   * **πού**, όχι μόνο «διαφέρουν». Κενό όταν τα αποτυπώματα συμφωνούν.
   */
  readonly repeatDrift: readonly string[];
  /**
   * Οι κωδικοί απώλειας (`PrintFidelityCode`) που ανέφερε η λήψη — **και οι δύο** λήψεις της στάθμης. Κενό ⇒ κάθε
   * εικόνα και κάθε σχήμα 3Δ ήταν έτοιμο. Μη κενό ⇒ η πύλη έκρινε **εφεδρικό** σχέδιο (κουτί, επίπεδο γκρι), όχι
   * το στοιχείο: η μέτρηση είναι άκυρη (Κ4, ADR-909 Γ1β).
   */
  readonly fidelity: readonly string[];
}

export interface PixelGateMeasurement {
  /** Οι τύποι για τους οποίους υπάρχει δείγμα. */
  readonly sampleTypes: readonly string[];
  /** Το δάπεδο πάχους της δημόσιας κάτοψης, όπως το δηλώνει η **λήψη**. */
  readonly minLineWidthPx: number;
  readonly levels: readonly PixelGateLevel[];
}
