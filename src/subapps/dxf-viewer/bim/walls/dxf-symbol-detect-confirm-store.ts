/**
 * ADR-533 — confirm-dialog handshake store για την «ανίχνευση συμβόλου κουφώματος
 * σε τοίχο». Παρουσιάζει **ένα κούφωμα τη φορά** (απόφαση Giorgio: ένα-ένα prompt
 * με τύπο/πλάτος/φορά). Χτισμένο στο SSoT `createConfirmStore` (μηδέν boilerplate).
 *
 * @see ../../stores/createConfirmStore.ts (SSoT factory)
 * @see ../../app/DxfSymbolDetectHost.tsx (orchestrator)
 * @see ../../ui/dialogs/DxfSymbolDetectConfirmDialog.tsx (view)
 */

import { createConfirmStore } from '../../stores/createConfirmStore';
import type { DetectedOpening } from './dxf-symbol-detector';

/** 'add' → δημιουργία αυτού του κουφώματος· 'skip' → παράλειψη. */
export type DxfSymbolDetectAction = 'add' | 'skip';

export interface DxfSymbolDetectState {
  readonly open: boolean;
  /** Το τρέχον αναγνωρισμένο κούφωμα (null όσο είναι κλειστό). */
  readonly opening: DetectedOpening | null;
  /** 1-based δείκτης στην ακολουθία. */
  readonly index: number;
  readonly total: number;
  /** Εύρος σε mm (ο host το έχει ήδη μετατρέψει από scene units). */
  readonly widthMm: number;
}

const CLOSED: DxfSymbolDetectState = {
  open: false,
  opening: null,
  index: 0,
  total: 0,
  widthMm: 0,
};

const _store = createConfirmStore<DxfSymbolDetectState, DxfSymbolDetectAction>(CLOSED);

/** Ανοίγει το dialog για ΕΝΑ κούφωμα και περιμένει την επιλογή του χρήστη. */
export function requestDxfSymbolDetectConfirm(args: {
  opening: DetectedOpening;
  index: number;
  total: number;
  widthMm: number;
}): Promise<DxfSymbolDetectAction> {
  return _store.request({ open: true, ...args });
}

/** Καλείται από το dialog στο κλικ του χρήστη. */
export function resolveDxfSymbolDetectConfirm(action: DxfSymbolDetectAction): void {
  _store.resolve(action);
}

/** useSyncExternalStore-compatible subscribe. */
export const subscribeDxfSymbolDetectConfirm = _store.subscribe;

/** useSyncExternalStore-compatible snapshot getter (σταθερή reference μεταξύ αλλαγών). */
export const getDxfSymbolDetectConfirmState = _store.getSnapshot;
