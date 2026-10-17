/**
 * ⚓ ADR-915 §23.10 — «ποιος;» σε γραμμή προσώπου: πότε χρειάζεται, ποια πρόσωπα φαίνονται, και η αρίθμηση **ανάμεσα
 * στα ορατά** (καμία τρύπα που θα μαρτυρούσε πρόσωπο που ο θεατής δεν βλέπει). Συνθετικά κλειδιά — κανένα πραγματικό.
 */

import { rowKeyOf } from '@/config/conveyance-checklist/row-key';
import { sellerParty } from '@/lib/conveyance/case-parties';
import type { ConveyanceSellerParty } from '@/types/conveyance-case';
import {
  casePartyLabels,
  needsPartyNames,
  partyLabelOf,
  partyLabelOfRowKey,
  partyNamesOf,
  visiblePartyKeys,
  visibleSellers,
} from '../party-labels';

const co = sellerParty('cont_co', 'legal_entity', 'principal');
const lo = sellerParty('cont_lo', 'person', 'landowner');
const other = sellerParty('cont_x', 'person', 'other');
const names = new Map([['cont_co', 'Test Builder'], ['cont_lo', '  Test Landowner  ']]);

const rowOf = (party: ConveyanceSellerParty | null) => ({ party });

describe('πότε χρειάζεται «ποιος»', () => {
  it('ένα πρόσωπο ⇒ καμία ετικέτα (η όψη όπως πριν από την §22)', () => {
    expect(needsPartyNames(1)).toBe(false);
    expect(casePartyLabels([co], names)).toEqual([]);
  });

  it('δύο πρόσωπα ⇒ σειρά της υπόθεσης, όνομα τριμμένο, όνομα που λείπει ⇒ κενό', () => {
    expect(casePartyLabels([co, lo, other], names)).toEqual([
      { key: 'cont_co', ordinal: 1, name: 'Test Builder' },
      { key: 'cont_lo', ordinal: 2, name: 'Test Landowner' },
      { key: 'cont_x', ordinal: 3, name: '' },
    ]);
  });
});

describe('ποια πρόσωπα φαίνονται', () => {
  it('μόνο όσα έχουν γραμμή στον κατάλογο του θεατή — οι γραμμές της υπόθεσης δεν μετρούν', () => {
    expect([...visiblePartyKeys([rowOf(null), rowOf(lo), rowOf(lo)])]).toEqual(['cont_lo']);
  });

  it('η αρίθμηση γίνεται ανάμεσα στα ΟΡΑΤΑ: κανένα κενό που μαρτυρά κρυμμένο πρόσωπο', () => {
    const shown = visibleSellers([co, lo, other], new Set(['cont_co', 'cont_x']));
    expect(casePartyLabels(shown, names).map((label) => [label.key, label.ordinal])).toEqual([['cont_co', 1], ['cont_x', 2]]);
  });

  it('κανένα ορατό ⇒ καμία ετικέτα', () => {
    expect(casePartyLabels(visibleSellers([co, lo], new Set()), names)).toEqual([]);
  });
});

describe('από κλειδί γραμμής στο πρόσωπο', () => {
  const labels = casePartyLabels([co, lo], names);

  it('γραμμή προσώπου ⇒ το πρόσωπό της · γραμμή υπόθεσης ⇒ null · άγνωστο πρόσωπο ⇒ null', () => {
    expect(partyLabelOfRowKey(labels, rowKeyOf('seller_tax_clearance', 'cont_lo'))?.name).toBe('Test Landowner');
    expect(partyLabelOfRowKey(labels, 'title_deed')).toBeNull();
    expect(partyLabelOfRowKey(labels, rowKeyOf('seller_tax_clearance', 'cont_ghost'))).toBeNull();
    expect(partyLabelOf(labels, null)).toBeNull();
  });

  it('τα ονόματα μιας όψης ξαναμετριούνται πάνω σε νεότερη λίστα (optimistic): ο νέος παίρνει θέση, όχι όνομα', () => {
    expect(casePartyLabels([co, lo, other], partyNamesOf(labels))[2]).toEqual({ key: 'cont_x', ordinal: 3, name: '' });
  });
});
