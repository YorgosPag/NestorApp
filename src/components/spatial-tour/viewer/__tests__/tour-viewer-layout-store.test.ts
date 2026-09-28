/**
 * ADR-884 Φ2στ-γ Γ2 · §4.14 σημείο 3 — το αποθηκευμένο πλάτος της στήλης: px, μέσα στα όρια, αλλοιωμένο ⇒ προεπιλογή.
 */

import { STORAGE_KEYS } from '@/lib/storage';

import { TOUR_PLAN_COLUMN, parseTourPlanColumn, readTourPlanColumn, writeTourPlanColumn } from '../tour-viewer-layout-store';

const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEYS.TOUR_PLAN_COLUMN) ?? 'null');

beforeEach(() => localStorage.clear());

describe('tour-viewer-layout-store', () => {
  it('τίποτα αποθηκευμένο ⇒ προεπιλογή, ορατή', () => {
    expect(readTourPlanColumn()).toEqual({ width: TOUR_PLAN_COLUMN.widthDefault, collapsed: false });
  });

  it('αλλοιωμένη ή ξένη τιμή ⇒ προεπιλογή· εκτός ορίων ⇒ κόβεται', () => {
    expect(parseTourPlanColumn('χάλια')).toEqual({ width: TOUR_PLAN_COLUMN.widthDefault, collapsed: false });
    expect(parseTourPlanColumn({ width: Number.NaN, collapsed: 'yes' })).toEqual({ width: TOUR_PLAN_COLUMN.widthDefault, collapsed: false });
    expect(parseTourPlanColumn({ width: 5000 }).width).toBe(TOUR_PLAN_COLUMN.widthMax);
    expect(parseTourPlanColumn({ width: 10 }).width).toBe(TOUR_PLAN_COLUMN.widthMin);
    localStorage.setItem(STORAGE_KEYS.TOUR_PLAN_COLUMN, '{σπασμένο');
    expect(readTourPlanColumn().width).toBe(TOUR_PLAN_COLUMN.widthDefault);
  });

  it('γράφει ό,τι μέτρησε το DOM, στρογγυλεμένο', () => {
    expect(writeTourPlanColumn(456.6)).toEqual({ width: 457, collapsed: false });
    expect(stored()).toEqual({ width: 457, collapsed: false });
  });

  it('0 px = συμπτυγμένη ⇒ θυμάται το ΠΡΟΗΓΟΥΜΕΝΟ πλάτος, για να επιστρέψει εκεί', () => {
    writeTourPlanColumn(500);
    expect(writeTourPlanColumn(0)).toEqual({ width: 500, collapsed: true });
    expect(readTourPlanColumn()).toEqual({ width: 500, collapsed: true });
  });

  it('ίδια τιμή ⇒ καμία εγγραφή', () => {
    writeTourPlanColumn(400);
    const spy = jest.spyOn(Storage.prototype, 'setItem');
    writeTourPlanColumn(400);
    expect(spy.mock.calls.filter(([key]) => key === STORAGE_KEYS.TOUR_PLAN_COLUMN)).toHaveLength(0);
    spy.mockRestore();
  });
});
