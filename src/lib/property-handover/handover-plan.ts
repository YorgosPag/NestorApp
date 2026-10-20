/**
 * @fileoverview **Τι οφείλεται σε ποιον** — η καθαρή συμφιλίωση «πώληση ⇒ παραδόσεις» (ADR-916 §5.2 · Π5).
 * @related ADR-916 Δ1 · Δ6 · Δ8 · services/property-handover/property-handover-write.service.ts (ο γραφέας)
 * @module lib/property-handover/handover-plan
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΣΥΜΦΙΛΙΩΣΗ, ΟΧΙ ΓΕΓΟΝΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 * Ο γραφέας **δεν** ρωτά «τι μόλις έγινε;» — ρωτά «τι **ισχύει** τώρα;» και συγκλίνει. Η πώληση γράφεται από
 * **πολλά** σημεία (PATCH ακινήτου · γραφέας `legalPhase` · παρακολουθήματα) χωρίς ατομικότητα (ADR-916 §2.2 Λ2)·
 * με γεγονότα, η σειρά τους θα άλλαζε το αποτέλεσμα. Εδώ **δεν** αλλάζει: ίδια κατάσταση ⇒ ίδιο σχέδιο ⇒ καμία
 * εγγραφή, και το νυχτερινό δίχτυ είναι **ο ίδιος** κώδικας.
 *
 * ⚖️ **Κανόνες** (άγκυρες Α6–Α10):
 *   · δέσμευση (κράτηση · πώληση) **ή** οριστικό ⇒ η παράδοση **ανοίγει** για κάθε αγοραστή
 *   · οριστικό ⇒ `ready` — **κολλώδες**: τίποτα στη συμφιλίωση δεν το γυρίζει πίσω (Δ8 · Ο4)
 *   · η δέσμευση έπεσε / ο αγοραστής αφαιρέθηκε **πριν** την ολοκλήρωση ⇒ `cancelled`
 *   · οικοπεδούχος **δεν** είναι παραλήπτης (`readStoredBuyerContactIds`, ADR-916 Ο1)
 *
 * **Layering**: leaf — καθαρές συναρτήσεις· ο χρόνος **δίνεται**, δεν διαβάζεται.
 */

import { resolveCommercialStatus } from '@/constants/commercial-statuses';
import { isLegalPhase } from '@/constants/legal-phases';
import { isFinalContractSigned } from '@/lib/conveyance/case-state';
import { readStoredBuyerContactIds } from '@/lib/ownership/owner-utils';
import type { PropertyHandover, PropertyHandoverCompletion, PropertyHandoverLifecycle } from '@/types/property-handover';

import { propertyHandoverIdOf } from './property-handover-id';

/** Ό,τι ισχύει **τώρα** για την πώληση ενός ακινήτου — το μόνο που κοιτά το σχέδιο. */
export interface PropertyHandoverSnapshot {
  readonly companyId: string;
  readonly propertyId: string;
  /** Η πώληση δεσμεύτηκε **ή** ολοκληρώθηκε — οφείλεται παράδοση. */
  readonly open: boolean;
  /** Υπογράφηκε το οριστικό (`legalPhase ≥ final_signed`). */
  readonly completed: boolean;
  readonly recipientContactIds: readonly string[];
}

/** Μία εγγραφή του σχεδίου — ό,τι χρειάζονται η συναλλαγή **και** το ίχνος. */
export type PropertyHandoverWrite =
  | { readonly kind: 'create'; readonly after: PropertyHandover }
  | { readonly kind: 'update'; readonly before: PropertyHandover; readonly after: PropertyHandover };

const COMMITTED_STATUSES: ReadonlySet<string> = new Set(['reserved', 'sold']);

const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

/**
 * **Το στιγμιότυπο** από το αποθηκευμένο ακίνητο. `null` ⇒ ακίνητο χωρίς μισθωτή — καμία παράδοση δεν μπορεί
 * να έχει κάτοχο (ποτέ εφευρημένος).
 */
