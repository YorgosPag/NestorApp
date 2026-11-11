/**
 * ⚠️  ADR-040 preview-performance contract — READ BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-911 Φ3β — store της **συνεδρίας** του βοηθού «Μοντέλο από το σχέδιο» (ΧΑΜΗΛΟΣΥΧΝΟ).
 *
 * Κρατά ό,τι έχει αποφασίσει ο άνθρωπος (δείγμα χρώματος, ομάδες πάχους, αμφίσημα) και την
 * πρόταση που προκύπτει. Τίποτα εδώ δεν είναι η σκηνή: η σκηνή αλλάζει ΜΟΝΟ όταν ο ελεγκτής
 * (`model-from-drawing-session.ts`) καλέσει `addWallsToScene` μετά από ρητή έγκριση.
 *
 * Φ4-3β: κρατά και το ΔΕΥΤΕΡΟ βήμα του ίδιου βοηθού — δείγμα «κούφωμα», απαντήσεις ανθρώπου
 * ανά στοιχείο, πρόταση και προεπισκόπηση ανοιγμάτων. Ένα store, δύο ελεγκτές (τοίχοι · ανοίγματα).
 *
 * Γράφεται μόνο σε διακριτές πράξεις (άνοιγμα · κλικ δείγματος · επιβεβαίωση ομάδας · έγκριση)
 * — ποτέ ανά καρέ, ποτέ ανά mousemove. Άρα το φύλλο προεπισκόπησης και το πάνελ μπορούν να
 * συνδρομούν χωρίς να παραβιάζουν το ADR-040 (το κέλυφος του καμβά δεν συνδρομείται ποτέ —
 * CHECK 6C). Ίδιο σχήμα με το `auto-breakline-store.ts`. Εφήμερο, δεν αποθηκεύεται.
 *
 * ⚠️ ΕΝΑΣ γραφέας: ο ελεγκτής. Το πάνελ και ο καμβάς ΔΕΝ γράφουν εδώ απευθείας, εκτός από το
 * `captureModelFromDrawingSample` (το κλικ του καμβά αφήνει το σημείο· ο host το υιοθετεί).
 *
 * @see ./model-from-drawing-session.ts (ο ελεγκτής — ο μόνος που αποφασίζει)
 * @see ../../components/dxf-layout/ModelFromDrawingPreviewOverlay.tsx (καταναλωτής καμβά)
 * @see ../../ui/panels/model-from-drawing/ModelFromDrawingPanel.tsx (καταναλωτής πάνελ)
 */

import { useSyncExternalStore } from 'react';
import { createExternalStore } from '../../stores/createExternalStore';
import type { Point2D } from '../../rendering/types/Types';
import type { WallCategory } from '../../bim/types/wall-types';
import type { AddWallsRefusal } from '../../bim/walls/add-wall-to-scene';
import type { WallProposal } from '../../bim/model-from-drawing/wall-proposal';
import type { WallDecisionAnchor } from '../../bim/model-from-drawing/decision-anchors';
import type { AssistantPreview } from '../../bim/model-from-drawing/assistant-preview';
import type { OpeningProposal } from '../../bim/model-from-drawing/opening-proposal';
import type { OpeningPreview } from '../../bim/model-from-drawing/opening-preview';
import {
  NO_OPENING_REVIEW_DECISIONS,
  type OpeningDecisionAnchor,
  type OpeningReviewDecisions,
} from '../../bim/model-from-drawing/opening-review';
import type { AddOpeningsRefusal } from '../../bim/model-from-drawing/add-openings-to-scene';
import { SCENE_LINE_SOURCE, type ProposalLineSource } from './proposal-line-source';
import type { SceneBasis } from './model-from-drawing-live';
import type { DimensionWriteOutcome, RecognizedDimensionSummary } from './model-from-drawing-dimensions';

/**
 * `closed`  — ο βοηθός δεν τρέχει.
 * `picking` — οπλισμένος: το επόμενο κλικ στον καμβά είναι το δείγμα του `sampleRole` (Δ1).
 * `review`  — υπάρχει πρόταση υπό έλεγχο.
 */
export type ModelFromDrawingPhase = 'closed' | 'picking' | 'review';

/** Δ1 — ένα δείγμα ανά ρόλο: τοίχος, ή σύμβολο κουφώματος (Φ4-3β). */
export type ModelFromDrawingSampleRole = 'wall' | 'opening';

