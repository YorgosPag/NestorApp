/**
 * ΑΓΚΥΡΕΣ — σχέδιο · πρόβλεψη · υπόσχεση (ADR-919 §11, P6 «Must Finish By»).
 */

import { scheduledAvailability } from '@/lib/listings/availability-window';
import type { ScheduledAvailability } from '@/types/availability-history';

import type { CompletionForecast } from '../completion-forecast';
import { checkCompletionPromise, type CompletionPromiseInputs } from '../completion-promise-check';

const Q3_2027 = scheduledAvailability('quarter', '2027-08-01') as ScheduledAvailability; // λήγει 2027-09-30

function forecast(finish: string, isLowerBound = false): CompletionForecast {
  return { kind: 'forecast', finish, plannedFinish: '2027-06-30', slipDays: 0, basis: 'phases', isLowerBound };
}

function inputs(overrides: Partial<CompletionPromiseInputs>): CompletionPromiseInputs {
  return { promise: Q3_2027, forecast: forecast('2027-06-01'), plannedCompletion: null, delivered: false, today: '2026-10-23', ...overrides };
}

const kinds = (overrides: Partial<CompletionPromiseInputs>) => checkCompletionPromise(inputs(overrides)).signals.map((s) => s.kind);

describe('Α — αρνητικό περιθώριο: η πρόβλεψη μετά την υπόσχεση', () => {
  it('Α1 — πρόβλεψη 2027-11-15 > 2027-09-30 ⇒ «ξεπερνά κατά 46 ημέρες» + πρόταση διόρθωσης (Δ΄ τρίμηνο)', () => {
    const check = checkCompletionPromise(inputs({ forecast: forecast('2027-11-15') }));
    expect(check.signals).toEqual([{ kind: 'forecast-beyond-promise', forecastFinish: '2027-11-15', daysBeyond: 46, isLowerBound: false }]);
    expect(check.proposal).toEqual({ precision: 'quarter', anchor: '2027-11-15' });
  });

  it('Α2 — κρίνεται το ΤΕΛΟΣ του διαστήματος (Δ2): πρόβλεψη 30/9 μέσα στο Γ΄ τρίμηνο δεν είναι παραβίαση', () => {
    expect(kinds({ forecast: forecast('2027-09-30') })).not.toContain('forecast-beyond-promise');
  });

  it('Α3 — κάτω όριο (μπλοκαρισμένη φάση) περνά ως σήμα «τουλάχιστον»', () => {
    const [signal] = checkCompletionPromise(inputs({ forecast: forecast('2027-12-01', true) })).signals;
    expect(signal).toMatchObject({ kind: 'forecast-beyond-promise', isLowerBound: true });
  });
});

describe('Κ — σε κίνδυνο πριν την παραβίαση (κατώφλι SmartPM 7,5%)', () => {
  it('Κ1 — περιθώριο 10 ημερών σε ορίζοντα 342 ημερών ⇒ «σε κίνδυνο», χωρίς πρόταση (η υπόσχεση ακόμη ισχύει)', () => {
    const check = checkCompletionPromise(inputs({ forecast: forecast('2027-09-20') }));
    expect(check.signals).toEqual([{ kind: 'at-risk', forecastFinish: '2027-09-20', marginDays: 10 }]);
    expect(check.proposal).toBeNull();
  });

  it('Κ2 — άνετο περιθώριο ⇒ σιωπή', () => {
    expect(kinds({ forecast: forecast('2027-03-01') })).toEqual([]);
  });
});

describe('Λ — ληγμένη υπόσχεση (ο επιλυτής δεν διαβάζει ρολόι, η κρίση ζει εδώ)', () => {
  it('Λ1 — σήμερα μετά το τέλος, χωρίς παράδοση ⇒ «έληξε πριν από N ημέρες»', () => {
    const check = checkCompletionPromise(inputs({ today: '2027-10-10', forecast: { kind: 'no-schedule' } }));
    expect(check.signals).toEqual([{ kind: 'expired', promisedEnd: '2027-09-30', daysAgo: 10 }]);
  });

  it('Λ2 — παραδομένο κτίριο ⇒ καμία κρίση υπόσχεσης, καμία πρόταση', () => {
    const check = checkCompletionPromise(inputs({ today: '2027-10-10', delivered: true, forecast: forecast('2027-12-01') }));
    expect(check).toEqual({ proposal: null, proposalIsLowerBound: false, signals: [] });
  });
});

describe('Σ — το σχέδιο και η αναξιόπιστη πρόβλεψη', () => {
  it('Σ1 — το ίδιο το σχέδιο τελειώνει μετά την υπόσχεση ⇒ ονομάζεται (δεκτό και ISO με ώρα)', () => {
    expect(kinds({ plannedCompletion: '2027-10-05T00:00:00.000Z' })).toEqual(['plan-beyond-promise']);
  });

  it('Σ2 — αναξιόπιστη πρόβλεψη ⇒ σήμα, ποτέ ψεύτικη ημερομηνία ή πρόταση', () => {
    const check = checkCompletionPromise(inputs({ promise: null, forecast: { kind: 'unreliable', reason: 'cyclic-dependencies' } }));
    expect(check).toEqual({ proposal: null, proposalIsLowerBound: false, signals: [{ kind: 'forecast-unreliable', reason: 'cyclic-dependencies' }] });
  });

  it('Σ3 — χωρίς υπόσχεση ⇒ το χρονοδιάγραμμα ΠΡΟΤΕΙΝΕΙ (Δ1), χωρίς σήματα', () => {
    const check = checkCompletionPromise(inputs({ promise: null, forecast: forecast('2027-02-06') }));
    expect(check).toEqual({ proposal: { precision: 'quarter', anchor: '2027-02-06' }, proposalIsLowerBound: false, signals: [] });
  });
});
