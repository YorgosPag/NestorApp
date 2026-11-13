/**
 * ADR-923 §21.6 — «Πρόταση γραμμών» του πίνακα με σύνθετες ενδείξεις: ο ΙΔΙΟΣ κανόνας απορρόφησης με την κάρτα (`absorbComposites`).
 * Γραμμή `composite` στην ομάδα του πρώτου μέρους, χωρίς τις γραμμές των μερών· ομάδα που άδειασε ⇒ χωρίς κεφαλίδα· ένδειξη
 * με μέρος εκτός επιπέδων ⇒ καμία απορρόφηση (ποτέ σιωπηλή απώλεια).
 */
import { SUPPLY } from '@/subapps/catalog/__tests__/fixtures/power-supply.fixture';
import type { CompositeDisplay, FamilyTableRow, VariantScheme } from '@/subapps/catalog/types/family';
import type { AttributeGroupRecord, AttributeRecord } from '@/services/catalog/catalog-api.client';
import { suggestTableRows } from '../family-table-preview';

const record = (id: string, groupId: string): AttributeRecord => ({ id, groupId }) as AttributeRecord;
const group = (id: string, orderKey: string): AttributeGroupRecord => ({ id, orderKey, labels: { el: id } }) as AttributeGroupRecord;

const LIBRARY = new Map<string, AttributeRecord>([
  ['size', record('size', 'general')],
  ['weight', record('weight', 'dimensions')],
  ['phases', record('phases', 'electrical')],
  ['voltage', record('voltage', 'electrical')],
  ['frequency', record('frequency', 'mains')],
]);
const GROUPS = [group('dimensions', 'c'), group('electrical', 'a'), group('mains', 'b'), group('general', '0')];

const scheme = (attributeIds: readonly string[]): VariantScheme => ({
  code: 'by_size', labels: {}, levels: [{ axisAttributeIds: ['size'], attributeIds }],
});

/** Οι γραμμές χωρίς τα τοπικά id: τι δείχνει κάθε γραμμή. */
const shape = (rows: readonly FamilyTableRow[]) => rows.map((row) => {
  switch (row.kind) {
    case 'axis': return `axis:${row.axisAttributeId}`;
    case 'groupHeader': return `header:${row.labels.el}`;
    case 'attribute': return `attribute:${row.attributeId}`;
    case 'composite': return `composite:${row.compositeId}`;
  }
});

const suggest = (attributeIds: readonly string[], composites: readonly CompositeDisplay[] = [SUPPLY]) =>
  shape(suggestTableRows(scheme(attributeIds), LIBRARY, GROUPS, composites));

describe('§21.6 «Πρόταση γραμμών»: η σύνθετη ένδειξη απορροφά τα μέρη της', () => {
  it('μία γραμμή ένδειξης στην ομάδα του πρώτου μέρους · η ομάδα που άδειασε δεν παίρνει κεφαλίδα', () => {
    expect(suggest(['weight', 'phases', 'voltage', 'frequency'])).toEqual([
      'axis:size',
      'header:electrical', 'composite:cd_supply',
      'header:dimensions', 'attribute:weight',
    ]);
  });

  it('🔑 μέρος εκτός επιπέδων ⇒ καμία ένδειξη, καμία απορρόφηση: οι ιδιότητες μένουν γραμμές', () => {
    expect(suggest(['weight', 'phases', 'voltage'])).toEqual([
      'axis:size',
      'header:electrical', 'attribute:phases', 'attribute:voltage',
      'header:dimensions', 'attribute:weight',
    ]);
  });

  it('χωρίς σύνθετη ένδειξη: όπως πριν, κάθε ιδιότητα η δική της γραμμή', () => {
    expect(suggest(['weight', 'phases', 'voltage', 'frequency'], [])).toEqual([
      'axis:size',
      'header:electrical', 'attribute:phases', 'attribute:voltage',
      'header:mains', 'attribute:frequency',
      'header:dimensions', 'attribute:weight',
    ]);
  });

  it('τα id των γραμμών είναι μοναδικά', () => {
    const rows = suggestTableRows(scheme(['weight', 'phases', 'voltage', 'frequency']), LIBRARY, GROUPS, [SUPPLY]);
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
  });
});
