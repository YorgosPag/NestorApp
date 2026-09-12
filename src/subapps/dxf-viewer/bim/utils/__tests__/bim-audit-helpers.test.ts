/**
 * ADR-XXX — BIM audit helpers unit tests.
 *
 * Verifies the three diff routines (creation / update / deletion) emit the
 * correct `AuditFieldChange[]` shape across the BIM registries. These three
 * helpers underpin every BIM audit row, so any drift here corrupts every
 * wall / column / slab / beam / opening history entry.
 */

import {
  buildBimCreationChanges,
  buildBimDeletionChanges,
  buildBimUpdateChanges,
  ensureNonEmptyChanges,
} from '../bim-audit-helpers';
import {
  WALL_TRACKED_FIELDS,
  COLUMN_TRACKED_FIELDS,
  SLAB_TRACKED_FIELDS,
  BEAM_TRACKED_FIELDS,
  OPENING_TRACKED_FIELDS,
} from '@/config/audit-tracked-fields';
import type { TrackedFieldDef } from '@/lib/audit/audit-diff';
import type { AuditFieldChange } from '@/types/audit-trail';

function fieldsOf(changes: AuditFieldChange[]): string[] {
  return changes.map((c) => c.field).sort();
}

function entryFor(changes: AuditFieldChange[], field: string): AuditFieldChange | undefined {
  return changes.find((c) => c.field === field);
}

describe('buildBimCreationChanges', () => {
  it('emits one entry per non-null tracked wall field', () => {
    const changes = buildBimCreationChanges(
      {
        kind: 'straight',
        layerId: 'WALLS-EXT',
        params: {
          category: 'exterior',
          height: 3000,
          thickness: 250,
          flip: false,
          baseBinding: 'storey-floor',
          topBinding: 'storey-ceiling',
          baseOffset: 0,
          topOffset: 0,
        },
      },
      WALL_TRACKED_FIELDS,
    );
    expect(fieldsOf(changes)).toEqual(
      expect.arrayContaining(['kind', 'layerId', 'category', 'height', 'thickness', 'baseBinding']),
    );
    expect(entryFor(changes, 'height')).toMatchObject({ oldValue: null, newValue: 3000 });
    expect(entryFor(changes, 'kind')).toMatchObject({ oldValue: null, newValue: 'straight' });
  });

  it('skips fields that serialize to null (undefined / empty)', () => {
    const changes = buildBimCreationChanges(
      { kind: 'door', params: { wallId: 'w1', offsetFromStart: 0, width: 900 } },
      OPENING_TRACKED_FIELDS,
    );
    expect(entryFor(changes, 'material')).toBeUndefined();
    expect(entryFor(changes, 'glazingPanes')).toBeUndefined();
    expect(entryFor(changes, 'mark')).toBeUndefined();
  });
});

describe('buildBimUpdateChanges', () => {
  it('emits only changed fields', () => {
    const prev = {
      kind: 'rectangular' as const,
      params: { width: 400, depth: 400, height: 3000, rotation: 0, anchor: 'center' as const },
    };
    const next = {
      kind: 'rectangular' as const,
      params: { width: 500, depth: 400, height: 3000, rotation: 90, anchor: 'center' as const },
    };
    const changes = buildBimUpdateChanges(prev, next, COLUMN_TRACKED_FIELDS);
    expect(fieldsOf(changes)).toEqual(['rotation', 'width']);
    expect(entryFor(changes, 'width')).toMatchObject({ oldValue: 400, newValue: 500 });
    expect(entryFor(changes, 'rotation')).toMatchObject({ oldValue: 0, newValue: 90 });
  });

  it('returns [] when no tracked fields changed', () => {
    const snapshot = { kind: 'floor' as const, params: { thickness: 200, levelElevation: 0, geometryType: 'box' as const } };
    expect(buildBimUpdateChanges(snapshot, snapshot, SLAB_TRACKED_FIELDS)).toEqual([]);
  });

  it('diffs nested object fields as JSON scalars', () => {
    const prev = { kind: 'straight' as const, params: { dna: { totalThickness: 200, layers: [{ thickness: 200, material: 'rc' }] } } };
    const next = { kind: 'straight' as const, params: { dna: { totalThickness: 250, layers: [{ thickness: 250, material: 'rc' }] } } };
    const changes = buildBimUpdateChanges(prev, next, WALL_TRACKED_FIELDS);
    expect(fieldsOf(changes)).toContain('dna');
  });
});

