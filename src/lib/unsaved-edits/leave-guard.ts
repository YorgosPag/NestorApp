/**
 * @fileoverview **«Φεύγεις με αλλαγές που δεν αποθηκεύτηκαν»** — η ΜΙΑ ερώτηση, για κάθε έξοδο μέσα στην εφαρμογή.
 * @related ADR-912 §12.12 (Εύρημα 11) · ADR-860 §6 · ADR-248 §2.5 · `providers/DirtyFormProvider.tsx` (το κανάλι που γράφει
 *   εδώ) · `components/unsaved-edits/UnsavedEditsLeaveHost.tsx` (ο διάλογος) · `lib/app-version/unsaved-work-guard.ts`
 *   (η έξοδος από την ΚΑΡΤΕΛΑ — `beforeunload`, άλλο μητρώο, επίτηδες)
 * @module lib/unsaved-edits/leave-guard
 *
 * 🔴 **Η αφορμή** (μετρημένο 2026-10-12): καμία από τις έξι σελίδες οντότητας δεν ρωτούσε πριν χαθούν αλλαγές — άλλη
 *   γραμμή στη λίστα, «Νέο», κάρτα-φίλτρο, σύνδεσμος του μενού. Ρωτούσε μόνο ο ✕ του φύλλου κινητού.
 * 🔑 **Τρεις επιλογές** (SAP Fiori data loss message · Salesforce `lightning:unsavedChanges` · Figma/Office «Save · Don't
 *   save · Cancel»): Αποθήκευση · Απόρριψη · Συνέχεια επεξεργασίας. Η «Αποθήκευση» προσφέρεται **μόνο** όταν κάθε φόρμα
 *   με αλλαγές δήλωσε πώς αποθηκεύει· αποτυχία αποθήκευσης **ακυρώνει** την έξοδο.
 * 🔑 **Χωρίς React**: το ρωτούν η πηγή επιλογής μιας σελίδας και το σύνορο πλοήγησης (`@/lib/workspace/navigation`, 130+
 *   καταναλωτές) — κανένα από τα δύο δεν ζει κάτω από πάροχο της φόρμας.
 * 🔑 **ΟΧΙ το `unsaved-work-registry`**: εκείνο απαντά «θα χαθεί δουλειά αν ΑΝΑΝΕΩΘΕΙ η σελίδα» και περιέχει και εγγραφές
 *   Firestore σε εξέλιξη (`firestore-pending-writes`, `useFieldPatchQueue`) — που **δεν** χάνονται σε αλλαγή επιλογής.
 *   Εδώ μπαίνει μόνο ό,τι ο άνθρωπος έγραψε και δεν πάτησε «Αποθήκευση».
 */

import { createExternalStore } from '@/lib/state/createExternalStore';

/** `true`/`false` = η φόρμα ξέρει αν πέτυχε· `void` = δεν το λέει ⇒ κρίνεται από το αν **έπαψε να έχει αλλαγές**. */
export type UnsavedEditsSaver = () => Promise<boolean | void> | boolean | void;

/** Τι αποφάσισε ο άνθρωπος. Η αποθήκευση εκτελείται από τον διάλογο (μένει ανοιχτός όσο τρέχει). */
export type LeaveDecision = 'proceed' | 'stay';

export interface LeavePromptRequest {
  /** Κάθε φόρμα με αλλαγές δήλωσε τρόπο αποθήκευσης ⇒ προσφέρεται η «Αποθήκευση». */
  readonly canSave: boolean;
  /** Αποθηκεύει όλες τις φόρμες με αλλαγές. `false` ⇒ κάτι δεν αποθηκεύτηκε ⇒ η έξοδος ακυρώνεται. */
  readonly save: () => Promise<boolean>;
}

export type LeavePrompt = (request: LeavePromptRequest) => Promise<LeaveDecision>;

/** Πόσο περιμένουμε μια φόρμα που δεν επιστρέφει έκβαση να δηλώσει «καθαρή» μετά την αποθήκευσή της. */
const SETTLE_TIMEOUT_MS = 1000;

const NO_DIRTY_FORMS: ReadonlySet<string> = new Set();

