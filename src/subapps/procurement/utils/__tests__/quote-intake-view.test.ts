/**
 * ΑΓΚΥΡΑ — **ποια οθόνη δικαιούται κάθε προσφορά** (ADR-327 §6.10, 2026-11-03).
 *
 * Μετρημένο στη βάση: η QT-0002 (`source: 'portal'`, `status: 'submitted'`, 0 συνημμένα, καμία εξαγωγή) έδειχνε
 * «Επεξεργασία AI σε εξέλιξη» για πάντα, επειδή η οθόνη συμπέραινε «τρέχει» από `extractedData === null`.
 */

/* global describe, it, expect */

import {
  QUOTE_EXTRACTION_STALE_AFTER_MS,
  isPendingIntake,
  isQuoteIntakeSettled,
  quoteHasOriginalDocument,
  resolveQuoteIntakeView,
} from '../quote-intake-view';
import type { Quote, QuoteExtractionState } from '../../types/quote';

const NOW = Date.UTC(2026, 10, 3, 12, 0, 0);
const at = (msAgo: number) => ({ toDate: () => new Date(NOW - msAgo) });
const FRESH = 30_000;
const OLD = QUOTE_EXTRACTION_STALE_AFTER_MS + 1_000;

type Subject = Parameters<typeof resolveQuoteIntakeView>[0];

function quote(over: Partial<Subject>): Subject {
  return { source: 'scan', extractedData: null, extraction: undefined, createdAt: at(FRESH), notes: null, ...over } as Subject;
}

function extraction(over: Partial<QuoteExtractionState>): QuoteExtractionState {
  return { status: 'pending', startedAt: at(FRESH), finishedAt: null, errorCode: null, attempt: 1, ...over } as QuoteExtractionState;
}

const EXTRACTED = { overallConfidence: 90 } as unknown as Quote['extractedData'];

describe('resolveQuoteIntakeView — προσφορές που δεν ζήτησαν ποτέ εξαγωγή', () => {
  it.each(['portal', 'manual', 'email_inbox'] as const)('Κ1 — %s χωρίς εξαγωγή ⇒ προβολή προσφοράς, ΟΧΙ spinner', (source) => {
    expect(resolveQuoteIntakeView(quote({ source, createdAt: at(OLD) }), NOW)).toEqual({ kind: 'quote_detail' });
  });

  it('Κ1α — το ακριβές σχήμα της QT-0002 (πύλη, submitted, χωρίς πεδίο `extraction`)', () => {
    const qt0002 = quote({ source: 'portal', extraction: undefined, extractedData: null, notes: null, createdAt: at(6 * 24 * 3600_000) });
    expect(resolveQuoteIntakeView(qt0002, NOW).kind).toBe('quote_detail');
    expect(isQuoteIntakeSettled(qt0002, NOW)).toBe(true);
  });
});

