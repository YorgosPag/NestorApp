/**
 * ⚓ Αποσυρμένα ακίνητα που τα αναφέρει ήδη μια επιμέτρηση (ADR-281 · ADR-329 §3.9)
 *
 * Ο επιλογέας δεν προσφέρει ό,τι αποσύρθηκε· ό,τι είναι ΗΔΗ συνδεδεμένο φαίνεται με το όνομά του.
 * Και η κατανομή κόστους δεν χάνει σιωπηλά ακίνητο που η επιμέτρηση ονόμασε ρητά.
 *
 * @module components/properties/shared/__tests__/linked-retired-properties
 */

import {
  linkedRetiredProperties,
  liveProperties,
  propertyOptionLabel,
  propertyShortLabel,
  retiredKindOf,
} from '../linked-retired-properties';
import { resolveTargetProperties } from '@/components/building-management/tabs/MeasurementsTabContent/boq-target-properties';
import type { Property } from '@/types/property';

const unit = (id: string, status: string, floorId = 'flr_1'): Property =>
  ({ id, name: `Διαμέρισμα ${id}`, code: id.toUpperCase(), status, floorId }) as Property;

const LIVE = unit('a1', 'active');
const ARCHIVED = unit('a2', 'archived');
const TRASHED = unit('a3', 'deleted');
const ALL = [LIVE, ARCHIVED, TRASHED];

describe('τι προσφέρεται και τι απλώς φαίνεται', () => {
  it('για νέα επιλογή προσφέρονται μόνο τα ζωντανά', () => {
    expect(liveProperties(ALL)).toEqual([LIVE]);
  });

  it('🔴 το αποσυρμένο φαίνεται ΜΟΝΟ όταν είναι ήδη συνδεδεμένο', () => {
    expect(linkedRetiredProperties(ALL, [])).toEqual([]);
    expect(linkedRetiredProperties(ALL, ['a2'])).toEqual([ARCHIVED]);
    expect(linkedRetiredProperties(ALL, ['a2', 'a3'])).toEqual([ARCHIVED, TRASHED]);
  });

  it('ζωντανό συνδεδεμένο ΔΕΝ διπλομετριέται — έρχεται ήδη από τα ζωντανά', () => {
    expect(linkedRetiredProperties(ALL, ['a1'])).toEqual([]);
  });

  it('το είδος της απόσυρσης ονομάζεται, δεν συγκρίνεται συμβολοσειρά στην οθόνη', () => {
    expect([LIVE, ARCHIVED, TRASHED].map(retiredKindOf)).toEqual([null, 'archived', 'trashed']);
  });
});

describe('ετικέτες', () => {
  it('επιλογέας: «κωδικός — όνομα», ή σκέτο όνομα όταν λείπει ο κωδικός', () => {
    expect(propertyOptionLabel({ code: 'Α1', name: 'Διαμέρισμα' })).toBe('Α1 — Διαμέρισμα');
    expect(propertyOptionLabel({ code: undefined, name: 'Διαμέρισμα' })).toBe('Διαμέρισμα');
  });

  it('chip: κωδικός ή όνομα, με το επίθεμα μόνο όταν υπάρχει', () => {
    expect(propertyShortLabel({ code: 'Α1', name: 'Διαμέρισμα' }, '')).toBe('Α1');
    expect(propertyShortLabel({ code: undefined, name: 'Διαμέρισμα' }, '(αρχειοθετημένο)')).toBe(
      'Διαμέρισμα (αρχειοθετημένο)',
    );
  });
});

describe('🔴 κατανομή κόστους — ποια ακίνητα είναι στόχος', () => {
  it('ρητή αναφορά σε ΕΝΑ ακίνητο: μένει στόχος ακόμη κι αν αρχειοθετήθηκε', () => {
    expect(resolveTargetProperties('property', '', 'a2', [], ALL)).toEqual([ARCHIVED]);
  });

  it('ρητή αναφορά σε ΠΟΛΛΑ: το αρχειοθετημένο δεν πέφτει σιωπηλά από τη λίστα', () => {
    expect(resolveTargetProperties('properties', '', '', ['a1', 'a2'], ALL)).toEqual([LIVE, ARCHIVED]);
  });

  it.each(['building', 'common_areas'] as const)('εύρος %s: μόνο τα ζωντανά', (scope) => {
    expect(resolveTargetProperties(scope, '', '', [], ALL)).toEqual([LIVE]);
  });

  it('εύρος ορόφου: μόνο τα ζωντανά του ορόφου', () => {
    expect(resolveTargetProperties('floor', 'flr_1', '', [], ALL)).toEqual([LIVE]);
    expect(resolveTargetProperties('floor', '', '', [], ALL)).toEqual([]);
  });
});
