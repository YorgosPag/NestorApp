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
 *   - Exclusive consumption: when a handler consumes, the bus calls
 *     `stopImmediatePropagation()` — sibling `window`-capture listeners are
 *     silenced too, not just downstream ones (ADR-364 §10.10 Μηχ. 2).
 *     ⇒ ONE ESC = ONE action. Handlers that do NOT consume leave the press
 *     untouched, so legitimate downstream owners still see it.
 */

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

function isEditableFocus(): boolean {
  if (!isBrowser()) return false;
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  return el.getAttribute('contenteditable') === 'true';
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
    // ADR-364 §10.10 Φ2 Μηχανισμός 2 — `stopImmediatePropagation`, ΟΧΙ `stopPropagation`.
    //
    // Το `stopPropagation()` σταματά μόνο τους ΚΑΤΑΝΤΗ κόμβους (document capture,
    // bubble, React onKeyDown). ΔΕΝ αγγίζει τους **αδελφούς** listeners του ίδιου
    // κόμβου και της ίδιας φάσης — `window` + capture — που είναι ακριβώς η μόνη
    // πραγματικά επικίνδυνη κατηγορία (§10.2, «Ζώνη Α», 5 αρχεία):
    //   useCanvasKeyboardShortcuts · use3DShortcuts (→ shortcut-dispatcher)
    //   useDxfViewerEffects · useColorMenuState · use-waypoint-drag-interaction
    //
    // Χωρίς αυτό, ο `useCanvasKeyboardShortcuts` προωθεί ωμό `e.key` στα
    // trim/scale/stretch/extend (§10.5 Κ2-β), που συγκρίνουν εσωτερικά με
    // `'Escape'` — ενώ τα ΙΔΙΑ `handleXEscape` έχουν ήδη τρέξει από το
    // `MODIFY_TOOL` slot ⇒ **διπλή αποστολή σε ένα πάτημα**.
    //
    // Ισχύει μόνο επειδή ο bus τρέχει ΠΡΙΝ από αυτούς. Μετρημένο στον browser
    // (2026-07-25): με ενεργό `trim`, ένα ESC έβγαλε ετυμηγορία `ok` και ΟΧΙ
    // `preempted` — δηλαδή το `preventDefault()` του `useCanvasKeyboardShortcuts:165`
    // ΔΕΝ είχε προηγηθεί. ⚠️ Η σειρά είναι σειρά mount, δηλαδή αναδυόμενη· ο
    // Μηχανισμός 1 (`escape-dev-audit`) είναι ο φύλακας που θα φωνάξει `preempted`
    // αν κάποιο μελλοντικό refactor την αντιστρέψει.
    //
    // Κατά προδιαγραφή το `stopImmediatePropagation()` θέτει ΚΑΙ τη σημαία του
    // `stopPropagation()` — δεύτερη κλήση θα ήταν νεκρός κώδικας.
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