describe('resolveQuoteIntakeView — ρητός κύκλος ζωής', () => {
  it('Κ2 — pending πρόσφατο ⇒ extracting (spinner + polling)', () => {
    expect(resolveQuoteIntakeView(quote({ extraction: extraction({}) }), NOW)).toEqual({ kind: 'extracting' });
  });

  it('Κ3 — pending πέρα από το όριο ⇒ stalled (κόπηκε το `after()`)', () => {
    expect(resolveQuoteIntakeView(quote({ extraction: extraction({ startedAt: at(OLD) as never }) }), NOW)).toEqual({ kind: 'stalled' });
  });

  it('Κ3α — ακριβώς στο όριο ⇒ ακόμη extracting (το όριο είναι «πέρα από»)', () => {
    const view = resolveQuoteIntakeView(quote({ extraction: extraction({ startedAt: at(QUOTE_EXTRACTION_STALE_AFTER_MS) as never }) }), NOW);
    expect(view.kind).toBe('extracting');
  });

  it('Κ3β — άγνωστη στιγμή έναρξης ⇒ stalled (ποτέ spinner χωρίς απόδειξη ότι τρέχει)', () => {
    expect(resolveQuoteIntakeView(quote({ extraction: extraction({ startedAt: null as never }) }), NOW).kind).toBe('stalled');
  });

  it('Κ3γ — Timestamp που πέρασε από JSON (`{ _seconds }`, Admin SDK) διαβάζεται σωστά', () => {
    const startedAt = { _seconds: Math.floor((NOW - FRESH) / 1000), _nanoseconds: 0 };
    expect(resolveQuoteIntakeView(quote({ extraction: extraction({ startedAt: startedAt as never }) }), NOW).kind).toBe('extracting');
  });

  it.each(['not_a_quote', 'analyzer_failed', 'document_unavailable'] as const)('Κ4 — failed/%s ⇒ failed με τον κωδικό', (errorCode) => {
    const view = resolveQuoteIntakeView(quote({ extraction: extraction({ status: 'failed', errorCode }) }), NOW);
    expect(view).toEqual({ kind: 'failed', errorCode });
  });

  it('Κ5 — τα δεδομένα εξαγωγής κερδίζουν πάντα (μια αποτυχημένη επανάληψη δεν σβήνει επιτυχία)', () => {
    const q = quote({ extractedData: EXTRACTED, extraction: extraction({ status: 'failed', errorCode: 'analyzer_failed' }) });
    expect(resolveQuoteIntakeView(q, NOW)).toEqual({ kind: 'review_extraction' });
  });

  it('Κ6 — succeeded χωρίς δεδομένα (δεν γράφεται ποτέ) ⇒ προβολή προσφοράς, όχι spinner', () => {
    expect(resolveQuoteIntakeView(quote({ extraction: extraction({ status: 'succeeded' }) }), NOW).kind).toBe('quote_detail');
  });
});

describe('resolveQuoteIntakeView — έγγραφα σάρωσης πριν το §6.10 (χωρίς `extraction`)', () => {
  it('Π1 — σημείωση αποτυχίας `[AI scan]` ⇒ failed χωρίς κωδικό', () => {
    const q = quote({ notes: '[AI scan] Σφάλμα ανάλυσης: timeout. Ελέγξτε χειροκίνητα.', createdAt: at(OLD) });
    expect(resolveQuoteIntakeView(q, NOW)).toEqual({ kind: 'failed', errorCode: null });
  });

  it('Π2 — πρόσφατη ⇒ extracting · παλιά ⇒ stalled', () => {
    expect(resolveQuoteIntakeView(quote({ createdAt: at(FRESH) }), NOW).kind).toBe('extracting');
    expect(resolveQuoteIntakeView(quote({ createdAt: at(OLD) }), NOW).kind).toBe('stalled');
  });
});

describe('isQuoteIntakeSettled / isPendingIntake', () => {
  it('Σ1 — το polling σταματά σε κάθε κατάσταση εκτός από extracting', () => {
    expect(isQuoteIntakeSettled(null, NOW)).toBe(false);
    expect(isQuoteIntakeSettled(quote({ extraction: extraction({}) }), NOW)).toBe(false);
    expect(isQuoteIntakeSettled(quote({ extraction: extraction({ status: 'failed', errorCode: 'not_a_quote' }) }), NOW)).toBe(true);
    expect(isQuoteIntakeSettled(quote({ extraction: extraction({ startedAt: at(OLD) as never }) }), NOW)).toBe(true);
    expect(isQuoteIntakeSettled(quote({ extractedData: EXTRACTED }), NOW)).toBe(true);
  });

  it('Σ2 — η κάρτα κατάστασης μόνο σε extracting / stalled / failed', () => {
    expect(isPendingIntake({ kind: 'extracting' })).toBe(true);
    expect(isPendingIntake({ kind: 'stalled' })).toBe(true);
    expect(isPendingIntake({ kind: 'failed', errorCode: null })).toBe(true);
    expect(isPendingIntake({ kind: 'review_extraction' })).toBe(false);
    expect(isPendingIntake({ kind: 'quote_detail' })).toBe(false);
  });
});

describe('quoteHasOriginalDocument', () => {
  it('Ε1 — από τα συνημμένα, όχι από την πηγή', () => {
    const attachment = { id: 'f1' } as unknown as Quote['attachments'][number];
    expect(quoteHasOriginalDocument({ attachments: [] })).toBe(false);
    expect(quoteHasOriginalDocument({ attachments: [attachment] })).toBe(true);
  });
});
