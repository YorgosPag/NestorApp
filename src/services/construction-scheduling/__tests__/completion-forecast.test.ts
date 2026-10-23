/**
 * Άγκυρες — **Η ΠΡΟΒΛΕΨΗ ΟΛΟΚΛΗΡΩΣΗΣ** (ADR-919 βήμα 2 · ADR-777 §8.99.4 Δ1).
 *
 * Ο κανόνας είναι της ημερομηνίας κατάστασης (P6 / MS Project): ό,τι δεν τελείωσε δεν μπορεί
 * να τελειώσει πριν από σήμερα. Αν αυτές οι άγκυρες γίνουν πράσινες με το σχέδιο αντί για
 * την πρόβλεψη, η εταιρεία δεν θα δει ποτέ ότι η υπόσχεσή της έχει ήδη χαθεί.
 */

import type { ConstructionPhase, ConstructionTask } from '@/types/building/construction';
import { computeCPM } from '../cpm-calculator';
import { forecastCompletion } from '../completion-forecast';
import { addDaysUtc, toIsoDay } from '../schedule-dates';

const TODAY = '2026-10-23';

function phase(id: string, fields: Partial<ConstructionPhase> = {}): ConstructionPhase {
  return {
    id,
    buildingId: 'bldg_1',
    companyId: 'comp_1',
    name: id,
    code: id.toUpperCase(),
    order: 1,
    status: 'planning',
    plannedStartDate: '2026-09-08',
    plannedEndDate: '2026-12-23',
    progress: 0,
    ...fields,
  };
}

function task(id: string, phaseId: string, fields: Partial<ConstructionTask> = {}): ConstructionTask {
  return {
    id,
    phaseId,
    buildingId: 'bldg_1',
    companyId: 'comp_1',
    name: id,
    code: id.toUpperCase(),
    order: 1,
    status: 'notStarted',
    plannedStartDate: '2026-11-01',
    plannedEndDate: '2026-11-11',
    progress: 0,
    ...fields,
  };
}

describe('Φ — φάσεις χωρίς εργασίες (η σημερινή βάση: 1 φάση, 0 εργασίες)', () => {
  it('🔴 η πραγματική φάση της βάσης: δεν ξεκίνησε, άρα 23/10 + 106 ημέρες = 2027-02-06, ΟΧΙ 23/12', () => {
    const result = forecastCompletion([phase('ph_1')], [], TODAY);
    expect(result).toEqual({
      kind: 'forecast',
      finish: '2027-02-06',
      plannedFinish: '2026-12-23',
      slipDays: 45,
      basis: 'phases',
      isLowerBound: false,
    });
  });

  it('φάση που δεν ξεκίνησε και αρχίζει στο μέλλον: ακολουθεί το σχέδιο', () => {
    const later = phase('ph_1', { plannedStartDate: '2027-01-10', plannedEndDate: '2027-03-10' });
    expect(forecastCompletion([later], [], TODAY)).toMatchObject({ finish: '2027-03-10', slipDays: 0 });
  });

  it('σε εξέλιξη και μπροστά από το σχέδιο (80%): τελειώνει νωρίτερα', () => {
    const ahead = phase('ph_1', { status: 'inProgress', progress: 80, actualStartDate: '2026-09-08' });
    // 106 × 0,2 = 21,2 → 22 ημέρες από σήμερα.
    expect(forecastCompletion([ahead], [], TODAY)).toMatchObject({ finish: '2026-11-14', slipDays: -39 });
  });

  it('`blocked` → η ημερομηνία είναι το νωρίτερο δυνατό (`isLowerBound`)', () => {
    const blocked = phase('ph_1', { status: 'blocked', progress: 40 });
    expect(forecastCompletion([blocked], [], TODAY)).toMatchObject({ kind: 'forecast', isLowerBound: true });
  });

  it('οι φάσεις ΔΕΝ δένονται σειριακά με το `order`: κρίνεται η καθεμία μόνη της', () => {
    const early = phase('ph_1', { order: 1 });
    const overlapping = phase('ph_2', { order: 2, plannedStartDate: '2027-01-01', plannedEndDate: '2027-01-31' });
    // Αν η ph_2 περίμενε την ph_1 (2027-02-06), θα έληγε 2027-03-08.
    expect(forecastCompletion([early, overlapping], [], TODAY)).toMatchObject({ finish: '2027-02-06' });
  });
});

