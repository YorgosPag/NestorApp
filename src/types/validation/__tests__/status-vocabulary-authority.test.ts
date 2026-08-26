/**
 * ΑΓΚΥΡΑ — ADR-812: ο φρουρός εγκυρότητας διαβάζει το SSoT, όχι πίνακα παρουσίασης.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: μέχρι 2026-08-26 το `schemas.ts` έγραφε
 * `Object.keys(CENTRALIZED_PROJECT_STATUSES)` πάνω στο **badge config map** —
 * τα κλειδιά ενός πίνακα ΧΡΩΜΑΤΩΝ γίνονταν κανόνας εγκυρότητας Zod. Οι 29
 * υπάρχουσες άγκυρες του αρχείου έμειναν ΠΡΑΣΙΝΕΣ και πριν και μετά τη
 * διόρθωση, γιατί **καμία τους δεν ρωτούσε τι απορρίπτεται**.
 *
 * ⚠️ Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΟΣ: χωρίς τα «δέχεται», ένα schema που
 * απορρίπτει τα ΠΑΝΤΑ θα έβγαινε εξίσου πράσινο.
 */
import { projectBaseSchema, buildingBaseSchema } from '../schemas';
import { ACTIVE_PROJECT_STATUSES, PROJECT_STATUSES } from '@/constants/project-statuses';
import { ACTIVE_BUILDING_STATUSES, BUILDING_STATUSES } from '@/constants/building-statuses';

const project = (status: string) => ({ name: 'Έργο', location: 'Αθήνα', status });
const building = (status: string) => ({ name: 'Κτίριο', address: 'Οδός 1', category: 'residential', status });

const statusOf = (r: { success: boolean; error?: { issues: Array<{ path: PropertyKey[] }> } }) =>
  r.success ? 'ok' : r.error!.issues.some(i => i.path[0] === 'status') ? 'status-rejected' : 'other-field';

describe('ADR-812 — αυθεντία λεξιλογίου στο Zod', () => {
  // ── ΠΑΡΟΝΟΜΑΣΤΗΣ: κάθε κανονική τιμή ΠΕΡΝΑ ────────────────────────────────
  it.each([...ACTIVE_PROJECT_STATUSES])('έργο: δέχεται «%s»', v => {
    expect(statusOf(projectBaseSchema.safeParse(project(v)))).toBe('ok');
  });

  it.each([...ACTIVE_BUILDING_STATUSES])('κτίριο: δέχεται «%s»', v => {
    expect(statusOf(buildingBaseSchema.safeParse(building(v)))).toBe('ok');
  });

  // ── Ο ΦΡΟΥΡΟΣ: ό,τι δεν ανήκει στο λεξιλόγιο ΑΠΟΡΡΙΠΤΕΤΑΙ ─────────────────
  // `review`/`approved` = άξονας ΕΓΚΡΙΣΗΣ ΠΑΡΑΔΟΤΕΟΥ (ISO 19650 S3/S4/B1 ·
  // Revit revision `Issued` · Figma branch «Approved»), ΠΟΤΕ κατάσταση έργου.
  it.each(['review', 'approved'])('έργο: απορρίπτει «%s» (άλλος άξονας)', v => {
    expect(statusOf(projectBaseSchema.safeParse(project(v)))).toBe('status-rejected');
  });

  // Το soft-delete είναι ΕΝΕΡΓΕΙΑ (ADR-028), όχι επιλογή φόρμας.
  it('έργο: απορρίπτει «deleted» — δεν δημιουργείς εγγραφή στον κάδο', () => {
    expect(PROJECT_STATUSES).toContain('deleted');            // ανήκει στο λεξιλόγιο…
    expect(ACTIVE_PROJECT_STATUSES as readonly string[]).not.toContain('deleted'); // …όχι στη φόρμα
    expect(statusOf(projectBaseSchema.safeParse(project('deleted')))).toBe('status-rejected');
  });

  it('κτίριο: απορρίπτει «deleted», και τα 8 του πίνακα χρωμάτων', () => {
    expect(BUILDING_STATUSES).toContain('deleted');
    for (const v of ['deleted', 'available', 'occupied', 'maintenance', 'for_sale', 'for_rent', 'sold', 'rented']) {
      expect(statusOf(buildingBaseSchema.safeParse(building(v)))).toBe('status-rejected');
    }
  });

  // ── Η ΣΥΖΕΥΞΗ ΕΦΥΓΕ: το schema δεν διαβάζει πια πίνακα παρουσίασης ────────
  it('το λεξιλόγιο του schema ΤΑΥΤΙΖΕΤΑΙ με το SSoT, τιμή προς τιμή', () => {
    const accepted = (s: readonly string[], parse: (v: string) => unknown) =>
      s.filter(v => statusOf(parse(v) as never) === 'ok');
    expect(accepted([...PROJECT_STATUSES], v => projectBaseSchema.safeParse(project(v))))
      .toEqual([...ACTIVE_PROJECT_STATUSES]);
    expect(accepted([...BUILDING_STATUSES], v => buildingBaseSchema.safeParse(building(v))))
      .toEqual([...ACTIVE_BUILDING_STATUSES]);
  });
});