describe('buildBimDeletionChanges', () => {
  it('emits oldValue=X → newValue=null for every non-null tracked field', () => {
    const changes = buildBimDeletionChanges(
      {
        kind: 'straight',
        params: { width: 250, depth: 500, topElevation: 3000, supportType: 'simple' },
      },
      BEAM_TRACKED_FIELDS,
    );
    expect(fieldsOf(changes)).toEqual(
      expect.arrayContaining(['kind', 'width', 'depth', 'topElevation', 'supportType']),
    );
    for (const c of changes) expect(c.newValue).toBeNull();
    expect(entryFor(changes, 'width')).toMatchObject({ oldValue: 250 });
  });

  it('returns [] when snapshot is fully empty', () => {
    expect(
      buildBimDeletionChanges({ kind: '' as never, params: {} }, BEAM_TRACKED_FIELDS),
    ).toEqual([]);
  });
});

// ============================================================================
// ΑΓΚΥΡΕΣ Δ — ADR-852 Φ3: Η ΔΙΑΓΡΑΦΗ ΕΙΝΑΙ ΔΕΥΤΕΡΟΣ ΣΥΓΓΡΑΦΕΑΣ
// ============================================================================

/**
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΟΥΝ — ΜΕΤΡΗΜΕΝΟ 2026-09-12. Το `buildBimDeletionChanges` γράφει βαθμωτές
 * εγγραφές με **χειρόγραφο βρόχο, εκτός της μηχανής diff**. Το ADR-852 §4.4 είχε ενώσει
 * το βαθμωτό σκέλος στο `pushScalarChange()` ακριβώς για να μην προστεθεί το διπλό
 * κανάλι δύο φορές — αλλά η ένωση **δεν έφτανε ως εδώ**. Χωρίς αυτές τις άγκυρες, κάθε
 * εγγραφή διαγραφής BIM θα έμενε χωρίς περιγραφέα, **σιωπηλά**.
 *
 * Η Δ3 είναι η σημαντική: δεν ελέγχει τιμή, ελέγχει **ΣΥΜΦΩΝΙΑ** των δύο συγγραφέων.
 * Έτσι η απόκλισή τους γίνεται **μη εκφράσιμη** — αν αύριο ο ένας αποκτήσει κανάλι που
 * ο άλλος δεν ξέρει, κοκκινίζει εδώ.
 */
describe('ADR-852 Φ3 — η διαγραφή περνά από τον ΙΔΙΟ περιγραφέα', () => {
  const defs: Record<string, TrackedFieldDef> = {
    kind: { kind: 'scalar', label: 'kind' },
    width: { kind: 'scalar', label: 'width', quantity: 'model-length' },
  };
  const snapshot = { kind: 'rectangular', params: { width: 400 } };

  it('Δ1 — δηλωμένη ποσότητα φτάνει ΚΑΙ στη διαγραφή (η πόρτα που έλειπε)', () => {
    const changes = buildBimDeletionChanges(snapshot, defs);
    expect(entryFor(changes, 'width')).toMatchObject({
      oldValue: 400,
      newValue: null,
      label: 'width',
      quantity: 'model-length',
    });
  });

  it('Δ2 🔴 — αδήλωτο πεδίο: το κλειδί ΑΠΟΥΣΙΑΖΕΙ (ο Admin SDK ρίχνει το write σε `undefined`)', () => {
    const kindEntry = entryFor(buildBimDeletionChanges(snapshot, defs), 'kind');
    expect(kindEntry).toBeDefined();
    expect('quantity' in (kindEntry as AuditFieldChange)).toBe(false);
  });

  it('Δ3 — ΔΗΜΙΟΥΡΓΙΑ και ΔΙΑΓΡΑΦΗ συμφωνούν στα κανάλια του ΙΔΙΟΥ πεδίου', () => {
    const created = entryFor(buildBimCreationChanges(snapshot, defs), 'width');
    const deleted = entryFor(buildBimDeletionChanges(snapshot, defs), 'width');
    const channelsOf = (c?: AuditFieldChange) => ({ label: c?.label, quantity: c?.quantity });
    expect(channelsOf(deleted)).toEqual(channelsOf(created));
  });
});

describe('ensureNonEmptyChanges', () => {
  it('returns the original when non-empty', () => {
    const c: AuditFieldChange[] = [{ field: 'a', oldValue: 1, newValue: 2 }];
    expect(ensureNonEmptyChanges(c, { field: 'fb', oldValue: null, newValue: 'x' })).toBe(c);
  });
  it('returns the fallback wrapped in an array when empty', () => {
    const fb: AuditFieldChange = { field: 'kind', oldValue: null, newValue: 'door' };
    expect(ensureNonEmptyChanges([], fb)).toEqual([fb]);
  });
});
