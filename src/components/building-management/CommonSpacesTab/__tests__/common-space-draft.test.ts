/**
 * ADR-931 — η φόρμα κοινόχρηστου: πρόχειρο → επικύρωση → payload.
 */

import {
  EMPTY_COMMON_SPACE_DRAFT,
  draftFromCommonSpace,
  toCommonSpacePayload,
  validateCommonSpaceDraft,
} from '../common-space-draft';
import { mapCommonSpaceDoc } from '@/lib/common-spaces/common-space-mapper';

const named = { ...EMPTY_COMMON_SPACE_DRAFT, name: 'Πυλωτή', category: 'pilotis' as const };

describe('ADR-931 — validateCommonSpaceDraft', () => {
  it.each([
    ['κενό όνομα', EMPTY_COMMON_SPACE_DRAFT, 'nameRequired'],
    ['εμβαδόν 0', { ...named, area: '0' }, 'areaInvalid'],
    ['εμβαδόν κείμενο', { ...named, area: 'abc' }, 'areaInvalid'],
    ['αποκλειστική χωρίς ιδιοκτησία', { ...named, legalNature: 'exclusive_use' as const }, 'exclusiveRequired'],
  ])('🔴 %s', (_label, draft, expected) => {
    expect(validateCommonSpaceDraft(draft)).toBe(expected);
  });

  it('έγκυρο: κενό εμβαδόν = αδήλωτο, δεκαδικό με κόμμα', () => {
    expect(validateCommonSpaceDraft(named)).toBeNull();
    expect(validateCommonSpaceDraft({ ...named, area: '12,5' })).toBeNull();
  });
});

describe('ADR-931 — toCommonSpacePayload', () => {
  it('κενά ⇒ null, κόμμα ⇒ τελεία, όροφος κενός ⇒ null (όλο το κτίριο)', () => {
    expect(toCommonSpacePayload({ ...named, area: '12,5', code: '  ', notes: '' })).toEqual({
      name: 'Πυλωτή',
      category: 'pilotis',
      legalNature: 'common_use',
      exclusiveUsePropertyIds: [],
      floorId: null,
      area: 12.5,
      code: null,
      notes: null,
    });
  });

  it('κοινής χρήσης ⇒ καμία ιδιοκτησία αποκλειστικής χρήσης στο payload', () => {
    const payload = toCommonSpacePayload({ ...named, exclusiveUsePropertyIds: ['p1'] });
    expect(payload.exclusiveUsePropertyIds).toEqual([]);
  });

  it('round-trip: χώρος → πρόχειρο → payload κρατά τις τιμές', () => {
    const stored = mapCommonSpaceDoc('c1', {
      name: 'Δώμα', buildingId: 'b1', category: 'roof_terrace', legalNature: 'exclusive_use',
      exclusiveUsePropertyIds: ['p7'], floorId: 'f9', area: 80, code: 'Δ-1',
    });
    expect(toCommonSpacePayload(draftFromCommonSpace(stored))).toMatchObject({
      category: 'roof_terrace', legalNature: 'exclusive_use', exclusiveUsePropertyIds: ['p7'], floorId: 'f9', area: 80, code: 'Δ-1',
    });
  });
});
