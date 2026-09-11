/**
 * ADR-364 §10.15.γ · ADR-241 — **Στρώσεις Escape εκτός του bus: ΕΝΑ Esc = ΕΝΑ ΠΛΑΙΣΙΟ προς τα έξω.**
 *
 * Framework-free επίτηδες (όπως το `keyboard-scope.ts`): το εισάγουν τα `src/hooks/**`, τα `src/components/ui/**`
 * και το υποσύστημα του viewer — καμία εξάρτηση από React, κανένα import κύκλου.
 *
 * ── ΤΙ ΛΥΝΕΙ (μετρημένο ζωντανά 2026-09-11) ──
 *
 * Με ανοιχτή στρώση Radix (Select / DropdownMenu / Popover / Dialog) μέσα σε πλήρη οθόνη, **ένα** Esc έκλεινε **και**
 * τη στρώση **και** την πλήρη οθόνη — σε 4 καταναλωτές, και στον DXF. Αιτία: το `useEscapeKey` ήταν ωμός listener
 * `document` που **δεν** ρωτούσε αν το πάτημα είχε ήδη ιδιοκτήτη, ενώ ο Radix καλεί `preventDefault()` στο document
 * **capture** πριν κλείσει. Κάθε ωμός listener πίστευε ότι το πάτημα είναι δικό του.
 *
 * ── ΤΟ ΣΧΗΜΑ: στοίβα + το συμβόλαιο ιδιοκτησίας του ίδιου του DOM ──
 *
 * Μία LIFO στοίβα (ο κανόνας του top layer: ο νεότερος νικά — Revit / Figma / MUI `ModalManager`) και **ΕΝΑΣ**
 * listener `document` σε φάση **bubble**. Η σειρά ιδιοκτησίας προκύπτει **από κατασκευής**, όχι από σύμβαση:
 *
 *   1. slot του bus του viewer  — window capture + `stopImmediatePropagation` ⇒ η στοίβα δεν καλείται καν
 *   2. στρώση Radix             — document capture + `preventDefault()` πριν το dismiss
 *   3. ιδιοκτήτης στο στοιχείο  — π.χ. πεδίο με δικό του «άκυρο», `preventDefault()` στο target/bubble
 *   4. **η στοίβα**             — μόνο αν κανείς από τους παραπάνω δεν κατανάλωσε: η τελευταία λύση
 *
 * ⚠️ **ΔΕΝ είναι δεύτερος bus.** Ο bus του ADR-364 δηλώνεται μόνο για τον viewer και έχει κλίμακα προτεραιοτήτων· εδώ
 * δεν υπάρχει κλίμακα — υπάρχει **σειρά ανοίγματος**, που είναι η σωστή απάντηση για επιφάνειες και συρτάρια.
 *
 * ── ΓΙΑΤΙ Η ΣΤΟΙΒΑ ΔΗΛΩΝΕΙ ΟΤΙ ΚΑΤΑΝΑΛΩΣΕ ──
 *
 * `preventDefault()`: για να παραιτηθεί κάθε εξωτερικότερος ιδιοκτήτης που διαβάζει το ίδιο συμβόλαιο.
 * {@link claimEscape}: για να ξέρει ο έλεγχος του ADR-364 (Μηχ. 1) **ποιος** — αλλιώς κάθε πάτημα που χειρίζεται η
 * στοίβα σε σελίδα με οπλισμένο bus θα κρινόταν `shadow-owner`.
 */

/** Μία στρώση που κατέχει το Escape όσο ζει. */
export interface EscapeLayer {
  /** Σταθερό αναγνωριστικό — ίδια σύμβαση με τα `EscapeHandler.id` του bus (π.χ. `core/fullscreen-surface`). */
  readonly id: string;
  /** Καλείται **μόνο** όταν η στρώση είναι η κορυφαία και κανείς εσώτερος δεν κατανάλωσε το πάτημα. */
  readonly onEscape: (event: KeyboardEvent) => void;
}

const stack: EscapeLayer[] = [];
const claims = new WeakMap<KeyboardEvent, string>();
let listening = false;

/**
 * Δηλώνει ποιος κατανάλωσε ένα πάτημα Escape. **Ο πρώτος νικά**: ο εσώτερος ιδιοκτήτης δηλώνει πρώτος (τρέχει σε
 * νωρίτερη φάση), και μια μεταγενέστερη δήλωση δεν επιτρέπεται να τον σβήσει.
 */
export function claimEscape(event: KeyboardEvent, ownerId: string): void {
  if (!claims.has(event)) claims.set(event, ownerId);
}

/** Ο δηλωμένος ιδιοκτήτης ενός πατήματος, ή `null`. */
export function escapeClaimOf(event: KeyboardEvent): string | null {
  return claims.get(event) ?? null;
}

function onDocumentKeyDown(event: KeyboardEvent): void {
  // `isComposing`: το Escape μέσα σε σύνθεση IME ακυρώνει τη σύνθεση — ανήκει στο πεδίο, όχι σε στρώση.
  if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
  const top = stack[stack.length - 1];
  if (!top) return;
  event.preventDefault();
  claimEscape(event, top.id);
  top.onEscape(event);
}

function ensureListening(): void {
  if (listening || typeof document === 'undefined') return;
  document.addEventListener('keydown', onDocumentKeyDown);
  listening = true;
}

function stopListeningIfEmpty(): void {
  if (!listening || stack.length > 0) return;
  document.removeEventListener('keydown', onDocumentKeyDown);
  listening = false;
}

/**
 * Βάζει μια στρώση στην κορυφή της στοίβας.
 *
 * @returns αποδέσμευση — **ιδempotent από κατασκευής**: κάθε κλήση δημιουργεί **δική της** εγγραφή και η αφαίρεση
 * γίνεται με την **ταυτότητα** της εγγραφής, όχι με το `id`. Άρα το διπλό cleanup του React StrictMode βρίσκει
 * `-1` τη δεύτερη φορά, και δύο στρώσεις με το ίδιο `id` (π.χ. δύο πλήρεις οθόνες) δεν αφαιρούν η μία την άλλη.
 */
export function pushEscapeLayer(layer: EscapeLayer): () => void {
  const entry: EscapeLayer = { id: layer.id, onEscape: layer.onEscape };
  stack.push(entry);
  ensureListening();
  return () => {
    const index = stack.lastIndexOf(entry);
    if (index >= 0) stack.splice(index, 1);
    stopListeningIfEmpty();
  };
}

/** Dev/test παρατηρητής — τα `id` από την εξωτερική προς την εσώτερη στρώση. */
export function inspectEscapeLayers(): readonly string[] {
  return stack.map((layer) => layer.id);
}

/** Test-only — άδειασμα της στοίβας μεταξύ tests. Ο κώδικας παραγωγής ΔΕΝ το καλεί. */
export function __resetEscapeLayersForTests(): void {
  stack.length = 0;
  stopListeningIfEmpty();
}
