import { formatImpactValue } from '../impact-value-formatter';

type FakeT = (key: string, options?: { defaultValue?: string }) => string;

const DICT: Record<string, string> = {
  'properties:impactGuard.emptyValue': 'κενό',
  'properties-enums:units.sqm': 'τ.μ.',
  'properties-detail:fields.areas.gross': 'Μικτό',
  'properties-detail:fields.areas.net': 'Καθαρό',
  'properties-detail:fields.areas.balcony': 'Μπαλκόνι',
  'properties-detail:fields.areas.terrace': 'Βεράντα',
  'properties-detail:fields.areas.garden': 'Κήπος',
  'properties-detail:fields.bedrooms': 'Υπνοδωμάτια',
  'properties-detail:fields.bathrooms': 'Μπάνια',
  'properties-detail:fields.layout.wc': 'WC',
  'properties-enums:condition.excellent': 'Άριστη',
  'properties-enums:condition.new': 'Νέο',
  'properties-enums:energy.class': 'Ενεργειακή κλάση',
  'properties-enums:systems.heating.label': 'Θέρμανση',
  'properties-enums:systems.heating.autonomous': 'Αυτόνομη',
  'properties-enums:systems.cooling.label': 'Ψύξη',
  'properties-enums:systems.cooling.split-units': 'Διαιρούμενες μονάδες',
  'properties-enums:finishes.flooring.label': 'Δάπεδα',
  'properties-enums:finishes.flooring.tiles': 'Πλακάκι',
  'properties-enums:finishes.flooring.marble': 'Μάρμαρο',
  'properties-enums:finishes.flooring.wood': 'Ξύλο',
  'properties-enums:finishes.frames.label': 'Κουφώματα',
  'properties-enums:finishes.frames.pvc': 'PVC',
  'properties-enums:finishes.glazing.label': 'Υαλοπίνακες',
  'properties-enums:finishes.glazing.double': 'Διπλοί',
  'properties-enums:features.interior.smart-home': 'Έξυπνο σπίτι',
  'properties-enums:features.interior.solar-panels': 'Ηλιακά πάνελ',
  'properties-enums:features.security.security-door': 'Πόρτα ασφαλείας',
  'properties-enums:features.security.alarm': 'Συναγερμός',
  'properties-enums:features.security.cctv': 'CCTV',
  'properties-enums:features.security.intercom': 'Θυροτηλέφωνο',
  'properties-enums:features.security.motion-sensors': 'Αισθητήρες κίνησης',
  'properties-enums:commercialStatus.for-sale': 'Προς πώληση',
  'properties-enums:units.orientation.north': 'Βόρειο',
  'properties-enums:units.orientation.south': 'Νότιο',
};

const fakeT: FakeT = (key, options) => DICT[key] ?? options?.defaultValue ?? key;

describe('formatImpactValue', () => {
  test('null → emptyValue label', () => {
    expect(formatImpactValue(fakeT as never, 'areas', null)).toBe('κενό');
  });

  test('areas → gross/net/balcony/terrace/garden with τ.μ.', () => {
    const raw = JSON.stringify({ gross: 35, net: 30, balcony: 20, terrace: 15 });
    expect(formatImpactValue(fakeT as never, 'areas', raw))
      .toBe('Μικτό 35 τ.μ. · Καθαρό 30 τ.μ. · Μπαλκόνι 20 τ.μ. · Βεράντα 15 τ.μ.');
  });

  test('layout → bedrooms/bathrooms/wc', () => {
    const raw = JSON.stringify({ bedrooms: 1, bathrooms: 1, wc: 1 });
    expect(formatImpactValue(fakeT as never, 'layout', raw))
      .toBe('Υπνοδωμάτια 1 · Μπάνια 1 · WC 1');
  });

  test('condition → enum lookup', () => {
    expect(formatImpactValue(fakeT as never, 'condition', 'excellent')).toBe('Άριστη');
    expect(formatImpactValue(fakeT as never, 'condition', 'new')).toBe('Νέο');
  });

  test('energy → class prefix + letter', () => {
    const raw = JSON.stringify({ class: 'A+' });
    expect(formatImpactValue(fakeT as never, 'energy', raw)).toBe('Ενεργειακή κλάση A+');
  });

  test('systemsOverride → heating/cooling labels + values', () => {
    const raw = JSON.stringify({ heatingType: 'autonomous', coolingType: 'split-units' });
    expect(formatImpactValue(fakeT as never, 'systemsOverride', raw))
      .toBe('Θέρμανση: Αυτόνομη · Ψύξη: Διαιρούμενες μονάδες');
  });

  test('finishes → flooring list + frames + glazing', () => {
    const raw = JSON.stringify({
      flooring: ['tiles', 'marble', 'wood'],
      windowFrames: 'pvc',
      glazing: 'double',
    });
    expect(formatImpactValue(fakeT as never, 'finishes', raw))
      .toBe('Δάπεδα: Πλακάκι, Μάρμαρο, Ξύλο · Κουφώματα: PVC · Υαλοπίνακες: Διπλοί');
  });

  test('interiorFeatures → comma-joined enum lookups', () => {
    const raw = JSON.stringify(['smart-home', 'solar-panels']);
    expect(formatImpactValue(fakeT as never, 'interiorFeatures', raw))
      .toBe('Έξυπνο σπίτι, Ηλιακά πάνελ');
  });

  test('securityFeatures → comma-joined enum lookups', () => {
    const raw = JSON.stringify(['security-door', 'alarm', 'cctv', 'intercom', 'motion-sensors']);
    expect(formatImpactValue(fakeT as never, 'securityFeatures', raw))
      .toBe('Πόρτα ασφαλείας, Συναγερμός, CCTV, Θυροτηλέφωνο, Αισθητήρες κίνησης');
  });

  test('commercialStatus → enum lookup', () => {
    expect(formatImpactValue(fakeT as never, 'commercialStatus', 'for-sale')).toBe('Προς πώληση');
    expect(formatImpactValue(fakeT as never, 'commercial', 'for-sale')).toBe('Προς πώληση');
  });

  test('unknown field → returns raw', () => {
    expect(formatImpactValue(fakeT as never, 'name', 'Unit A')).toBe('Unit A');
    expect(formatImpactValue(fakeT as never, 'code', 'A-GK-1.04')).toBe('A-GK-1.04');
  });

  test('malformed JSON for structured field → returns raw', () => {
    expect(formatImpactValue(fakeT as never, 'areas', 'not-json')).toBe('not-json');
  });

  test('enum miss falls back to raw token via defaultValue', () => {
    const raw = JSON.stringify(['unknown-feature']);
    expect(formatImpactValue(fakeT as never, 'interiorFeatures', raw)).toBe('unknown-feature');
  });
});