describe('Ο — ολοκληρωμένα και κενά', () => {
  it('όλες ολοκληρωμένες → `completed` με το τελευταίο πραγματικό τέλος', () => {
    const done = [
      phase('ph_1', { status: 'completed', progress: 100, actualEndDate: '2026-10-01' }),
      phase('ph_2', { status: 'completed', progress: 100, actualEndDate: '2026-10-15' }),
    ];
    expect(forecastCompletion(done, [], TODAY)).toEqual({ kind: 'completed', completedOn: '2026-10-15' });
  });

  it('καμία φάση → `no-schedule`', () => {
    expect(forecastCompletion([], [], TODAY)).toEqual({ kind: 'no-schedule' });
  });

  it('άκυρη ημερομηνία → `unreliable`, ποτέ ψεύτικη ημερομηνία', () => {
    expect(forecastCompletion([phase('ph_1', { plannedEndDate: '' })], [], TODAY)).toEqual({
      kind: 'unreliable',
      reason: 'invalid-dates',
    });
    expect(forecastCompletion([phase('ph_1')], [], 'σήμερα')).toMatchObject({ kind: 'unreliable' });
  });
});

describe('Ε — εργασίες μέσα από το CPM', () => {
  it('🔑 εργασία που δεν ξεκίνησε σπρώχνεται από καθυστερημένο προκάτοχο', () => {
    const tasks = [
      task('t1', 'ph_1', { status: 'delayed', progress: 50, plannedStartDate: '2026-10-01', plannedEndDate: '2026-10-21' }),
      task('t2', 'ph_1', { dependencies: ['t1'], plannedStartDate: '2026-10-21', plannedEndDate: '2026-10-31' }),
    ];
    // t1: 20 ημέρες, 50% → 10 από σήμερα = 2026-11-02. t2: από 2026-11-02 + 10 = 2026-11-12.
    expect(forecastCompletion([phase('ph_1')], tasks, TODAY)).toMatchObject({
      finish: '2026-11-12',
      basis: 'tasks',
    });
  });

  it('φάσεις με και χωρίς εργασίες → `mixed`, κρατιέται το μέγιστο', () => {
    const phases = [phase('ph_1'), phase('ph_2', { plannedStartDate: '2027-01-01', plannedEndDate: '2027-01-31' })];
    const result = forecastCompletion(phases, [task('t1', 'ph_1')], TODAY);
    expect(result).toMatchObject({ basis: 'mixed', finish: '2027-01-31' });
  });

  it('κυκλική εξάρτηση → `unreliable`', () => {
    const tasks = [task('t1', 'ph_1', { dependencies: ['t2'] }), task('t2', 'ph_1', { dependencies: ['t1'] })];
    expect(forecastCompletion([phase('ph_1')], tasks, TODAY)).toEqual({
      kind: 'unreliable',
      reason: 'cyclic-dependencies',
    });
  });

  it('εργασία άλλου κτιρίου (άγνωστη φάση) αγνοείται', () => {
    const result = forecastCompletion([phase('ph_1')], [task('t1', 'ph_other', { plannedEndDate: '2030-01-01' })], TODAY);
    expect(result).toMatchObject({ finish: '2027-02-06', basis: 'phases' });
  });

  it('🔴 χωρίς `statusDate` το CPM μένει ΤΟ ΣΧΕΔΙΟ (η οθόνη Gantt δεν αλλάζει)', () => {
    const late = task('t1', 'ph_1', { plannedStartDate: '2026-09-01', plannedEndDate: '2026-09-11' });
    expect(computeCPM([late], [phase('ph_1')]).projectEarlyFinish).toBe('2026-09-11');
    expect(computeCPM([late], [phase('ph_1')], { statusDate: TODAY }).projectEarlyFinish).toBe('2026-11-02');
  });
});

describe('Ω — η αλλαγή ώρας δεν τρώει μέρα', () => {
  it('πρόσθεση που περνά την αλλαγή ώρας του Μαρτίου (UTC, όχι τοπική ώρα)', () => {
    expect(toIsoDay(addDaysUtc(new Date('2027-03-20'), 10))).toBe('2027-03-30');
    expect(toIsoDay(addDaysUtc(new Date('2027-10-25'), 10))).toBe('2027-11-04');
  });
});