// Πάνω στο ΕΝΑ pub/sub της εφαρμογής (`createExternalStore`) — όχι δεύτερο χειροποίητο `Set` ακροατών (N.0.2).
const dirtyForms = createExternalStore<ReadonlySet<string>>(NO_DIRTY_FORMS);
const savers = new Map<string, UnsavedEditsSaver>();

let prompt: LeavePrompt | null = null;
let asking = false;
let settledDepth = 0;

/** Η φόρμα `formId` έχει αλλαγές που δεν αποθηκεύτηκαν. Idempotent. */
export function markUnsavedEdits(formId: string): void {
  const forms = dirtyForms.get();
  if (forms.has(formId)) return;
  dirtyForms.set(new Set([...forms, formId]));
}

/** Η φόρμα `formId` αποθήκευσε, επανήλθε ή έκλεισε. Idempotent. */
export function clearUnsavedEdits(formId: string): void {
  const forms = dirtyForms.get();
  if (!forms.has(formId)) return;
  const next = new Set(forms);
  next.delete(formId);
  dirtyForms.set(next);
}

/** Πώς αποθηκεύει η φόρμα `saverId` — δηλώνεται **μόνο όσο έχει αλλαγές** (το δίδυμο αντίτυπο που δεν αγγίχτηκε δεν γράφει). */
export function declareUnsavedEditsSaver(saverId: string, save: UnsavedEditsSaver): void {
  savers.set(saverId, save);
}

export function withdrawUnsavedEditsSaver(saverId: string): void {
  savers.delete(saverId);
}

/** Υπάρχει φόρμα που **δήλωσε** αλλαγές; Το άγνωστο εδώ δεν ρωτά — ρωτά μόνο όποιος ξέρει (π.χ. ο ✕ του φύλλου, `force`). */
export function hasUnsavedEdits(): boolean {
  return dirtyForms.get().size > 0;
}

/** Ο ένας διάλογος της εφαρμογής δηλώνει παρουσία. Επιστρέφει την απόσυρση. */
export function installLeavePrompt(next: LeavePrompt): () => void {
  prompt = next;
  return () => {
    if (prompt === next) prompt = null;
  };
}

/**
 * **Η έξοδος έχει ήδη αποφασιστεί** — ό,τι τρέξει εδώ μέσα δεν ξαναρωτά.
 *
 * Για αλλαγές επιλογής που **δεν είναι πρόθεση του ανθρώπου να φύγει**: η εγγραφή μόλις δημιουργήθηκε ή διαγράφηκε, ή η
 * «Ακύρωση» πατήθηκε ρητά. Η φόρμα δηλώνει «καθαρή» με καθυστέρηση ενός render, άρα χωρίς αυτό η ίδια η επιτυχία της
 * αποθήκευσης θα ρωτούσε «να απορριφθούν οι αλλαγές;».
 * ⚠️ Το ξέχασμα **φαίνεται** (περιττή ερώτηση), δεν χάνει δεδομένα· το κλειστό σύνολο των καλούντων το φυλά άγκυρα.
 */
export function settledLeave<T>(run: () => T): T {
  settledDepth += 1;
  try {
    return run();
  } finally {
    settledDepth -= 1;
  }
}

function waitUntilSettled(): Promise<boolean> {
  if (!hasUnsavedEdits()) return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    const finish = (settled: boolean) => {
      clearTimeout(timer);
      unsubscribe();
      resolve(settled);
    };
    const timer = setTimeout(() => finish(false), SETTLE_TIMEOUT_MS);
    const unsubscribe = dirtyForms.subscribe(() => {
      if (!hasUnsavedEdits()) finish(true);
    });
  });
}

async function saveAll(): Promise<boolean> {
  const outcomes: Array<boolean | void> = [];
  for (const save of [...savers.values()]) {
    try {
      outcomes.push(await save());
    } catch {
      // Η φόρμα οφείλει να δείξει το σφάλμα της· εδώ αρκεί ότι η έξοδος ΔΕΝ προχωρά.
      return false;
    }
  }
  if (outcomes.includes(false)) return false;
  if (outcomes.every((outcome) => outcome === true)) return true;
  return waitUntilSettled();
}

