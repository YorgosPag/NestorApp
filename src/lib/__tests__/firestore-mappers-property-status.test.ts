/**
 * ⚓ Ο mapper ακινήτου ΔΕΝ ξεπλένει τον κύκλο ζωής (ADR-281 · ADR-329 §3.9)
 *
 * 🔴 Περιστατικό 2026-10-07: η λίστα έγκυρων `status` του `mapPropertyDoc` είχε χειρόγραφο
 * `'deleted'` και όχι `'archived'` ⇒ το αρχειοθετημένο ακίνητο έβγαινε `'unavailable'` και
 * η επιμέτρηση το πρόσφερε ως ζωντανό, χωρίς «(αρχειοθετημένο)». Τα tests του επιθέματος
 * ήταν ΠΡΑΣΙΝΑ, γιατί έφτιαχναν δεδομένα **ήδη χαρτογραφημένα** — κανένα δεν περνούσε ωμό
 * έγγραφο από τον mapper. Αυτή η σουίτα ξεκινά από το ωμό έγγραφο.
 *
 * @module lib/__tests__/firestore-mappers-property-status
 */

import { mapPropertyDoc } from '../firestore-mappers';
import {
  ARCHIVED_STATUS,
  RETIRED_STATUSES,
  TRASHED_STATUS,
  isArchived,
  isRetired,
  isTrashed,
} from '@/lib/firestore/trashed-status';
import {
  linkedRetiredProperties,
  liveProperties,
  retiredKindOf,
} from '@/components/properties/shared/linked-retired-properties';

const rawDoc = (status: unknown): Record<string, unknown> => ({
  name: 'ΔΟΚΙΜΗ',
  code: 'B-DI-1.01',
  buildingId: 'bldg_1',
  floorId: 'flr_1',
  commercialStatus: 'for-sale',
  status,
});

describe('mapPropertyDoc — ο κύκλος ζωής περνά αυτούσιος', () => {
  it('🔴 το αρχειοθετημένο μένει αρχειοθετημένο, δεν γίνεται «μη διαθέσιμο»', () => {
    const mapped = mapPropertyDoc('prop_a', rawDoc(ARCHIVED_STATUS));
    expect(mapped.status).toBe(ARCHIVED_STATUS);
    expect(isArchived(mapped)).toBe(true);
    expect(isRetired(mapped)).toBe(true);
  });

  it('το ακίνητο στον κάδο μένει στον κάδο', () => {
    const mapped = mapPropertyDoc('prop_t', rawDoc(TRASHED_STATUS));
    expect(isTrashed(mapped)).toBe(true);
    expect(isRetired(mapped)).toBe(true);
  });

  it('κάθε τιμή του RETIRED_STATUSES επιβιώνει — νέα τιμή κύκλου ζωής δεν θέλει αλλαγή στον mapper', () => {
    for (const status of RETIRED_STATUSES) {
      expect(mapPropertyDoc('prop_x', rawDoc(status)).status).toBe(status);
    }
  });

  it('ζωντανή εμπορική τιμή περνά, άγνωστη ή κενή πέφτει σε «μη διαθέσιμο»', () => {
    expect(mapPropertyDoc('p', rawDoc('for-sale')).status).toBe('for-sale');
    expect(mapPropertyDoc('p', rawDoc('κάτι-άγνωστο')).status).toBe('unavailable');
    expect(mapPropertyDoc('p', rawDoc(undefined)).status).toBe('unavailable');
    expect(isRetired(mapPropertyDoc('p', rawDoc('κάτι-άγνωστο')))).toBe(false);
  });
});

describe('ωμό έγγραφο → mapper → επιλογείς επιμέτρησης', () => {
  const live = mapPropertyDoc('prop_live', rawDoc('unavailable'));
  const archived = mapPropertyDoc('prop_arch', rawDoc(ARCHIVED_STATUS));
  const trashed = mapPropertyDoc('prop_trash', rawDoc(TRASHED_STATUS));
  const all = [live, archived, trashed];

  it('🔴 για νέα επιλογή προσφέρεται ΜΟΝΟ το ζωντανό', () => {
    expect(liveProperties(all).map((p) => p.id)).toEqual(['prop_live']);
  });

  it('το ήδη συνδεδεμένο αποσυρμένο φαίνεται, με το είδος του', () => {
    expect(linkedRetiredProperties(all, ['prop_arch']).map((p) => p.id)).toEqual(['prop_arch']);
    expect(all.map(retiredKindOf)).toEqual([null, 'archived', 'trashed']);
  });
});
