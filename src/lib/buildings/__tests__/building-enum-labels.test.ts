/**
 * ADR-898 §18.2 — **ποτέ ωμή τιμή κατάστασης/κατηγορίας κτιρίου στην οθόνη**.
 *
 * Τι αποδεικνύει: (1) σωστά κλειδιά καταλόγου (`categories.`, όχι `category.`) · (2) ψευδώνυμο άλλου λεξιλογίου
 * (`in_progress`) → κανονική τιμή, στην ετικέτα ΚΑΙ στο σύνορο ανάγνωσης · (3) άγνωστο/κενό ⇒ «Μη ορισμένη», ποτέ
 * ωμό, ποτέ μαντεψιά («Σχεδιασμός» / «Μικτή Χρήση»).
 */

import fs from 'node:fs';
import path from 'node:path';

import type { TFunction } from 'i18next';

import { buildingCategoryLabel, buildingStatusLabel } from '../building-enum-labels';
import { planBuildingStatusBackfill, withCanonicalBuildingStatus } from '../canonical-building-enums';
import { BUILDING_CATEGORIES } from '@/constants/building-categories';
import { BUILDING_STATUSES, parseBuildingStatus } from '@/constants/building-statuses';

const t = ((key: string) => `«${key}»`) as unknown as TFunction;

describe('building enum labels', () => {
  it('κανονικές τιμές ⇒ το κλειδί του καταλόγου', () => {
    expect(buildingStatusLabel(t, 'planning')).toBe('«building:status.planning»');
    expect(buildingCategoryLabel(t, 'mixed')).toBe('«building:categories.mixed»');
  });

  it('`in_progress` (λεξιλόγιο έργου) ⇒ «υπό κατασκευή»', () => {
    expect(parseBuildingStatus('in_progress')).toBe('construction');
    expect(buildingStatusLabel(t, 'in_progress')).toBe('«building:status.construction»');
  });

  it.each([undefined, null, '', 'constructor', 'toString', 42])('άγνωστο %p ⇒ «Μη ορισμένη», ποτέ ωμό', (raw) => {
    expect(parseBuildingStatus(raw)).toBeNull();
    expect(buildingStatusLabel(t, raw)).toBe('«building:status.unknown»');
    expect(buildingCategoryLabel(t, raw)).toBe('«building:categories.unknown»');
  });
});

// Ο παρονομαστής είναι το SSoT και τα ΠΡΑΓΜΑΤΙΚΑ locale — ποτέ fixture (μάθημα ADR-790 §9.1, ίδιο με ADR-806 §7 #2).
describe.each(['el', 'en'])('κάθε τιμή των λεξιλογίων έχει κλειδί στο locale «%s»', (lang) => {
  const bundle = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'src', 'i18n', 'locales', lang, 'building.json'), 'utf8'),
  ) as { status: Record<string, unknown>; categories: Record<string, unknown> };

  it('κατάσταση: όλες οι κανονικές + `unknown`', () => {
    const missing = [...BUILDING_STATUSES, 'unknown'].filter((key) => typeof bundle.status[key] !== 'string');
    expect(missing).toEqual([]);
  });

  it('κατηγορία: όλες οι κανονικές + `unknown`', () => {
    const missing = [...BUILDING_CATEGORIES, 'unknown'].filter((key) => typeof bundle.categories[key] !== 'string');
    expect(missing).toEqual([]);
  });
});

describe('withCanonicalBuildingStatus (σύνορο ανάγνωσης)', () => {
  it('ψευδώνυμο ⇒ κανονική τιμή, τα υπόλοιπα πεδία ανέγγιχτα', () => {
    expect(withCanonicalBuildingStatus({ id: 'b1', status: 'in_progress' })).toEqual({ id: 'b1', status: 'construction' });
  });

  it('συμπλήρωση δίσκου = ο ΙΔΙΟΣ σχεδιαστής: γράφει ΜΟΝΟ ψευδώνυμα, ποτέ κανονικές/άγνωστες/κενές', () => {
    expect(planBuildingStatusBackfill({ status: 'in_progress' })).toEqual({ kind: 'write', updates: { status: 'construction' } });
    expect(planBuildingStatusBackfill({ status: 'planning' })).toEqual({ kind: 'noop' });
    expect(planBuildingStatusBackfill({ status: 'weird' })).toEqual({ kind: 'noop' });
    expect(planBuildingStatusBackfill({})).toEqual({ kind: 'noop' });
  });

  it('κανονική ή άγνωστη ⇒ ΙΔΙΟ αντικείμενο (καμία μαντεψιά, καμία αντιγραφή)', () => {
    const canonical = { status: 'completed' };
    const unknown = { status: 'weird' };
    expect(withCanonicalBuildingStatus(canonical)).toBe(canonical);
    expect(withCanonicalBuildingStatus(unknown)).toBe(unknown);
  });
});
