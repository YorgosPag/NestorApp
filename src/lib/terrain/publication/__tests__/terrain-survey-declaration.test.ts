/**
 * ADR-920 Δ2 — the declaration that travels with the survey source: answered, never assumed.
 */

import {
  decodeTerrainSurveyDeclaration,
  encodeTerrainSurveyDeclaration,
  isSurveyDateInFuture,
  readTerrainSurveyDeclaration,
} from '../terrain-survey-declaration';
import { LISTING_TERRAIN_SURVEYOR_NAME_MAX } from '../listing-terrain-config';

const VALID = { surveyorName: '  Τοπογράφος Α. Παπαδόπουλος ', surveyedOn: '2026-03-14', rightsAffirmed: true };

describe('ADR-920 Δ2 — reading the declaration', () => {
  it('accepts a complete declaration and trims the name', () => {
    expect(readTerrainSurveyDeclaration(VALID)).toStrictEqual({
      surveyorName: 'Τοπογράφος Α. Παπαδόπουλος',
      surveyedOn: '2026-03-14',
      rightsAffirmed: true,
    });
  });

  it.each([
    ['rights not affirmed', { ...VALID, rightsAffirmed: false }],
    ['rights as a truthy string', { ...VALID, rightsAffirmed: 'true' }],
    ['rights missing', { surveyorName: VALID.surveyorName, surveyedOn: VALID.surveyedOn }],
    ['a blank surveyor', { ...VALID, surveyorName: '   ' }],
    ['an over-long surveyor', { ...VALID, surveyorName: 'x'.repeat(LISTING_TERRAIN_SURVEYOR_NAME_MAX + 1) }],
    ['a date that is not a day', { ...VALID, surveyedOn: '2026-02-30' }],
    ['a date in another format', { ...VALID, surveyedOn: '14/03/2026' }],
  ])('refuses %s', (_label, value) => {
    expect(readTerrainSurveyDeclaration(value)).toBeNull();
  });

  it('decodes only valid JSON strings', () => {
    expect(decodeTerrainSurveyDeclaration(JSON.stringify(VALID))).not.toBeNull();
    expect(decodeTerrainSurveyDeclaration('{not json')).toBeNull();
    expect(decodeTerrainSurveyDeclaration('')).toBeNull();
    expect(decodeTerrainSurveyDeclaration(null)).toBeNull();
  });

  it('round-trips through its one encoding, without extra fields', () => {
    const declaration = readTerrainSurveyDeclaration({ ...VALID, smuggled: 1 })!;
    const encoded = encodeTerrainSurveyDeclaration(declaration);
    expect(encoded).not.toContain('smuggled');
    expect(decodeTerrainSurveyDeclaration(encoded)).toStrictEqual(declaration);
  });
});

describe('ADR-920 Δ2 — a survey cannot be dated after today, anywhere on Earth', () => {
  const declaration = readTerrainSurveyDeclaration(VALID)!;
  const on = (surveyedOn: string) => ({ ...declaration, surveyedOn });

  it('today in Athens is accepted even while the server (UTC) is still on yesterday', () => {
    // 2026-03-14 23:30 UTC = 2026-03-15 01:30 Athens.
    expect(isSurveyDateInFuture(on('2026-03-15'), new Date('2026-03-14T23:30:00Z'))).toBe(false);
  });

  it('a date past every time zone is refused', () => {
    expect(isSurveyDateInFuture(on('2026-03-16'), new Date('2026-03-14T23:30:00Z'))).toBe(true);
  });

  it('a past survey is accepted', () => {
    expect(isSurveyDateInFuture(on('2019-06-01'), new Date('2026-03-14T12:00:00Z'))).toBe(false);
  });
});