export function propertyHandoverSnapshotOf(
  propertyId: string,
  property: Readonly<Record<string, unknown>>,
): PropertyHandoverSnapshot | null {
  if (!nonEmptyString(property.companyId)) return null;
  const status = resolveCommercialStatus(property);
  const commercial = typeof property.commercial === 'object' && property.commercial !== null
    ? (property.commercial as Record<string, unknown>)
    : {};
  const completed = isLegalPhase(commercial.legalPhase) && isFinalContractSigned(commercial.legalPhase);
  return {
    companyId: property.companyId,
    propertyId,
    open: completed || (status !== null && COMMITTED_STATUSES.has(status)),
    completed,
    recipientContactIds: readStoredBuyerContactIds(property),
  };
}

function sameCompletion(a: PropertyHandoverCompletion | null, b: PropertyHandoverCompletion | null): boolean {
  return a === b || (a !== null && b !== null && a.source === b.source && a.at === b.at);
}

/** Η παράδοση που **οφείλεται** σε έναν αγοραστή — `before` ⇒ ίδια ταυτότητα, ίδια γέννηση. */
function wantedHandover(
  snapshot: PropertyHandoverSnapshot,
  recipientContactId: string,
  before: PropertyHandover | null,
  now: string,
): PropertyHandover {
  const lifecycle: PropertyHandoverLifecycle =
    snapshot.completed || before?.lifecycle === 'ready' ? 'ready' : 'awaiting-completion';
  const completion = before?.completion ?? (snapshot.completed ? { source: 'final-contract' as const, at: now } : null);
  if (before) return { ...before, lifecycle, completion, updatedAt: now };
  return {
    id: propertyHandoverIdOf(snapshot.companyId, snapshot.propertyId, recipientContactId),
    companyId: snapshot.companyId,
    propertyId: snapshot.propertyId,
    recipientContactId,
    lifecycle,
    completion,
    // Φ-Β — η πρόσκληση **δεν** αποφασίζεται εδώ: τη κρίνει το `handover-invitation-plan` μετά, στην ίδια συναλλαγή.
    recipient: null,
    invitation: null,
    // Φ-Γ1 — η αντιγραφή αρχείων γράφεται από τον εκτελεστή της, όχι από το σχέδιο κύκλου ζωής.
    fileDelivery: null,
    createdAt: now,
    updatedAt: now,
  };
}

function changed(before: PropertyHandover, after: PropertyHandover): boolean {
  return before.lifecycle !== after.lifecycle || !sameCompletion(before.completion, after.completion);
}

/**
 * **Το σχέδιο**: οι εγγραφές που φέρνουν τις αποθηκευμένες παραδόσεις στην αλήθεια του στιγμιοτύπου.
 * Κενό ⇒ ήδη συγκλίνουν (ιδεμπότητα — Α7).
 */
export function planPropertyHandovers(
  snapshot: PropertyHandoverSnapshot,
  existing: readonly PropertyHandover[],
  now: string,
): readonly PropertyHandoverWrite[] {
  const byRecipient = new Map(existing.map((handover) => [handover.recipientContactId, handover]));
  const wanted = new Set(snapshot.open ? snapshot.recipientContactIds : []);
  const writes: PropertyHandoverWrite[] = [];

  for (const recipientContactId of wanted) {
    const before = byRecipient.get(recipientContactId) ?? null;
    const after = wantedHandover(snapshot, recipientContactId, before, now);
    if (!before) writes.push({ kind: 'create', after });
    else if (changed(before, after)) writes.push({ kind: 'update', before, after });
  }

  for (const before of existing) {
    if (wanted.has(before.recipientContactId) || before.lifecycle !== 'awaiting-completion') continue;
    writes.push({ kind: 'update', before, after: { ...before, lifecycle: 'cancelled', updatedAt: now } });
  }
  return writes;
}
