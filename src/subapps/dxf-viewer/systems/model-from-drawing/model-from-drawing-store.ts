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
import type { AssistantPreview } from '../../bim/model-from-drawing/assistant-preview';

/**
 * `closed`  — ο βοηθός δεν τρέχει.
 * `picking` — οπλισμένος: το επόμενο κλικ στον καμβά είναι το δείγμα «τοίχος» (Δ1).
 * `review`  — υπάρχει πρόταση υπό έλεγχο.
 */
export type ModelFromDrawingPhase = 'closed' | 'picking' | 'review';

/** Ό,τι έχει να πει ο βοηθός για την τελευταία πράξη — ΠΑΝΤΑ με όνομα, ποτέ σιωπή. */
export type ModelFromDrawingNotice =
  | { readonly kind: 'no-scene' }
  | { readonly kind: 'no-line' }
  | { readonly kind: 'no-color' }
  /** Η σκηνή άλλαξε από τότε που φωτίστηκε η πρόταση· δεν γράφτηκε τίποτα, ξαναδές. */
  | { readonly kind: 'stale' }
  /** Υπάρχει ομάδα πάχους χωρίς επιβεβαίωση. */
  | { readonly kind: 'unconfirmed' }
  | { readonly kind: 'refused'; readonly refusal: AddWallsRefusal; readonly blocked: number }
  | { readonly kind: 'written'; readonly count: number; readonly retrimmed: number };

export interface ModelFromDrawingState {
  readonly phase: ModelFromDrawingPhase;
  /** Το σημείο κόσμου του κλικ-δείγματος που περιμένει υιοθέτηση από τον host. */
  readonly pendingSample: Point2D | null;
  /** Το αποδιδόμενο χρώμα (hex) που ο άνθρωπος έδειξε ως «τοίχος». */
  readonly wallColorHex: string | null;
  /** Κλειδιά αμφίσημων ορθογωνίων που ο άνθρωπος είπε ότι ΕΙΝΑΙ τοίχοι (Δ7). */
  readonly acceptedKeys: ReadonlySet<string>;
  /** Η λειτουργία που ο άνθρωπος ΕΠΙΒΕΒΑΙΩΣΕ ανά ομάδα πάχους (Δ3). */
  readonly categoryByThicknessMm: ReadonlyMap<number, WallCategory>;
  readonly proposal: WallProposal | null;
  readonly preview: AssistantPreview | null;
  /** «Αυτό κοιτάω τώρα» — βοήθημα ελέγχου· ΠΟΤΕ δεν αποφασίζει τι γράφεται. */
  readonly focusedKey: string | null;
  readonly notice: ModelFromDrawingNotice | null;
}

const CLOSED: ModelFromDrawingState = {
  phase: 'closed',
  pendingSample: null,
  wallColorHex: null,
  acceptedKeys: new Set(),
  categoryByThicknessMm: new Map(),
  proposal: null,
  preview: null,
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
