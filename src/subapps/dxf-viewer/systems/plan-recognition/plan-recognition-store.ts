/**
 * ⚠️  ADR-040 preview-performance contract — READ BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-929 Φ5 — store της **αναγνώρισης κάτοψης** που ελέγχει ο άνθρωπος (ΧΑΜΗΛΟΣΥΧΝΟ).
 *
 * Κρατά το αποτέλεσμα των Φ1/Φ2 (ευθυγράμμιση + τμήματα), την ανάγνωση της Φ3 (όταν ζητηθεί) και τη σύντηξη της
 * Φ4. Τίποτα εδώ δεν είναι η σκηνή: οι τοίχοι γράφονται μόνο από τον ελεγκτή του ADR-911 μετά από ρητή έγκριση.
 * Γράφεται σε διακριτές πράξεις (έναρξη · τέλος ευθυγράμμισης · απάντηση · ανάγνωση) — ποτέ ανά καρέ.
 *
 * ⚠️ ΕΝΑΣ γραφέας: `plan-recognition-session.ts` (μαζί με τα υπο-modules του: `plan-reading-review.ts` ως
 *   `planRecognitionSession.review` — ADR-929 Φ5.3β · `plan-scale-controller.ts` ως `planRecognitionSession.scale` — Φ5.3γ ·
 *   `plan-segment-mask-controller.ts`, οι τοίχοι που ακολουθούν την όψη, μέσω του `review` — §6.10 Α2).
 *
 * @see ./plan-recognition-session.ts
 * @see ../../components/dxf-layout/PlanRecognitionOverlay.tsx (καταναλωτής καμβά)
 */

import { useSyncExternalStore } from 'react';
import { createExternalStore } from '../../stores/createExternalStore';
import type { PlanAlignment } from '../../bim/plan-recognition/alignment/plan-alignment-types';
import type { PlanFusionResult } from '../../bim/plan-recognition/fusion/plan-fusion-types';
import type {
  PlanInputKind,
  PlanReadingOutcome,
  PlanReadingUnavailableReason,
  PlanSegmentRoleVerdict,
  RasterSegment,
} from '../../bim/plan-recognition/plan-recognition-types';
import type { PlanReadingView, PlanViewSegment } from '../../bim/plan-recognition/reading/plan-reading-view';
import type { PlanReadingPreflightResult } from '../../bim/plan-recognition/reading/plan-reading-contract';
import type { RasterPixelScale } from '../../floorplan-background/geometry/raster-pixel-scale';

/** `idle` — καμία αναγνώριση · `running` — ευθυγράμμιση/τμήματα σε εξέλιξη · `ready` — υπάρχει αποτέλεσμα. */
export type PlanRecognitionPhase = 'idle' | 'running' | 'ready';

/** Γιατί δεν βγήκε αποτέλεσμα — ΠΑΝΤΑ με όνομα (Δ16 #4). */
export type PlanRecognitionFailure = 'no-background' | 'no-pixels' | 'aligner-failed' | 'no-segments';

/** Ό,τι έδωσαν οι Φ1/Φ2 για ΕΝΑ υπόβαθρο: η είσοδος κάθε επανάληψης της σύντηξης. */
export interface PlanRecognitionRun {
  readonly id: string;
  readonly floorId: string;
  readonly backgroundId: string;
  readonly kind: PlanInputKind;
  readonly alignment: PlanAlignment;
  readonly segments: readonly RasterSegment[];
  /**
   * ADR-929 Φ5.4 — οι κρίσεις ρόλου της Φ2 (διάσταση · επέκταση · τοίχος …), ανά τμήμα. Λείπει ⇒ η αναγνώριση δεν
   * ταξινομήθηκε, και κάθε τμήμα μένει υποψήφια παρειά (`isWallCandidateRole`).
   */
  readonly segmentRoles?: readonly PlanSegmentRoleVerdict[];
  /** Η κλίμακα του υποβάθρου τη στιγμή της αναγνώρισης (`resolveRasterPixelScale`, Δ4). */
  readonly knownScale: RasterPixelScale | null;
  /**
   * ADR-929 §6.10 Α2 — η όψη του ανθρώπου (crop + περιοχές απόκρυψης) από την οποία βγήκαν τα `segments`. Λείπει ⇒ η
   * πρόταση της ευθυγράμμισης (η αρχική εξαγωγή). Ό,τι βλέπει ο άνθρωπος στην όψη, αυτό μετρά για τους τοίχους.
   */
  readonly maskView?: PlanReadingView;
}

// ─── ADR-929 Φ5.3β: η όψη που ελέγχει ο άνθρωπος πριν φύγει ───────────────────────────────────────────────────────

/**
 * **Το πακέτο αποστολής**: ό,τι ετοιμάστηκε στο «Έλεγχος πριν την αποστολή». Η αποστολή χρησιμοποιεί **ΜΟΝΟ** αυτό
 * (όψη, τμήματα, bytes), ποτέ την τρέχουσα όψη: «ό,τι βλέπεις, αυτό φεύγει» είναι δομή, όχι πειθαρχία. Κάθε επεξεργασία
 * της όψης το σβήνει.
 */