/** Ό,τι έχει να πει ο βοηθός για την τελευταία πράξη — ΠΑΝΤΑ με όνομα, ποτέ σιωπή. */
export type ModelFromDrawingNotice =
  | { readonly kind: 'no-scene' }
  | { readonly kind: 'no-line' }
  | { readonly kind: 'no-color' }
  /** Η σκηνή άλλαξε από τότε που φωτίστηκε η πρόταση· δεν γράφτηκε τίποτα, ξαναδές. */
  | { readonly kind: 'stale' }
  /** ADR-929 Φ5 — πηγή η εικόνα, αλλά η θέση της δεν είναι βαθμονομημένη: τα mm θα ήταν λάθος. */
  | { readonly kind: 'uncalibrated' }
  | { readonly kind: 'refused'; readonly refusal: AddWallsRefusal; readonly blocked: number }
  /** ADR-929 Δ20 Σ1.3β — `dimensions`: τι έγινε με τη στρώση διαστάσεων στην ίδια έγκριση (`null` ⇔ δεν υπήρχε). */
  | {
      readonly kind: 'written';
      readonly count: number;
      readonly retrimmed: number;
      readonly dimensions: DimensionWriteOutcome | null;
    }
  /** Φ4-3β — δεν υπάρχει τοίχος στο σχέδιο να φιλοξενήσει κούφωμα. */
  | { readonly kind: 'no-walls' }
  | { readonly kind: 'openings-refused'; readonly refusal: AddOpeningsRefusal }
  | { readonly kind: 'openings-written'; readonly count: number };

export interface ModelFromDrawingState {
  readonly phase: ModelFromDrawingPhase;
  /** Ποιον ρόλο δείχνει το επόμενο κλικ-δείγμα. Έχει νόημα μόνο όσο `phase === 'picking'`. */
  readonly sampleRole: ModelFromDrawingSampleRole;
  /** Το σημείο κόσμου του κλικ-δείγματος που περιμένει υιοθέτηση από τον host. */
  readonly pendingSample: Point2D | null;
  /** ADR-929 Φ5 — από πού έρχονται οι γραμμές της πρότασης: το σχέδιο, ή τα τμήματα της εικόνας του υποβάθρου. */
  readonly lineSource: ProposalLineSource;
  /** Το αποδιδόμενο χρώμα (hex) που ο άνθρωπος έδειξε ως «τοίχος». */
  readonly wallColorHex: string | null;
  /**
   * Αμφίσημα ορθογώνια που ο άνθρωπος είπε ότι ΕΙΝΑΙ τοίχοι (Δ7), ως **άγκυρες** στο πλαίσιο της πηγής (ADR-929
   * §6.11): επιβιώνουν σε νέα πηγή γραμμών του ίδιου ορόφου. Ποια καλύπτουν ποιο ορθογώνιο, και ποιες έμειναν
   * ορφανές, το λέει η πρόταση (`proposal.decisions`).
   */
  readonly acceptedDecisions: readonly WallDecisionAnchor[];
  /** Η λειτουργία που ο άνθρωπος ΕΠΙΒΕΒΑΙΩΣΕ ανά ομάδα πάχους (Δ3). */
  readonly categoryByThicknessMm: ReadonlyMap<number, WallCategory>;
  readonly proposal: WallProposal | null;
  readonly preview: AssistantPreview | null;
  /**
   * ADR-929 Δ20 Σ1.3β — η στρώση «Διαστάσεις» της ίδιας έγκρισης: θα δημιουργηθούν / υπάρχουν ήδη / σε ποιο επίπεδο.
   * Γράφεται ΜΑΖΙ με την πρόταση (ίδιος υπολογισμός), ποτέ χωριστά. `null` ⇔ η πηγή δεν έχει διαστάσεις.
   */
  readonly dimensionSummary: RecognizedDimensionSummary | null;
  /** Η σκηνή πάνω στην οποία υπολογίστηκε η πρόταση τοίχων (ο συγχρονιστής σκηνής ξέρει έτσι αν είναι μπαγιάτικη). */
  readonly wallBasis: SceneBasis | null;
  /** Το ίδιο για την πρόταση ανοιγμάτων — δική της, γιατί οι δύο ελεγκτές ξαναϋπολογίζουν χωριστά. */
  readonly openingBasis: SceneBasis | null;
  /** Φ4-3β — το αποδιδόμενο χρώμα (hex) που ο άνθρωπος έδειξε ως «σύμβολο κουφώματος». */
  readonly openingColorHex: string | null;
  /** Φ4-3β — ό,τι απάντησε ο άνθρωπος ανά στοιχείο «προς απόφαση» (πόρτα · παράθυρο · τίποτα). */
  readonly openingDecisions: readonly OpeningDecisionAnchor[];
  /**
   * ADR-929 §6.13 — οι αποφάσεις όπως ξαναβρέθηκαν στην τρέχουσα πρόταση: απάντηση ανά κλειδί, άγκυρα ανά κλειδί, ορφανές.
   * Παράγωγο του `openingDecisions` — γράφεται ΜΑΖΙ με την `openingProposal`, ποτέ χωριστά.
   */
  readonly openingReview: OpeningReviewDecisions;
  readonly openingProposal: OpeningProposal | null;
  readonly openingPreview: OpeningPreview | null;
  /** «Αυτό κοιτάω τώρα» — βοήθημα ελέγχου· ΠΟΤΕ δεν αποφασίζει τι γράφεται. */
  readonly focusedKey: string | null;
  readonly notice: ModelFromDrawingNotice | null;
}

