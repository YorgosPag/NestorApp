/**
 * ADR-721 §1 — Τα κατηγορήματα ορατότητας layer.
 *
 * Ο λόγος ύπαρξης αυτού του suite είναι μία μετρημένη πραγματικότητα: σε φρέσκο φόρτωμα
 * του `47_ergasia.dxf` **και τα 58 layers** έχουν `visible: undefined`. Κάθε κατηγόρημα που
 * απαντά με truthiness (`layer.visible ? … : …`) δηλώνει τότε «όλα κρυμμένα» ενώ ο καμβάς
 * τα ζωγραφίζει όλα. Αυτά τα tests κλειδώνουν τη σωστή απάντηση για το `undefined`.
 */

import { describe, it, expect } from '@jest/globals';
import {
  isLayerOn,
  isLayerFrozen,
  isLayerRenderable,
  nextLayerOnState,
  resolveLayerGroupOnState,
} from '../layer-visibility';

describe('isLayerOn — DXF parity: απουσία δήλωσης = αναμμένο', () => {
  it('undefined ⇒ true', () => expect(isLayerOn({})).toBe(true));
  it('true ⇒ true', () => expect(isLayerOn({ visible: true })).toBe(true));
  it('false ⇒ false', () => expect(isLayerOn({ visible: false })).toBe(false));
  it('null/undefined layer ⇒ true (καμία δέσμευση)', () => {
    expect(isLayerOn(null)).toBe(true);
    expect(isLayerOn(undefined)).toBe(true);
  });
});

describe('isLayerFrozen — αντίστροφη προεπιλογή από το isLayerOn', () => {
  it('undefined ⇒ false', () => expect(isLayerFrozen({})).toBe(false));
  it('true ⇒ true', () => expect(isLayerFrozen({ frozen: true })).toBe(true));
});

describe('isLayerRenderable — AutoCAD: ΟΝ και μη-παγωμένο', () => {
  it('αδήλωτο layer ζωγραφίζεται', () => expect(isLayerRenderable({})).toBe(true));
  it('σβηστό δεν ζωγραφίζεται', () => expect(isLayerRenderable({ visible: false })).toBe(false));
  it('παγωμένο δεν ζωγραφίζεται ακόμη κι αν είναι αναμμένο', () => {
    expect(isLayerRenderable({ visible: true, frozen: true })).toBe(false);
  });
});

describe('nextLayerOnState — το επόμενο state ενός ματιού', () => {
  it('αδήλωτο ⇒ το πρώτο κλικ ΣΒΗΝΕΙ (όχι no-op)', () => {
    expect(nextLayerOnState({})).toBe(false);
  });
  it('αναμμένο ⇒ σβήνει· σβηστό ⇒ ανάβει', () => {
    expect(nextLayerOnState({ visible: true })).toBe(false);
    expect(nextLayerOnState({ visible: false })).toBe(true);
  });
});

describe('resolveLayerGroupOnState — ομαδικός διακόπτης', () => {
  it('όλα αναμμένα (και αδήλωτα) ⇒ all', () => {
    expect(resolveLayerGroupOnState([{}, { visible: true }])).toBe('all');
  });
  it('όλα σβηστά ⇒ none', () => {
    expect(resolveLayerGroupOnState([{ visible: false }, { visible: false }])).toBe('none');
  });
  it('ανάμεικτα ⇒ some', () => {
    expect(resolveLayerGroupOnState([{ visible: false }, {}])).toBe('some');
  });
  it('κενή ομάδα ⇒ all (τίποτα δεν είναι κρυμμένο)', () => {
    expect(resolveLayerGroupOnState([])).toBe('all');
  });
});
