/**
 * @fileoverview prepayment-policy — η μειωμένη προκαταβολή υπολογίζεται από την ΕΝΑΡΞΗ, ανά νομική φύση
 * @description Φυσικό πρόσωπο: μισή ΜΟΝΟ το έτος έναρξης (ν.4172/2013 άρθρο 69 §1).
 *   Νομικό πρόσωπο/οντότητα: μισή τα 3 πρώτα έτη, όχι από μετατροπή/συγχώνευση (άρθρο 71 §3).
 *   Χωρίς έναρξη: πλήρης — ποτέ μικρότερη υποχρέωση από την πραγματική.
 * @see ADR-ACC-023 §1 · ADR-ACC-024 §6.1 α
 */

import { resolvePrepayment } from '../prepayment-policy';
import type { BusinessStart } from '../../../types/company';

const started = (date: string, origin: BusinessStart['origin'] = 'new'): BusinessStart => ({ date, origin });

describe('resolvePrepayment — φυσικό πρόσωπο (ατομική, 55%)', () => {
  it('μισή (27,5%) το έτος έναρξης', () => {
    expect(resolvePrepayment('sole_proprietor', 2025, started('2025-06-01'))).toEqual({
      rate: 27.5,
      baseRate: 55,
      rule: 'natural_person_first_year',
      reason: 'reduced',
      windowYears: 1,
      startYear: 2025,
      yearSinceStart: 1,
    });
  });

  it.each([2026, 2027, 2029])('πλήρης (55%%) το %i — η μείωση ΔΕΝ κρατά πέντε έτη', (fiscalYear) => {
    const basis = resolvePrepayment('sole_proprietor', fiscalYear, started('2025-06-01'));
    expect(basis.rate).toBe(55);
    expect(basis.reason).toBe('outside_window');
  });

  it('πλήρης όταν υπήρχε ήδη επιχειρηματικό εισόδημα (continuation)', () => {
    const basis = resolvePrepayment('sole_proprietor', 2025, started('2025-06-01', 'continuation'));
    expect(basis.rate).toBe(55);
    expect(basis.reason).toBe('continuation');
  });

  it('πλήρης χωρίς δηλωμένη έναρξη', () => {
    const basis = resolvePrepayment('sole_proprietor', 2025, null);
    expect(basis).toEqual(expect.objectContaining({ rate: 55, reason: 'missing_start', startYear: null, yearSinceStart: null }));
  });
});

describe('resolvePrepayment — νομικό πρόσωπο/οντότητα (ΟΕ/ΕΠΕ/ΑΕ, 80%)', () => {
  it.each(['oe', 'epe', 'ae'] as const)('%s: μισή (40%%) τα 3 πρώτα έτη, πλήρης (80%%) από το 4ο', (entityType) => {
    const start = started('2023-11-20');
    expect([2023, 2024, 2025, 2026].map((y) => resolvePrepayment(entityType, y, start).rate)).toEqual([40, 40, 40, 80]);
    expect(resolvePrepayment(entityType, 2025, start)).toEqual(
      expect.objectContaining({ rule: 'legal_entity_first_three_years', windowYears: 3, yearSinceStart: 3 })
    );
  });

  it('ΟΕ: βασικός συντελεστής 80% — όχι το 55% των φυσικών προσώπων', () => {
    expect(resolvePrepayment('oe', 2030, started('2020-01-01')).rate).toBe(80);
  });

  it('πλήρης για εταιρεία από μετατροπή/συγχώνευση, ακόμη και το έτος έναρξης', () => {
    const basis = resolvePrepayment('epe', 2025, started('2025-01-01', 'continuation'));
    expect(basis.rate).toBe(80);
    expect(basis.reason).toBe('continuation');
  });

  it('πλήρης για έτος ΠΡΙΝ από την έναρξη', () => {
    const basis = resolvePrepayment('ae', 2024, started('2025-03-01'));
    expect(basis).toEqual(expect.objectContaining({ rate: 80, reason: 'outside_window', yearSinceStart: null }));
  });

  it('ανύπαρκτη ημέρα έναρξης διαβάζεται ως «δεν δηλώθηκε» ⇒ πλήρης', () => {
    const basis = resolvePrepayment('oe', 2025, started('2025-02-30'));
    expect(basis).toEqual(expect.objectContaining({ rate: 80, reason: 'missing_start', startYear: null }));
  });
});
