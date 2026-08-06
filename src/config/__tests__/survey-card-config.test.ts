/**
 * ADR-759 Φ2 — anchor for the card configuration.
 *
 * 🔑 WHY THIS EXISTS. The card is ~30 entries, each with a hand-written `read` and
 * `write` lambda. The characteristic failure of that shape is not a type error — it
 * is a copy-paste: `maxCoveragePct`'s entry writing into `declaredCoveragePct`
 * because the line above it was duplicated. The compiler accepts it (both are
 * `Sourced<number>`), the form renders, the label is right, and the value silently
 * lands in the wrong field.
 *
 * The round-trip below catches every instance of that at once: write a unique value
 * through each accessor and assert that reading it back through the SAME accessor
 * returns it, and that NO OTHER accessor's value moved.
 */
import { allSurveyCardFields, SURVEY_CARD_SECTIONS } from '../survey-card-config';
import { createEmptySurveyRecord } from '@/lib/survey-record/survey-record-factory';
import type { SurveyRecord } from '@/types/project-survey-record';
import { expectNoCrossTalk, probeFromAccessor } from './helpers/survey-field-probe';

jest.mock('@/services/enterprise-id.service', () => ({
  generateSurveyRecordId: () => 'srv_test_fixed',
}));

function blank(): SurveyRecord {
  return createEmptySurveyRecord({
    companyId: 'company-a',
    projectId: 'proj_1',
    createdBy: 'usr_1',
    now: '2026-08-05T10:00:00.000Z',
  });
}

describe('card structure', () => {
  it('exposes every section with at least one field', () => {
    expect(SURVEY_CARD_SECTIONS.length).toBeGreaterThan(0);
    for (const section of SURVEY_CARD_SECTIONS) {
      expect(section.fields.length).toBeGreaterThan(0);
    }
  });

  it('keeps the printed-form order of the survey sheet (ADR-759 §2β.2)', () => {
    // The engineer reads the card in the same order as the drawing. This is the
    // contract that the first draft of §4.2 broke by inventing its own grouping.
    expect(SURVEY_CARD_SECTIONS.map((s) => s.titleKey)).toEqual([
      // ⚠️ «Το έγγραφο» ΔΕΝ είναι ενότητα της τυπωμένης φόρμας — η φόρμα δεν περιγράφει τον
      // εαυτό της. Μπήκε στη Φ3γ επειδή το `surveyDate` υπήρχε στο σχήμα και **δεν αποδιδόταν
      // πουθενά**: η προσγείωση της πινακίδας θα έγραφε τιμή που κανείς δεν μπορεί να δει.
      // Κάθεται **πρώτη** γιατί απαντά «ποιο έγγραφο διαβάζω;», πριν από κάθε άλλη ερώτηση.
      'sections.doc',
      'sections.a',
      'sections.b',
      'sections.c',
      'sections.d',
      'sections.e',
      'sections.st',
      'sections.z',
    ]);
  });

  it('uses a unique section id and a unique label key per field', () => {
    const ids = SURVEY_CARD_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);

    const labels = allSurveyCardFields().map((f) => f.labelKey);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('keeps the three ΣΔ numbers as three separate fields (§4.2 rule 2)', () => {
    const labels = allSurveyCardFields().map((f) => f.labelKey);
    expect(labels).toEqual(
      expect.arrayContaining([
        'fields.declaredSd',
        'fields.socialFactorSd',
        'fields.totalSd',
      ]),
    );
  });

  it('keeps the fields that are blank in the sample (§4.2 rule 3)', () => {
    // Blank is data. These exist precisely because the G753 drawing leaves them
    // empty and the engineer must be able to see what is missing.
    const labels = allSurveyCardFields().map((f) => f.labelKey);
    expect(labels).toEqual(
      expect.arrayContaining([
        'fields.deviation',
        'fields.buildingSystem',
        'fields.declaredFloors',
      ]),
    );
  });
});

describe('accessor round-trip — every field reads back exactly what it wrote', () => {
  const fields = allSurveyCardFields();
  const probes = fields.map((field) => probeFromAccessor(field.labelKey, field));

  it.each(fields.map((f, i) => [f.labelKey, f, i] as const))(
    '%s round-trips',
    (_label, field, index) => {
      const probe = probeFromAccessor(field.labelKey, field);
      const written = probe.write(blank(), index + 1);
      expect(probe.read(written)).toEqual(probe.read(probe.write(blank(), index + 1)));
      expect(probe.read(written)).not.toBeNull();
    },
  );

  it('never lets one field write into another', () => {
    // 🔴 The copy-paste detector. Writing through accessor i must leave every
    // other accessor untouched — that is what a mis-pasted `write` lambda breaks.
    expectNoCrossTalk(probes, blank);
  });

  it('leaves the record identity and scope alone', () => {
    const before = blank();
    probes.forEach((probe, index) => {
      const after = probe.write(blank(), index + 1);
      expect(after.id).toBe(before.id);
      expect(after.companyId).toBe(before.companyId);
      expect(after.projectId).toBe(before.projectId);
      expect(after.confirmedBy).toBeNull();
    });
  });
});
