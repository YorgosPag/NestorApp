/**
 * ADR-931 — σχήματα σώματος κοινόχρηστου + κανόνας νομικής φύσης (ΑΚ 1117).
 */

import {
  CreateCommonSpaceSchema,
  UpdateCommonSpaceSchema,
  mapCommonSpaceExtraFields,
  resolveLegalNature,
  touchesLegalNature,
} from '@/lib/common-spaces/common-space-fields';
import { planSpaceWrite } from '@/lib/api/space-entity-write';
import { isTransferableSpaceKind } from '@/lib/spaces/space-entity-kinds';

const VALID_CREATE = { name: 'Κλιμακοστάσιο Α', buildingId: 'bldg_1', category: 'stairwell' };

describe('Α. ΣΧΗΜΑ ΔΗΜΙΟΥΡΓΙΑΣ', () => {
  it('δέχεται το ελάχιστο έγκυρο σώμα', () => {
    expect(CreateCommonSpaceSchema.safeParse(VALID_CREATE).success).toBe(true);
  });

  it.each([
    ['χωρίς κτίριο', { ...VALID_CREATE, buildingId: undefined }],
    ['κατηγορία εκτός λεξιλογίου', { ...VALID_CREATE, category: 'lounges' }],
    ['κενό όνομα', { ...VALID_CREATE, name: '   ' }],
    ['εμπορική κατάσταση (ΑΚ 1117)', { ...VALID_CREATE, commercialStatus: 'for-sale' }],
    ['τιμή (ΑΚ 1117)', { ...VALID_CREATE, commercial: { askingPrice: 1000 } }],
    ['ελεύθερο `type`', { ...VALID_CREATE, type: 'small' }],
    ['`status` από σώμα', { ...VALID_CREATE, status: 'deleted' }],
  ])('🔴 αρνείται: %s', (_label, body) => {
    expect(CreateCommonSpaceSchema.safeParse(body).success).toBe(false);
  });
});

describe('Β. ΣΧΗΜΑ ΕΝΗΜΕΡΩΣΗΣ', () => {
  it('🔴 αρνείται αποσύνδεση από κτίριο (ο κοινόχρηστος ανήκει ΠΑΝΤΑ σε κτίριο)', () => {
    expect(UpdateCommonSpaceSchema.safeParse({ buildingId: null }).success).toBe(false);
  });

  it('🔴 αρνείται εμπορικά πεδία', () => {
    expect(UpdateCommonSpaceSchema.safeParse({ commercialStatus: 'for-rent' }).success).toBe(false);
  });

  it('η κατηγορία γράφεται από τα ειδικά πεδία· τίποτα όταν απουσιάζει', () => {
    expect(mapCommonSpaceExtraFields({ category: 'pilotis' })).toEqual({ category: 'pilotis' });
    expect(mapCommonSpaceExtraFields({})).toEqual({});
  });
});

describe('Γ. ΝΟΜΙΚΗ ΦΥΣΗ', () => {
  it('προεπιλογή = κοινής χρήσης, χωρίς ιδιοκτησίες', () => {
    expect(resolveLegalNature({})).toEqual({ kind: 'ok', legalNature: 'common_use', exclusiveUsePropertyIds: [] });
  });

  it('🔴 αποκλειστική χρήση χωρίς ιδιοκτησία ⇒ άρνηση', () => {
    expect(resolveLegalNature({ legalNature: 'exclusive_use' })).toEqual({
      kind: 'rejected', reason: 'exclusive-use-without-properties',
    });
  });

  it('αποκλειστική χρήση: διπλότυπα αφαιρούνται', () => {
    expect(resolveLegalNature({ legalNature: 'exclusive_use', exclusiveUsePropertyIds: ['p1', 'p1', 'p2'] }))
      .toEqual({ kind: 'ok', legalNature: 'exclusive_use', exclusiveUsePropertyIds: ['p1', 'p2'] });
  });

  it('αλλαγή σε κοινής χρήσης ΣΒΗΝΕΙ την αποκλειστικότητα (καμία ορφανή λίστα)', () => {
    const existing = { legalNature: 'exclusive_use', exclusiveUsePropertyIds: ['p1'] };
    expect(resolveLegalNature({ legalNature: 'common_use' }, existing))
      .toEqual({ kind: 'ok', legalNature: 'common_use', exclusiveUsePropertyIds: [] });
  });

  it('μόνο ιδιοκτησίες στο σώμα ⇒ η φύση διαβάζεται από το αποθηκευμένο', () => {
    const existing = { legalNature: 'exclusive_use', exclusiveUsePropertyIds: ['p1'] };
    expect(resolveLegalNature({ exclusiveUsePropertyIds: ['p9'] }, existing))
      .toEqual({ kind: 'ok', legalNature: 'exclusive_use', exclusiveUsePropertyIds: ['p9'] });
  });

  it('touchesLegalNature: μόνο όταν το σώμα αγγίζει φύση ή ιδιοκτησίες', () => {
    expect(touchesLegalNature({ name: 'x' })).toBe(false);
    expect(touchesLegalNature({ exclusiveUsePropertyIds: [] })).toBe(true);
  });
});

describe('Δ. PIPELINE ΧΩΡΟΥ — ο κοινόχρηστος ΔΕΝ μεταβιβάζεται (ΑΚ 1117)', () => {
  it('το είδος δηλώνεται μη μεταβιβάσιμο· θέση/αποθήκη μεταβιβάσιμα', () => {
    expect(isTransferableSpaceKind('common_space')).toBe(false);
    expect(isTransferableSpaceKind('storage')).toBe(true);
    expect(isTransferableSpaceKind('parking')).toBe(true);
  });

  it('🔴 ζώνη και τιράντες: εμπορικά που ξέφυγαν από το zod ΔΕΝ γράφονται', () => {
    const cfg = { entityKind: 'common_space' as const, displayField: 'name' as const, mapExtraFields: () => ({}) };
    const plan = planSpaceWrite(cfg, { area: 12, commercialStatus: 'for-sale' }, {});
    expect(plan).toEqual({ kind: 'write', updateData: { area: 12 } });
  });
});
