/**
 * ADR-364 — Escape Command Bus (DXF Viewer)
 *
 * Centralized SSoT dispatcher for the Escape key. Replaces the three competing
 * window-level capture-phase listeners (`useKeyboardShortcuts`,
 * `useDimensionKeyboardRouting`, `useCanvasKeyboardShortcuts`) and the
 * ad-hoc bubble-phase listeners scattered across popovers / dropdowns.
 *
 * Industry parallel: AutoCAD command-line precedence, Revit modal stack,
 * Google Docs / VSCode command bus. Higher-priority context wins; lower
 * fall-through runs only when no higher handler consumed the press.
 *
 * Design rules:
 *   - ONE window listener (capture phase). Installed lazily on first register.
 *   - Snapshot-then-iterate semantics: handlers added during dispatch only
 *     take effect on the NEXT keypress (re-entrancy safe).
 *   - Idempotent registration by `id` — re-registering with the same id
 *     replaces the previous entry (React strict-mode safe).
 *   - SSR-safe — no-op when `window` is undefined.
 *   - Editable-focus guard: handlers without `allowWhenEditable` are skipped
 *     when focus is in INPUT / TEXTAREA / contentEditable.
 *   - Consumption is TERMINAL (`stopImmediatePropagation`): downstream nodes AND
 *     sibling `window`-capture listeners are both cut off, so one ESC performs
 *     exactly one action. Unblocked by ADR-364 §10.13 (Μηχ. 4) — see the comment
 *     at the call site for the regression this used to cause.
 */

import { isEditableTarget } from '@/lib/a11y/keyboard-scope';
import { installEscapeAuditSentinel, noteBusDispatch } from './escape-dev-audit';
import type {
  EscapeBusInspection,
  EscapeDispatchResult,
  EscapeHandler,
} from './types';

// ADR-364 §10.6 Φ2 Μηχανισμός 1 — dev-only. Σε χρόνο import ώστε η σεντινέλα να
// είναι ΠΡΩΤΗ στους window-capture listeners: μόνο έτσι βλέπει και τα πατήματα
// στα οποία ο ίδιος ο bus λιμοκτονεί από stopImmediatePropagation ανταγωνιστή.
installEscapeAuditSentinel();

interface InternalRegistry {
  readonly entries: Map<string, EscapeHandler>;
  listenerInstalled: boolean;
  removeListener: (() => void) | null;
}

const registry: InternalRegistry = {
  entries: new Map(),
  listenerInstalled: false,
  removeListener: null,
};

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * ADR-711 — ο έλεγχος delegate-άρει πλέον στο SSoT predicate.
 *
 * ⚠️ Ο bus ρωτά **μόνο** «γράφει ο χρήστης;» και **ΠΟΤΕ** `shouldGlobalShortcutYield`.
 * Ο bus οφείλει να δουλεύει ΜΕΣΑ στα modals — εκεί ζει το slot
 * `ESC_PRIORITY.MODAL_DIALOG` (π.χ. το lightbox των σχολίων BIM). Φύλακας modal εδώ θα
 * σκότωνε το ίδιο το ESC των διαλόγων.
 */
function isEditableFocus(): boolean {
  if (!isBrowser()) return false;
  return isEditableTarget(document.activeElement);
}

function sortBySnapshot(entries: Iterable<EscapeHandler>): EscapeHandler[] {
  const arr = Array.from(entries);
  // Stable sort: higher priority first; ties preserve insertion order.
  arr.sort((a, b) => b.priority - a.priority);
  return arr;
}

function runHandlerChain(snapshot: readonly EscapeHandler[]): EscapeDispatchResult {
  // ADR-364 §3.4 (2026-05-19 update — Group 3 cascade): editable focus is
  // re-evaluated per iteration so a higher-priority handler with
  // `allowWhenEditable: true` can blur the focused element + return false, and
  // a lower-priority handler without `allowWhenEditable` will then run.
  // Industry parallel: AutoCAD command system re-evaluates context per
  // command; Revit modal stack re-checks editable state on each pop.
  for (const handler of snapshot) {
    if (isEditableFocus() && !handler.allowWhenEditable) continue;
    if (!safeCanHandle(handler)) continue;
    if (safeHandle(handler)) {
      return { consumed: true, consumedBy: handler.id };
    }
  }
  return { consumed: false, consumedBy: null };
}

function safeCanHandle(handler: EscapeHandler): boolean {
  try {
    return handler.canHandle();
  } catch (err) {
    console.error(`[EscapeBus] canHandle threw for "${handler.id}":`, err);
    return false;
  }
}

function safeHandle(handler: EscapeHandler): boolean {
  try {
    return handler.handle();
  } catch (err) {
    console.error(`[EscapeBus] handle threw for "${handler.id}":`, err);
    return false;
  }
}

