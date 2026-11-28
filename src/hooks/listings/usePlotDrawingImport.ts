'use client';

/**
 * @fileoverview **Τοπογραφικό σχέδιο → υποψήφια → επιλογή → επιβεβαίωση** (ADR-920 §14.11 Ζ4 · Π4 · Π5 · Π9) — κατάσταση, μηδέν markup.
 * @related components/terrain/plot-outline/read-plot-drawing-on-device (η ανάγνωση στη συσκευή) ·
 *   lib/terrain/plot-outline/plot-drawing-read (ο ΚΟΙΝΟΣ πυρήνας με την πόρτα) · services/listings/plot-outline.client (`PUT`)
 * @module hooks/listings/usePlotDrawingImport
 *
 * ```
 * αρχείο ─→ είδος από τα bytes ─→ DXF: σάρωση ─→ μονάδα (του αρχείου · ή του ανθρώπου, ποτέ μαντεψιά) ─→ υποψήφια + κατάταξη
 *                               └→ PDF: σελίδες με θέσεις ─→ πίνακας συντεταγμένων ΕΓΣΑ'87 (Π5) ─→ υποψήφια + κατάταξη
 *        ─→ προεπιλογή = ΜΟΝΟ η πρόταση της κατάταξης (ισοβαθμία / χωρίς τεκμήριο ⇒ καμία) ─→ Π9 (ρητό, όχι προεπιλεγμένο)
 *        ─→ PUT: το σχέδιο ως έχει + ποιο υποψήφιο (ένα κλειδί ανά πρόθεση)
 * ```
 *
 * ⚠️ **Μηδέν αγώνας δρόμου**: δεύτερο αρχείο πριν διαβαστεί το πρώτο ⇒ μετρά μόνο το τελευταίο (μετρητής, όπως `useSurveyFile`).
 * ⚠️ **Καμία μπαγιάτικη επιβεβαίωση**: αλλάζει αρχείο, μονάδα, επιλογή ή Π9 ⇒ η έκβαση σβήνει (ανήκε σε άλλη πρόθεση).
 * 🔗 **Αμφίδρομη επισήμανση κάρτας ↔ περιγράμματος** (§14.11 «Ζ4 — αμφίδρομη επισήμανση»): το εφήμερο το ΚΑΤΕΧΕΙ αυτό το hook
 *    (ένα `peek` store ανά εισαγωγή), ώστε σχέδιο και λίστα να διαβάζουν την ΙΔΙΑ απάντηση — το λεξιλόγιο του ADR-777
 *    (`lib/listings/listing-focus`): εφήμερο ≠ επίμονο, η επιλογή σβήνει το εφήμερο (αφή: δεν υπάρχει «φεύγω»), και μόνο το
 *    ΚΛΙΚ στο σχέδιο ζητά να φανεί η κάρτα — το πέρασμα του δείκτη δεν κυλά ποτέ τη σελίδα.
 * ⚡ **Το εφήμερο ΔΕΝ είναι state του hook** (`plot-candidate-peek`, σχήμα micro-leaf ADR-040): ένα hover δεν ξανα-αποδίδει
 *    την καρτέλα — μόνο τα φύλλα που ρωτούν (μετρημένα 53–88 ms ανά hover όσο ήταν `useState`).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  readPlotDrawingOnDevice,
  type DevicePlotDrawing,
} from '@/components/terrain/plot-outline/read-plot-drawing-on-device';
import { createPlotCandidatePeek, type PlotCandidatePeek } from '@/components/terrain/plot-outline/plot-candidate-peek';
import {
  dxfDeclaresUnit,
  dxfDrawingScaleToMm,
  rankedDxfDrawing,
  rankedPdfReading,
} from '@/lib/terrain/plot-outline/plot-drawing-read';
import type { PlotOutlineRanking } from '@/lib/terrain/plot-outline/plot-outline-types';
import type { TopoUnit } from '@/lib/terrain/survey-import/topo-import-types';
import {
  confirmPlotOutline,
  reusePlotOutlineConfirmation,
  type OwnerTerrainTarget,
  type PlotOutlineConfirmOutcome,
  type PlotOutlineRefusal,
  type PreparedPlotOutlineConfirmation,
} from '@/services/listings/plot-outline.client';

/** Τα υποψήφια του σχεδίου, κριμένα — `scaleToMm` μόνο για DXF (για να ζωγραφιστεί το σχέδιο στην ίδια κλίμακα). */
export interface PlotDrawingCandidates {
  readonly ranking: PlotOutlineRanking;
  readonly scaleToMm: number | null;
  /** Κλειστά σχήματα που δεν μπορούν να είναι οικόπεδο (αυτοτομή · μηδενικό εμβαδόν · πάρα πολλές κορυφές) — λέγονται, δεν κρύβονται. */
  readonly rejectedCount: number;
}

/** «Φέρε την κάρτα αυτού του υποψηφίου στα μάτια του» — ένα αίτημα ανά κλικ στο σχέδιο (`seq` ⇒ και το ίδιο υποψήφιο ξανά). */
export interface PlotCandidateRevealRequest {
  readonly candidateId: string;
  readonly seq: number;
}

