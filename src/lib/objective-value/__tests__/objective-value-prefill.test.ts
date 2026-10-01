/**
 * ADR-898 Φ3 — η αγγελία ανοίγει τον υπολογιστή συμπληρωμένο: ΜΙΑ δήλωση παραμέτρων, και αυστηρή ανάγνωση
 * (μια τιμή που δεν περνά τον έλεγχο αγνοείται — ο άνθρωπος θα ρωτηθεί, ποτέ δεν «διορθώνεται»).
 */

import { parseObjectiveValuePrefill, serializeObjectiveValuePrefill, type ObjectiveValuePrefill } from '../objective-value-prefill';

const FULL: ObjectiveValuePrefill = {
  point: { lat: 37.9805, lng: 23.7355 },
  form: 'residence',
  floor: 3,
  area: 92.5,
  hasCentralHeating: false,
  hasElevator: true,
  frontage: null,
  permitDate: null,
  areaIncludesCommon: null,
};

describe('objective-value prefill', () => {
  it('γραφή → ανάγνωση: ό,τι ξέρει η αγγελία φτάνει αυτούσιο στο πρόχειρο', () => {
    expect(parseObjectiveValuePrefill(serializeObjectiveValuePrefill(FULL))).toEqual({
      point: { lat: 37.9805, lng: 23.7355 },
      draft: { form: 'residence', levels: [{ floor: 3, area: 92.5 }], hasCentralHeating: false, hasElevator: true },
    });
  });

  it('άγνωστα της αγγελίας ⇒ ΔΕΝ γράφονται, και η ανάγνωση δεν τα εφευρίσκει', () => {
    const query = serializeObjectiveValuePrefill({ ...FULL, point: null, floor: null, hasCentralHeating: null, hasElevator: null });
    expect(query).toBe('form=residence&area=92.5');
    expect(parseObjectiveValuePrefill(query)).toEqual({
      point: null,
      draft: { form: 'residence', levels: [{ floor: null, area: 92.5 }] },
    });
  });

  it('αποθήκη ⇒ επιφάνεια στο `area`, όχι επίπεδα', () => {
    expect(parseObjectiveValuePrefill('form=storage&area=12')?.draft).toEqual({ form: 'storage', area: 12 });
  });

  it('χωρίς έγκυρο είδος ⇒ καμία προσυμπλήρωση', () => {
    expect(parseObjectiveValuePrefill('')).toBeNull();
    expect(parseObjectiveValuePrefill('form=shop&area=50')).toBeNull();
  });

  it.each([
    ['lat=95&lng=23&form=residence', { point: null }],
    ['lat=abc&lng=23&form=residence', { point: null }],
    ['form=residence&floor=2.5&area=-3', { draft: { form: 'residence', levels: [{ floor: null, area: null }] } }],
    ['form=residence&heating=yes&elevator=2', { draft: { form: 'residence', levels: [{ floor: null, area: null }] } }],
  ])('άκυρη τιμή αγνοείται: %s', (query, expected) => {
    expect(parseObjectiveValuePrefill(query)).toMatchObject(expected);
  });

  it('ADR-898 Φ3β — οι δηλώσεις του αγγελιοδότη φτάνουν στο πρόχειρο: πρόσοψη · ημερομηνία άδειας · κοινόχρηστοι', () => {
    const query = serializeObjectiveValuePrefill({ ...FULL, frontage: 'multiple', permitDate: '1998-03-15', areaIncludesCommon: true });
    expect(parseObjectiveValuePrefill(query)?.draft).toMatchObject({
      frontage: 'multiple',
      permitDate: '1998-03-15',
      areaIncludesCommon: true,
    });
  });

  it('ADR-898 Φ3β — άκυρες δηλώσεις αγνοούνται: άγνωστη πρόσοψη · ανύπαρκτη ημερομηνία · σημαία εκτός 0/1', () => {
    const draft = parseObjectiveValuePrefill('form=residence&frontage=corner&permit=1998-02-30&common=yes')?.draft;
    expect(draft).toEqual({ form: 'residence', levels: [{ floor: null, area: null }] });
  });
});