const CLOSED: ModelFromDrawingState = {
  phase: 'closed',
  sampleRole: 'wall',
  pendingSample: null,
  lineSource: SCENE_LINE_SOURCE,
  wallColorHex: null,
  acceptedDecisions: [],
  categoryByThicknessMm: new Map(),
  proposal: null,
  preview: null,
  dimensionSummary: null,
  wallBasis: null,
  openingBasis: null,
  openingColorHex: null,
  openingDecisions: [],
  openingReview: NO_OPENING_REVIEW_DECISIONS,
  openingProposal: null,
  openingPreview: null,
  focusedKey: null,
  notice: null,
};

const store = createExternalStore<ModelFromDrawingState>(CLOSED, { equals: Object.is });

export const modelFromDrawingStore = {
  get(): ModelFromDrawingState {
    return store.get();
  },
  /** Μερική ενημέρωση — ΜΟΝΟ από τον ελεγκτή. */
  patch(next: Partial<ModelFromDrawingState>): void {
    store.set({ ...store.get(), ...next });
  },
  /**
   * Το αποτέλεσμα ενός επανυπολογισμού πρότασης: `computed` ⇒ έλεγχος· `null` ⇒ «χωρίς σκηνή», με όνομα,
   * και οι αποφάσεις του ανθρώπου (`inputs`) ΜΕΝΟΥΝ. ΕΝΑ σημείο για τους δύο ελεγκτές (τοίχοι · ανοίγματα).
   */
  publishRecomputed(
    inputs: Partial<ModelFromDrawingState>,
    computed: Partial<ModelFromDrawingState> | null,
    extra: Partial<ModelFromDrawingState> = {},
  ): void {
    if (!computed) this.patch({ ...inputs, notice: { kind: 'no-scene' } });
    else this.patch({ ...inputs, ...computed, ...extra, phase: 'review', notice: null });
  },
  /** Νέα συνεδρία: οπλισμένη για δείγμα, χωρίς καμία προηγούμενη απόφαση. */
  arm(): void {
    store.set({ ...CLOSED, phase: 'picking' });
  },
  reset(): void {
    store.set(CLOSED);
  },
  subscribe(listener: () => void): () => void {
    return store.subscribe(listener);
  },
};

/** Event-time read για τον click handler (χωρίς μπαγιάτικο στιγμιότυπο). */
export function isModelFromDrawingPicking(): boolean {
  return store.get().phase === 'picking';
}

/**
 * Το κλικ του καμβά αφήνει εδώ το (ήδη snapped) σημείο κόσμου. No-op όταν ο βοηθός δεν είναι
 * οπλισμένος. Ο host το υιοθετεί: εκείνος έχει τη σκηνή και τις στρώσεις, ο καμβάς όχι.
 */
export function captureModelFromDrawingSample(world: Point2D): void {
  if (store.get().phase !== 'picking') return;
  store.set({ ...store.get(), pendingSample: { x: world.x, y: world.y } });
}

/** React συνδρομή. */
export function useModelFromDrawingState(): ModelFromDrawingState {
  return useSyncExternalStore(store.subscribe, store.get, () => CLOSED);
}