export interface ConfirmLeaveOptions {
  /** Ρώτα ακόμη κι αν καμία φόρμα δεν δήλωσε αλλαγές: ο καλών ξέρει ότι **δεν ξέρει** (το άγνωστο δεν δηλώνει «καθαρό»). */
  readonly force?: boolean;
}

/**
 * **Επιτρέπεται η έξοδος;** `true` ⇒ τίποτα να χαθεί, ή ο άνθρωπος αποθήκευσε / απέρριψε. `false` ⇒ μένει στη φόρμα.
 *
 * ⚠️ Χωρίς στημένο διάλογο (π.χ. απομονωμένο test) η έξοδος **επιτρέπεται**: δεν υπάρχει ποιον να ρωτήσουμε, και μια
 *   πλοήγηση που δεν εκτελείται ποτέ είναι χειρότερη βλάβη από μια που δεν ρώτησε. Η ρίζα της εφαρμογής τον στήνει πάντα.
 */
export async function confirmLeave(options: ConfirmLeaveOptions = {}): Promise<boolean> {
  if (settledDepth > 0) return true;
  if (!options.force && !hasUnsavedEdits()) return true;
  if (!prompt) return true;
  // Δεύτερη έξοδος όσο η ερώτηση είναι ανοιχτή: ο άνθρωπος δεν έχει απαντήσει ακόμη ⇒ δεν φεύγει.
  if (asking) return false;

  asking = true;
  try {
    const canSave = hasUnsavedEdits() && savers.size >= dirtyForms.get().size;
    return (await prompt({ canSave, save: saveAll })) === 'proceed';
  } finally {
    asking = false;
  }
}

/**
 * **Θα ρωτηθεί ο άνθρωπος αν ζητηθεί έξοδος ΤΩΡΑ;** Σύγχρονη απάντηση, για όποιον πρέπει να αποφασίσει μέσα στο ίδιο
 * συμβάν (το `<Link>` του συνόρου: `preventDefault` ή όχι). `false` ⇒ το {@link guardLeave} εκτελεί αμέσως.
 */
export function leaveNeedsAnswer(options: ConfirmLeaveOptions = {}): boolean {
  return settledDepth === 0 && prompt !== null && (options.force === true || hasUnsavedEdits());
}

/**
 * Εκτελεί την έξοδο **αν** επιτραπεί. Σύγχρονα όταν δεν υπάρχει τίποτα να χαθεί — η συνηθισμένη διαδρομή δεν αλλάζει
 * χρονισμό (καμία υπόσχεση, κανένα επιπλέον καρέ).
 */
export function guardLeave(proceed: () => void, options: ConfirmLeaveOptions = {}): void {
  if (!leaveNeedsAnswer(options)) {
    proceed();
    return;
  }
  void confirmLeave(options).then((allowed) => {
    // Μέσα σε `settledLeave`: η φόρμα μπορεί να μην έχει δηλώσει ακόμη «καθαρή», και η απόφαση ΕΧΕΙ παρθεί.
    if (allowed) settledLeave(proceed);
  });
}

/**
 * **Αλλαγή επιλογής**: έξοδος είναι μόνο η αλλαγή **ταυτότητας**. Η ίδια ταυτότητα (ανανέωση πεδίων της ίδιας εγγραφής,
 * δεύτερη γραφή της ίδιας διεύθυνσης) δεν χάνει τίποτα ⇒ δεν ρωτά. Ο ένας κανόνας για κάθε πηγή επιλογής σελίδας
 * (`useEntityPageState` · `useContactsPageState`).
 */
export function guardSelectionChange(
  currentId: string | null | undefined,
  nextId: string | null | undefined,
  proceed: () => void,
): void {
  if ((currentId ?? null) === (nextId ?? null)) proceed();
  else guardLeave(proceed);
}

/** Μόνο για tests: καθαρή κατάσταση ανάμεσα σε περιπτώσεις. */
export function resetLeaveGuardForTests(): void {
  dirtyForms.reset(NO_DIRTY_FORMS);
  savers.clear();
  prompt = null;
  asking = false;
  settledDepth = 0;
}
