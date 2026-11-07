/**
 * ADR-933 — SSoT ρυθμίσεων της εντολής «Περιοχή» (σχεδίαση overlay κάτοψης).
 *
 * Ένα μέρος κρατά «τι είδος περιοχής φτιάχνει το επόμενο κλικ, και με ποια μέθοδο γεωμετρίας».
 * Πριν, το είδος ζούσε σε `useState` μέσα στον `DxfViewerContent` (απρόσιτο στην κορδέλα, που
 * δεν παίρνει props) **και** το `NormalView` το παρέκαμπτε με καρφωμένο `"property"` — δύο
 * αυθεντίες, που καμία δεν έφτανε στην αποθήκευση.
 *
 * Revit/ArchiCAD παράλληλο: ο Type Selector + Draw panel του «Place Room» / το Info Box του Zone —
 * «κολλώδεις» προεπιλογές για το ΕΠΟΜΕΝΟ στοιχείο, που επιβιώνουν ανάμεσα σε συνεδρίες.
 *
 * Αναγνώσεις:
 *   • event-time (`get()`) — η πόρτα αποθήκευσης και ο χειριστής κλικ (ADR-040 κανόνας 2)·
 *   • reactive (`useOverlayDrawSettings()`) — μόνο τα widgets της κορδέλας.
 *
 * Μηχανισμός: το υπάρχον `createPersistedValue` (createExternalStore + storage-utils, ADR-092).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-933-region-command.md
 */

import { useSyncExternalStore } from 'react';
import { createPersistedValue } from './createPersistedValue';
import { STORAGE_KEYS } from '../utils/storage-utils';
import { isOverlayKind, type OverlayKind } from '../overlays/types';

/** Μέθοδοι γεωμετρίας (ArchiCAD Zone «Geometry Method» + Revit «Pick Lines»). */
export const OVERLAY_DRAW_METHODS = ['polygon', 'rectangle'] as const;
export type OverlayDrawMethod = (typeof OVERLAY_DRAW_METHODS)[number];

export function isOverlayDrawMethod(value: unknown): value is OverlayDrawMethod {
  return typeof value === 'string' && (OVERLAY_DRAW_METHODS as readonly string[]).includes(value);
}

export interface OverlayDrawSettings {
  /** Είδος της ΕΠΟΜΕΝΗΣ περιοχής. */
  readonly kind: OverlayKind;
  /** Μέθοδος γεωμετρίας. */
  readonly method: OverlayDrawMethod;
}

export const DEFAULT_OVERLAY_DRAW_SETTINGS: OverlayDrawSettings = {
  kind: 'property',
  method: 'polygon',
};

/** Κανονικοποίηση αποθηκευμένης τιμής — άγνωστο/χαλασμένο πεδίο ⇒ η προεπιλογή του. */
export function normalizeOverlayDrawSettings(raw: unknown): OverlayDrawSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof OverlayDrawSettings, unknown>>;
  return {
    kind: isOverlayKind(r.kind) ? r.kind : DEFAULT_OVERLAY_DRAW_SETTINGS.kind,
    method: isOverlayDrawMethod(r.method) ? r.method : DEFAULT_OVERLAY_DRAW_SETTINGS.method,
  };
}

function sameSettings(a: OverlayDrawSettings, b: OverlayDrawSettings): boolean {
  return a.kind === b.kind && a.method === b.method;
}

const store = createPersistedValue<OverlayDrawSettings>(
  STORAGE_KEYS.OVERLAY_DRAW_SETTINGS,
  DEFAULT_OVERLAY_DRAW_SETTINGS,
  { equals: sameSettings, validate: normalizeOverlayDrawSettings },
);

export const overlayDrawSettingsStore = {
  /** Event-time ανάγνωση (χειριστές κλικ, πόρτα αποθήκευσης). */
  get: (): OverlayDrawSettings => store.get(),
  subscribe: (listener: () => void): (() => void) => store.subscribe(listener),
  /** Μερική ενημέρωση — περνά πάντα από την κανονικοποίηση (καμία άκυρη τιμή στο store). */
  update(patch: Partial<OverlayDrawSettings>): void {
    store.set(normalizeOverlayDrawSettings({ ...store.get(), ...patch }));
  },
  /** jest isolation μόνο. */
  reset(next: OverlayDrawSettings = DEFAULT_OVERLAY_DRAW_SETTINGS): void {
    store.reset(next);
  },
};

const serverSnapshot = (): OverlayDrawSettings => DEFAULT_OVERLAY_DRAW_SETTINGS;
const getKind = (): OverlayKind => overlayDrawSettingsStore.get().kind;
const serverKind = (): OverlayKind => DEFAULT_OVERLAY_DRAW_SETTINGS.kind;

/** Reactive ανάγνωση — ΜΟΝΟ για UI εκτός καμβά (κορδέλα). Ο καμβάς διαβάζει με `get()`. */
export function useOverlayDrawSettings(): OverlayDrawSettings {
  return useSyncExternalStore(overlayDrawSettingsStore.subscribe, overlayDrawSettingsStore.get, serverSnapshot);
}

/** Reactive ανάγνωση ΜΟΝΟ του είδους (primitive snapshot ⇒ αλλαγή μεθόδου δεν ξαναζωγραφίζει). */
export function useOverlayDrawKind(): OverlayKind {
  return useSyncExternalStore(overlayDrawSettingsStore.subscribe, getKind, serverKind);
}
