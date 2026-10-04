/**
 * ΑΓΚΥΡΑ — **η θέση μιας διεύθυνσης γράφεται στο ιστορικό ίδια, όποιος κι αν την άλλαξε**
 * (ADR-195 · ADR-332 D29).
 *
 * Ο άνθρωπος που σέρνει την πινέζα (PATCH έργου/κτιρίου) και η μηχανή που ολοκληρώνει τη θέση
 * περνούν από την **ίδια** μηχανή διαφορών με τον **ίδιο** ορισμό. Εδώ κρίνεται ο ορισμός.
 */

/* global describe, it, expect */

import { ADDRESS_COLLECTION_DEF, BUILDING_TRACKED_FIELDS, PROJECT_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import { formatAuditCoordinates } from '../audit-coordinates';
import { diffTrackedFields } from '../audit-diff';

const BASE = { id: 'addr_1', type: 'site', street: 'Τσιμισκή', number: '43', city: 'Θεσσαλονίκη' };
const AT = (lat: number, lng: number, extra: Record<string, unknown> = {}) => ({ ...BASE, coordinates: { lat, lng }, ...extra });

const diff = (before: unknown[], after: unknown[]) =>
  diffTrackedFields({ addresses: before }, { addresses: after }, { addresses: ADDRESS_COLLECTION_DEF });

describe('ο ορισμός είναι ΕΝΑΣ', () => {
  it('Ε1 — έργο και κτίριο διαβάζουν το ίδιο αντικείμενο', () => {
    expect(PROJECT_TRACKED_FIELDS.addresses).toBe(ADDRESS_COLLECTION_DEF);
    expect(BUILDING_TRACKED_FIELDS.addresses).toBe(ADDRESS_COLLECTION_DEF);
  });
});

describe('μορφή της θέσης', () => {
  it('Μ1 — πέντε δεκαδικά, «πλάτος, μήκος»', () => {
    expect(formatAuditCoordinates({ coordinates: { lat: 40.6403, lng: 22.9444 } })).toBe('40.64030, 22.94440');
  });

  it('Μ2 — το 0 είναι θέση (ισημερινός / Γκρίνουιτς), όχι απουσία', () => {
    expect(formatAuditCoordinates({ coordinates: { lat: 0, lng: 0 } })).toBe('0.00000, 0.00000');
  });

  it.each([
    ['χωρίς θέση', {}],
    ['θέση null', { coordinates: null }],
    ['μισή θέση', { coordinates: { lat: 40.6 } }],
    ['μη αριθμός', { coordinates: { lat: '40.6', lng: 22.9 } }],
    ['NaN', { coordinates: { lat: Number.NaN, lng: 22.9 } }],
  ])('Μ3 — %s ⇒ null', (_name, item) => {
    expect(formatAuditCoordinates(item)).toBeNull();
  });
});

describe('διαφορά θέσης', () => {
  it('Δ1 — σύρσιμο πινέζας ⇒ ΜΙΑ υπο-αλλαγή `coordinates`, σε κείμενο ανθρώπου (ποτέ ωμό JSON)', () => {
    expect(diff([AT(40.6403, 22.9444)], [AT(40.65, 22.95, { source: 'dragged' })])).toEqual([
      {
        field: 'addresses',
        oldValue: null,
        newValue: null,
        label: 'addresses',
        kind: 'collection',
        op: 'modified',
        itemKey: 'k:addr_1',
        itemLabel: 'site — Τσιμισκή — 43',
        subChanges: [{ subField: 'coordinates', oldValue: '40.64030, 22.94440', newValue: '40.65000, 22.95000' }],
      },
    ]);
  });

  it('Δ2 — πρώτη θέση (από τίποτα) και απώλεια θέσης (σε τίποτα)', () => {
    expect(diff([BASE], [AT(40.6403, 22.9444)])[0].subChanges).toEqual([
      { subField: 'coordinates', oldValue: null, newValue: '40.64030, 22.94440' },
    ]);
    expect(diff([AT(40.6403, 22.9444)], [BASE])[0].subChanges).toEqual([
      { subField: 'coordinates', oldValue: '40.64030, 22.94440', newValue: null },
    ]);
  });

  it('Δ3 — ίδιο σημείο με άλλη προέλευση / απόδειξη / ώρα επαλήθευσης ⇒ ΚΑΜΙΑ γραμμή', () => {
    const before = AT(40.6403, 22.9444, { source: 'geocoded', verifiedAt: 1, geocodingMetadata: { confidence: 0.5 } });
    const after = AT(40.6403, 22.9444, { source: 'dragged', verifiedAt: 2 });

    expect(diff([before], [after])).toEqual([]);
  });

  it('Δ4 — μετακίνηση κάτω από ~1 μ. (ίδια 5 δεκαδικά) δεν είναι αλλαγή που βλέπει άνθρωπος', () => {
    expect(diff([AT(40.640301, 22.944401)], [AT(40.640302, 22.944402)])).toEqual([]);
  });

  it('Δ5 — κείμενο ΚΑΙ θέση στην ίδια αποθήκευση ⇒ ΜΙΑ εγγραφή για τη διεύθυνση, δύο υπο-αλλαγές', () => {
    const changes = diff([AT(40.6403, 22.9444)], [{ ...AT(40.65, 22.95), number: '45' }]);

    expect(changes).toHaveLength(1);
    expect(changes[0].subChanges).toEqual([
      { subField: 'number', oldValue: '43', newValue: '45' },
      { subField: 'coordinates', oldValue: '40.64030, 22.94440', newValue: '40.65000, 22.95000' },
    ]);
  });

  it('Δ6 — ο γραφέας ΔΕΝ αποθηκεύει πια ψευδο-ετικέτα υπο-πεδίου (`label: \'street\'`)', () => {
    const [change] = diff([BASE], [{ ...BASE, street: 'Εγνατία' }]);

    expect(change.subChanges).toEqual([{ subField: 'street', oldValue: 'Τσιμισκή', newValue: 'Εγνατία' }]);
    expect('label' in (change.subChanges ?? [])[0]).toBe(false);
  });

  it('Δ7 — νέα διεύθυνση με θέση ⇒ η θέση είναι μέρος της προσθήκης', () => {
    const [change] = diff([], [AT(40.6403, 22.9444)]);

    expect(change.op).toBe('added');
    expect(change.subChanges).toContainEqual({ subField: 'coordinates', oldValue: null, newValue: '40.64030, 22.94440' });
  });
});