export type PlotOutlineSubmission =
  | { readonly kind: 'idle' }
  | { readonly kind: 'sending' }
  | { readonly kind: 'confirmed'; readonly outcome: Extract<PlotOutlineConfirmOutcome, { ok: true }> }
  | { readonly kind: 'refused'; readonly refusal: PlotOutlineRefusal };

export interface PlotDrawingImportApi {
  readonly file: File | null;
  readonly reading: boolean;
  readonly read: DevicePlotDrawing | null;
  /** DXF που δεν δηλώνει μονάδα: ο επιλογέας μένει ορατός (η επιλογή διορθώνεται). */
  readonly asksUnit: boolean;
  /** …και δεν διαλέχτηκε ακόμη: τα υποψήφια περιμένουν. */
  readonly needsUnit: boolean;
  readonly unit: TopoUnit | null;
  readonly candidates: PlotDrawingCandidates | null;
  readonly selectedId: string | null;
  /**
   * **Εφήμερο** — το υποψήφιο κάτω από τον δείκτη ή την εστίαση, σε σχέδιο Ή λίστα. Ποτέ δεν αγγίζει την επιλογή.
   * Σταθερό store (ίδιο αντικείμενο σε όλη τη ζωή του hook): το διαβάζουν ΜΟΝΟ τα φύλλα, γράφουν σχέδιο και κάρτες.
   */
  readonly peek: PlotCandidatePeek;
  /** Το τελευταίο κλικ πάνω στο σχέδιο — η λίστα φέρνει την κάρτα του στο οπτικό πεδίο. */
  readonly revealRequest: PlotCandidateRevealRequest | null;
  readonly showInListing: boolean;
  readonly submission: PlotOutlineSubmission;
  readonly canConfirm: boolean;
  readonly loadFile: (file: File) => Promise<void>;
  readonly setUnit: (unit: TopoUnit) => void;
  readonly select: (candidateId: string) => void;
  /** Επιλογή ΑΠΟ ΤΟ ΣΧΕΔΙΟ: η ίδια επιλογή + αίτημα να φανεί η κάρτα (σκόπιμη πράξη ⇒ επιτρέπεται κύλιση). */
  readonly selectOnDrawing: (candidateId: string) => void;
  readonly setShowInListing: (show: boolean) => void;
  readonly confirm: () => Promise<void>;
  readonly reset: () => void;
}

interface FileState {
  readonly file: File | null;
  readonly reading: boolean;
  readonly read: DevicePlotDrawing | null;
}

const NO_FILE: FileState = { file: null, reading: false, read: null };
const IDLE: PlotOutlineSubmission = { kind: 'idle' };

/** Το αρχείο και η ανάγνωσή του — μετρά μόνο η τελευταία επιλογή. */
function useDrawingFile(onRead: () => void) {
  const [state, setState] = useState<FileState>(NO_FILE);
  const latest = useRef(0);
  useEffect(() => () => void (latest.current += 1), []);

  const load = useCallback(async (file: File): Promise<void> => {
    const request = (latest.current += 1);
    setState({ file, reading: true, read: null });
    const read = await readPlotDrawingOnDevice(file);
    if (request !== latest.current) return;
    onRead();
    setState({ file, reading: false, read });
  }, [onRead]);

  const clear = useCallback(() => {
    latest.current += 1;
    setState(NO_FILE);
  }, []);

  return { ...state, load, clear };
}

/** Τα υποψήφια από την ανάγνωση + τη μονάδα — `null` όσο λείπει κάτι (ανάγνωση, μονάδα DXF, πίνακας PDF). */
function candidatesOf(read: DevicePlotDrawing | null, unit: TopoUnit | null, listingAreaM2: number | null): PlotDrawingCandidates | null {
  if (read === null || read.kind === 'refused') return null;
  if (read.kind === 'pdf') {
    const ranking = rankedPdfReading(read.reading, { listingAreaM2 });
    const rejectedCount = read.reading.status === 'tables' ? read.reading.rejected.length : 0;
    return ranking === null ? null : { ranking, scaleToMm: null, rejectedCount };
  }
  const scaleToMm = dxfDrawingScaleToMm(read.drawing.declaredInsunits, unit);
  if (scaleToMm === null) return null;
  const { found, ranking } = rankedDxfDrawing(read.drawing, scaleToMm, { listingAreaM2 });
  return { ranking, scaleToMm, rejectedCount: found.rejected.length };
}

/** Η επιλογή του ανθρώπου, ή —όσο δεν διάλεξε— η πρόταση της κατάταξης (ποτέ σιωπηλή επιλογή χωρίς τεκμήριο). */
function effectiveSelection(chosen: string | null, candidates: PlotDrawingCandidates | null): string | null {
  if (candidates === null) return null;
  const ids = candidates.ranking.ranked.map((entry) => entry.candidate.id);
  if (chosen !== null && ids.includes(chosen)) return chosen;
  return candidates.ranking.proposedId;
}