export interface PlanReadingPacket {
  readonly view: PlanReadingView;
  readonly segments: readonly PlanViewSegment[];
  /** Τα bytes που θα φύγουν (PNG). */
  readonly blob: Blob;
  /** `URL.createObjectURL(blob)` του **ίδιου** Blob: η μικρογραφία είναι τα bytes που φεύγουν. Ανακαλείται από τον ελεγκτή. */
  readonly previewUrl: string;
  readonly sha256: string;
  readonly widthPx: number;
  readonly heightPx: number;
}

export type PlanReadingPreflightState =
  | { readonly status: 'idle' }
  | { readonly status: 'checking' }
  | { readonly status: 'done'; readonly result: PlanReadingPreflightResult }
  /** Δίκτυο / διακομιστής: δεν ξέρουμε ⇒ καμία αποστολή (fail-closed). */
  | { readonly status: 'failed' };

/** Τι διαβάστηκε — μόνο για εμφάνιση· η ίδια η ανάγνωση ζει στο `reading`. */
export interface PlanReadingCounts {
  readonly texts: number;
  readonly dimensions: number;
  readonly rooms: number;
  readonly openings: number;
}

export type PlanReadingSendState =
  | { readonly status: 'idle' }
  | { readonly status: 'preparing' }
  | { readonly status: 'prepare-failed' }
  | { readonly status: 'sending' }
  /** Διαβάστηκε **και** ο διακομιστής επιβεβαίωσε ότι έλαβε ακριβώς τα bytes του πακέτου. */
  | { readonly status: 'read'; readonly counts: PlanReadingCounts; readonly cacheHit: boolean }
  /** Ο διακομιστής έλαβε άλλα bytes από όσα είδε ο άνθρωπος: η ανάγνωση **δεν** μπήκε στη σύντηξη. */
  | { readonly status: 'receipt-mismatch' }
  | { readonly status: 'unavailable'; readonly reason: PlanReadingUnavailableReason }
  | { readonly status: 'failed' };

/** `select`: σύρσιμο/αλλαγή μεγέθους· `add-redaction`: το επόμενο σύρσιμο στον καμβά σχεδιάζει νέα περιοχή. */
export type PlanReadingTool = 'select' | 'add-redaction';

/**
 * ADR-929 §6.10 Α2 — οι τοίχοι ακολουθούν την όψη: `following` (βγήκαν από την τρέχουσα όψη) · `updating` (ξαναβγαίνουν
 * μετά την τελευταία αλλαγή) · `failed` (η επανεξαγωγή απέτυχε· μένουν της προηγούμενης όψης).
 */
export type PlanReadingWallsStatus = 'following' | 'updating' | 'failed';

export interface PlanReadingWalls {
  readonly status: PlanReadingWallsStatus;
  /** Η ανάγνωση AI ακυρώθηκε επειδή άλλαξε η όψη· `true` ⇒ υπάρχει **Αναίρεση** (ένα επίπεδο). */
  readonly readingDropped: boolean;
}

export const WALLS_FOLLOWING: PlanReadingWalls = { status: 'following', readingDropped: false };

export interface PlanReadingReview {
  /** Η πρόταση της ευθυγράμμισης (για «Επαναφορά πρότασης»). */
  readonly proposed: PlanReadingView;
  readonly view: PlanReadingView;
  readonly tool: PlanReadingTool;
  readonly packet: PlanReadingPacket | null;
  readonly preflight: PlanReadingPreflightState;
  readonly send: PlanReadingSendState;
  /** ADR-929 §6.10 Α2 — οι τοίχοι απέναντι στην όψη. */
  readonly walls: PlanReadingWalls;
}

export interface PlanRecognitionState {
  readonly phase: PlanRecognitionPhase;
  readonly run: PlanRecognitionRun | null;
  /** `null` = δεν ζητήθηκε ανάγνωση (η γεωμετρία μόνη της, Δ15 #1). */
  readonly reading: PlanReadingOutcome | null;
  readonly fusion: PlanFusionResult | null;
  readonly failure: PlanRecognitionFailure | null;
  /** ADR-929 Φ5.3β — `null` = καμία όψη υπό έλεγχο. */
  readonly review: PlanReadingReview | null;
  /** ADR-929 Φ5.3γ — η διάσταση που δείχνει ο άνθρωπος στην κάρτα κλίμακας (επισήμανση στον καμβά). */
  readonly scaleHoverTextId: string | null;
}

const IDLE: PlanRecognitionState = {
  phase: 'idle', run: null, reading: null, fusion: null, failure: null, review: null, scaleHoverTextId: null,
};

const store = createExternalStore<PlanRecognitionState>(IDLE, { equals: Object.is });

export const planRecognitionStore = {
  get(): PlanRecognitionState {
    return store.get();
  },
  /** Μερική ενημέρωση — ΜΟΝΟ από τον ελεγκτή. */
  patch(next: Partial<PlanRecognitionState>): void {
    store.set({ ...store.get(), ...next });
  },
  reset(): void {
    store.set(IDLE);
  },
  subscribe(listener: () => void): () => void {
    return store.subscribe(listener);
  },
};

/** React συνδρομή (φύλλο καμβά · πάνελ). */
export function usePlanRecognitionState(): PlanRecognitionState {
  return useSyncExternalStore(store.subscribe, store.get, () => IDLE);
}