function dispatch(e: KeyboardEvent): EscapeDispatchResult {
  if (e.key !== 'Escape') return { consumed: false, consumedBy: null };
  // Διαβάζεται ΠΡΙΝ την αλυσίδα: μετά, το preventDefault του ίδιου του bus θα
  // το είχε μολύνει και ο έλεγχος δεν θα ξεχώριζε ποιος προηγήθηκε.
  const preemptedAtEntry = e.defaultPrevented;
  const snapshot = sortBySnapshot(registry.entries.values());
  const result = runHandlerChain(snapshot);
  if (result.consumed) {
    e.preventDefault();
    // ADR-364 §10.13 — Μηχ. 2: ΕΝΑ ESC = ΜΙΑ ΕΝΕΡΓΕΙΑ.
    //
    // Το `stopPropagation()` σταματά μόνο τους ΚΑΤΑΝΤΗ κόμβους (document capture,
    // bubble, React onKeyDown). ΔΕΝ αγγίζει τους **αδελφούς** του ίδιου κόμβου και
    // της ίδιας φάσης (`window` + capture) — τη «Ζώνη Α» του §10.10. Το
    // `stopImmediatePropagation()` τους σταματά κι αυτούς (θέτει κατά προδιαγραφή
    // ΚΑΙ τη σημαία του `stopPropagation` — μία κλήση αρκεί).
    //
    // ΓΙΑΤΙ ΜΠΑΙΝΕΙ ΤΩΡΑ ΚΑΙ ΟΧΙ ΝΩΡΙΤΕΡΑ: μπήκε μία φορά μόνος του (§10.11.Γ) και
    // ήταν ΠΑΛΙΝΔΡΟΜΗΣΗ — σιωπούσε τους τρεις κλάδους ESC του
    // `bim-3d/shortcuts/shortcut-dispatcher.ts`, τους ΜΟΝΟΥΣ που έκλειναν τότε το 3D
    // gizmo, χωρίς να υπάρχει slot να τους παραλάβει ⇒ το gizmo δεν έκλεινε ποτέ.
    // Ο Μηχ. 4 (§10.13) τους μετανάστευσε σε gated slots
    // (`bim-3d/shortcuts/use3DEscapeRegistrations.ts`), άρα η προϋπόθεση ικανοποιείται
    // και η Ζώνη Α δεν έχει πια τίποτα να χάσει στη διαδρομή ESC.
    //
    // ⚠️ ΠΡΟΫΠΟΘΕΣΗ ΠΟΥ ΠΑΡΑΜΕΝΕΙ: ο bus πρέπει να εγγράφεται ΠΡΙΝ τους αδελφούς του
    // (μετρημένο §10.11.Β — σειρά mount, άρα αναδυόμενη). Φύλακας = ο Μηχ. 1: αν
    // κάποιο refactor την αντιστρέψει, το dev audit φωνάζει `preempted`.
    e.stopImmediatePropagation();
  }
  noteBusDispatch(e, result, preemptedAtEntry);
  return result;
}

function installListener(): void {
  if (registry.listenerInstalled || !isBrowser()) return;
  const listener = (e: KeyboardEvent): void => {
    dispatch(e);
  };
  window.addEventListener('keydown', listener, { capture: true });
  registry.listenerInstalled = true;
  registry.removeListener = () => {
    window.removeEventListener('keydown', listener, { capture: true });
    registry.listenerInstalled = false;
    registry.removeListener = null;
  };
}

function register(handler: EscapeHandler): () => void {
  if (!handler.id) {
    throw new Error('[EscapeBus] register() called without id');
  }
  registry.entries.set(handler.id, handler);
  installListener();
  return () => {
    // Only remove if the slot still holds THIS handler — re-register replaced it.
    if (registry.entries.get(handler.id) === handler) {
      registry.entries.delete(handler.id);
    }
  };
}

function inspect(): EscapeBusInspection {
  const handlers = sortBySnapshot(registry.entries.values()).map((h) => ({
    id: h.id,
    priority: h.priority,
    allowWhenEditable: h.allowWhenEditable === true,
  }));
  return { handlerCount: handlers.length, handlers };
}

/**
 * Test-only — fully reset the bus (remove listener + clear registry).
 * Production code MUST NOT call this.
 */
function __resetForTests(): void {
  registry.removeListener?.();
  registry.entries.clear();
}

/**
 * Test-only — dispatch a synthetic ESC event without touching window.
 * Returns the dispatch result. Production code MUST NOT call this.
 */
function __dispatchForTests(e: KeyboardEvent): EscapeDispatchResult {
  return dispatch(e);
}

export const escapeBus = {
  register,
  inspect,
  __resetForTests,
  __dispatchForTests,
} as const;

export type { EscapeHandler, EscapeBusInspection, EscapeDispatchResult };