/**
 * Η επιλογή του ανθρώπου + η εστίαση των υποψηφίων (εφήμερο `peeked` + αίτημα αποκάλυψης). Οι μεταβάσεις γράφονται ΜΙΑ φορά
 * (μάθημα `useListingFocus`)· κάθε αλλαγή επιλογής σβήνει την έκβαση (`forget`).
 */
function useCandidateChoice(forget: () => void) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [peek] = useState(createPlotCandidatePeek);
  const [revealRequest, setRevealRequest] = useState<PlotCandidateRevealRequest | null>(null);
  // 🔴 Η επιλογή σβήνει το εφήμερο: στην αφή δεν υπάρχει «ο δείκτης έφυγε», θα κολλούσε στο τελευταίο πατημένο.
  const select = useCallback((id: string) => { peek.set(null); setChosen(id); forget(); }, [peek, forget]);
  const selectOnDrawing = useCallback((id: string) => {
    select(id);
    setRevealRequest((previous) => ({ candidateId: id, seq: (previous?.seq ?? 0) + 1 }));
  }, [select]);
  const clear = useCallback(() => { setChosen(null); peek.set(null); setRevealRequest(null); }, [peek]);
  return { chosen, peek, revealRequest, select, selectOnDrawing, clear };
}

/** Η αποστολή — ένα κλειδί ανά πρόθεση, η έκβαση ανήκει στην πρόθεση που έφυγε. */
function useConfirmation(target: OwnerTerrainTarget | null, onConfirmed: () => void) {
  const [submission, setSubmission] = useState<PlotOutlineSubmission>(IDLE);
  const prepared = useRef<PreparedPlotOutlineConfirmation | null>(null);
  const inFlight = useRef(false);

  const send = useCallback(async (choice: Omit<PreparedPlotOutlineConfirmation, 'idempotencyKey'>) => {
    if (target === null || inFlight.current) return;
    inFlight.current = true;
    prepared.current = reusePlotOutlineConfirmation(prepared.current, choice);
    setSubmission({ kind: 'sending' });
    try {
      const outcome = await confirmPlotOutline(target, prepared.current);
      setSubmission(outcome.ok ? { kind: 'confirmed', outcome } : { kind: 'refused', refusal: outcome.refusal });
      if (outcome.ok) onConfirmed();
    } finally {
      inFlight.current = false;
    }
  }, [target, onConfirmed]);

  const forget = useCallback(() => setSubmission(IDLE), []);
  return { submission, send, forget };
}

/**
 * @param target — η πόρτα του ιδιοκτήτη (`null` ⇒ προβολή χωρίς επιβεβαίωση).
 * @param listingAreaM2 — το εμβαδόν που δηλώνει η αγγελία (τεκμήριο κατάταξης Π4).
 * @param onConfirmed — μετά από επιβεβαίωση (π.χ. ξαναδιάβασε την κατάσταση της πόρτας).
 */
export function usePlotDrawingImport(
  target: OwnerTerrainTarget | null,
  listingAreaM2: number | null,
  onConfirmed: () => void,
): PlotDrawingImportApi {
  const [unit, setUnitState] = useState<TopoUnit | null>(null);
  const [showInListing, setShowState] = useState(false);
  const confirmation = useConfirmation(target, onConfirmed);
  const { forget } = confirmation;
  const focus = useCandidateChoice(forget);
  const clearChoice = focus.clear;
  const onRead = useCallback(() => { setUnitState(null); clearChoice(); forget(); }, [forget, clearChoice]);
  const drawing = useDrawingFile(onRead);

  const candidates = useMemo(() => candidatesOf(drawing.read, unit, listingAreaM2), [drawing.read, unit, listingAreaM2]);
  const selectedId = effectiveSelection(focus.chosen, candidates);
  const asksUnit = drawing.read?.kind === 'dxf' && !dxfDeclaresUnit(drawing.read.drawing);
  const needsUnit = asksUnit && unit === null;
  const drawingUnit = asksUnit ? unit : null;

  const setUnit = useCallback((next: TopoUnit) => { setUnitState(next); clearChoice(); forget(); }, [forget, clearChoice]);
  const setShowInListing = useCallback((show: boolean) => { setShowState(show); forget(); }, [forget]);
  const reset = useCallback(() => { drawing.clear(); onRead(); }, [drawing, onRead]);

  const canConfirm = target !== null && drawing.file !== null && selectedId !== null &&
    confirmation.submission.kind !== 'sending';
  const confirm = useCallback(async () => {
    if (!canConfirm || drawing.file === null || selectedId === null) return;
    await confirmation.send({ drawing: drawing.file, candidateId: selectedId, showInListing, drawingUnit });
  }, [canConfirm, confirmation, drawing.file, selectedId, showInListing, drawingUnit]);

  return {
    file: drawing.file, reading: drawing.reading, read: drawing.read, asksUnit, needsUnit, unit, candidates, selectedId,
    peek: focus.peek, revealRequest: focus.revealRequest, showInListing, submission: confirmation.submission, canConfirm,
    loadFile: drawing.load, setUnit, select: focus.select, selectOnDrawing: focus.selectOnDrawing,
    setShowInListing, confirm, reset,
  };
}
