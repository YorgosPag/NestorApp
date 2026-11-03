/**
 * quote-intake-view — **ΠΟΙΑ ΟΘΟΝΗ ΔΙΚΑΙΟΥΤΑΙ ΑΥΤΗ Η ΠΡΟΣΦΟΡΑ** (ADR-327 §6.10).
 *
 * Καθαρή συνάρτηση, κοινή για πελάτη και server: ο ΕΝΑΣ κριτής που ρωτούν η σελίδα ελέγχου
 * (`QuoteReviewClient`), το polling (`useQuote`) και η επανάληψη (`api/quotes/[id]/rescan` · `markQuoteExtractionPending`).
 *
 * 🔴 ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΘΕΡΑΠΕΥΕΙ (μετρημένο 2026-11-03): η οθόνη έδειχνε «Επεξεργασία AI σε εξέλιξη» για **κάθε**
 * `extractedData === null`. Στη βάση: 4 προσφορές, και οι **3** (2 πύλης, 1 χειροκίνητη — η QT-0002 ανάμεσά τους)
 * δεν είχαν ζητήσει ποτέ εξαγωγή ⇒ spinner για πάντα. Το `null` σήμαινε τέσσερα πράγματα: «τρέχει» ·
 * «απέτυχε» · «κόπηκε η διεργασία» · «δεν ζητήθηκε». Η κατάσταση ζει πλέον **ρητά** στο `Quote.extraction`
 * (Rossum `importing → to_review | failed_import`)· η απουσία δεδομένων δεν σημαίνει τίποτα.
 *
 * 🔑 Η πύλη (Procore bid form) και η χειροκίνητη καταχώριση είναι **ήδη** δομημένα δεδομένα ⇒ προβολή
 * προσφοράς, ποτέ σταθμός ελέγχου εξαγωγής.
 */

import { normalizeToDate } from '@/lib/date-local';
import type { Quote, QuoteExtractionErrorCode } from '../types/quote';

/**
 * Μετά από πόση ώρα μια `pending` εξαγωγή θεωρείται κολλημένη. Το `maxDuration` της σάρωσης είναι 180s
 * (`api/quotes/scan/route.ts`)· 5′ = περιθώριο ουράς + ψυχρής εκκίνησης, ποτέ πριν τελειώσει μια ζωντανή διεργασία.
 */
export const QUOTE_EXTRACTION_STALE_AFTER_MS = 5 * 60 * 1000;

export type QuoteIntakeView =
  /** Η εξαγωγή τρέχει — spinner + polling. */
  | { readonly kind: 'extracting' }
  /** `pending` πέρα από το όριο: η διεργασία κόπηκε (restart/deploy μέσα στο `after()`). */
  | { readonly kind: 'stalled' }
  | { readonly kind: 'failed'; readonly errorCode: QuoteExtractionErrorCode | null }
  /** Υπάρχει εξαγωγή — σταθμός ελέγχου (έγγραφο | εξαγωγή). */
  | { readonly kind: 'review_extraction' }
  /** Δεν ζητήθηκε εξαγωγή (πύλη · χειροκίνητη · email) — προβολή/επεξεργασία της προσφοράς. */
  | { readonly kind: 'quote_detail' };

type IntakeSubject = Pick<Quote, 'source' | 'extractedData' | 'extraction' | 'createdAt' | 'notes'>;

/** Σήμανση αποτυχίας που έγραφε το `process.ts` στο `notes` πριν το §6.10 — μόνο για παλιά έγγραφα. */
const LEGACY_FAILURE_NOTE_PREFIX = '[AI scan]';

function isStale(startedAt: unknown, nowMs: number): boolean {
  const started = normalizeToDate(startedAt);
  // Άγνωστη στιγμή έναρξης ⇒ δεν μπορούμε να αποδείξουμε ότι τρέχει ⇒ κολλημένη (ποτέ spinner για πάντα).
  return started === null || nowMs - started.getTime() > QUOTE_EXTRACTION_STALE_AFTER_MS;
}

/** Έγγραφα πριν το §6.10 (χωρίς `extraction`): η μόνη μαρτυρία είναι η πηγή, το `notes` και η ηλικία. */
function resolveLegacy(quote: IntakeSubject, nowMs: number): QuoteIntakeView {
  if (quote.source !== 'scan') return { kind: 'quote_detail' };
  if (quote.notes?.startsWith(LEGACY_FAILURE_NOTE_PREFIX)) return { kind: 'failed', errorCode: null };
  return isStale(quote.createdAt, nowMs) ? { kind: 'stalled' } : { kind: 'extracting' };
}

export function resolveQuoteIntakeView(quote: IntakeSubject, nowMs: number): QuoteIntakeView {
  // Τα δεδομένα εξαγωγής κερδίζουν πάντα: μια επανάληψη που απέτυχε δεν σβήνει μια προηγούμενη επιτυχία.
  if (quote.extractedData) return { kind: 'review_extraction' };

  const extraction = quote.extraction;
  if (!extraction) return resolveLegacy(quote, nowMs);

  switch (extraction.status) {
    case 'pending':
      return isStale(extraction.startedAt, nowMs) ? { kind: 'stalled' } : { kind: 'extracting' };
    case 'failed':
      return { kind: 'failed', errorCode: extraction.errorCode };
    case 'succeeded':
      // Επιτυχία χωρίς δεδομένα δεν γράφεται ποτέ (ίδια εγγραφή στο `applyExtractedData`)· αν εμφανιστεί, ο
      // άνθρωπος παίρνει την προσφορά να τη συμπληρώσει — όχι spinner.
      return { kind: 'quote_detail' };
  }
}

export type PendingQuoteIntakeView = Extract<QuoteIntakeView, { kind: 'extracting' | 'stalled' | 'failed' }>;

/** Δεν υπάρχουν (ακόμη) δεδομένα να δειχθούν: τρέχει, κόλλησε ή απέτυχε — η κάρτα κατάστασης. */
export function isPendingIntake(view: QuoteIntakeView): view is PendingQuoteIntakeView {
  return view.kind === 'extracting' || view.kind === 'stalled' || view.kind === 'failed';
}

/** Σταματά το polling; — μόνο όσο η εξαγωγή **τρέχει** αξίζει να ξαναρωτάμε. */
export function isQuoteIntakeSettled(quote: IntakeSubject | null, nowMs: number): boolean {
  return quote !== null && resolveQuoteIntakeView(quote, nowMs).kind !== 'extracting';
}

/**
 * Έχει η προσφορά πρωτότυπο έγγραφο να δείξει; — από τα **συνημμένα**, όχι από την πηγή.
 * Ήταν δύο αντίγραφα του `source === 'scan' || 'email_inbox'` (`QuoteRightPane` · `quote-header-actions`):
 * πύλη με συνημμένο έκρυβε το έγγραφο, email χωρίς συνημμένο έδειχνε κενό πάνελ.
 */
export function quoteHasOriginalDocument(quote: Pick<Quote, 'attachments'>): boolean {
  return (quote.attachments ?? []).length > 0;
}
