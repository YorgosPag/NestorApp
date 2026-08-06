/**
 * 🔴 ADR-767 Δ4 — **ΤΟ ΑΠΟΤΕΛΕΣΜΑ ΤΟΥ ΤΕΛΕΥΤΑΙΟΥ ΕΛΕΓΧΟΥ**, όχι μια συνεχώς αληθινή πρόταση.
 *
 * ## Τι κρατά αυτό το store, και τι ΔΕΝ κρατά
 * Ο πίνακας **δεν ξαναγεμίζει ποτέ μόνος του** (Δ3) — άρα η εφαρμογή δεν έχει τρόπο να ξέρει
 * *συνεχώς* αν η πηγή κουνήθηκε. Ένα σημάδι «μπαγιάτικο» που θα ισχυριζόταν ζωντανή αλήθεια
 * θα ήταν ψέμα τον περισσότερο χρόνο, ή θα απαιτούσε δημοσκόπηση της πηγής ανά καρέ.
 *
 * Γι' αυτό η σημασία είναι ρητά **«ο τελευταίος έλεγχος είπε X»** — ακριβώς το μοντέλο του
 * AutoCAD `DATALINKNOTIFY`: μαθαίνεις όταν η εφαρμογή **κοίταξε**, και κοιτάζει σε ρητές
 * στιγμές (ανανέωση · απόπειρα εξαγωγής).
 *
 * ## 🔴 Η ΑΠΟΥΣΙΑ ΔΕΝ ΕΙΝΑΙ «ΕΝΗΜΕΡΩΜΕΝΟΣ»
 * `null` σημαίνει «**κανείς δεν κοίταξε ακόμη**». Το να το ζωγραφίσει κάποιος σαν «fresh» θα
 * ήταν το ψεύτικο πράσινο που τα N.11/N.12 τεκμηριώνουν τέσσερις φορές («0 = κανείς δεν
 * κοίταξε»), και που το `TableFreshnessUnknown` υπάρχει ακριβώς για να αποφύγει.
 *
 * ## Γιατί ζητά καρέ ΜΟΝΟ όταν αλλάζει
 * Ο φραγμός εξαγωγής γράφει **όλους** τους δεμένους πίνακες μαζί. Αν κάθε γραφή ζητούσε καρέ
 * άνευ όρων, μια σκηνή με 20 δεμένους πίνακες θα ζητούσε 20 καρέ για μία χειρονομία — και σε
 * ένα έργο όπου τίποτα δεν άλλαξε, 20 καρέ για το τίποτα. Ο φύλακας ζει **στον γραφέα**,
 * όπως στο `table-indicator-hover-store`, ώστε ένας δεύτερος γραφέας αύριο να μην μπορεί να
 * τον ξεχάσει.
 *
 * @see state/table-binding-freshness-store.ts
 * @see docs/centralized-systems/reference/adrs/ADR-767-table-bound-mode.md §4 Δ4
 */

import {
  __resetTableBindingFreshnessForTests,
  clearTableBindingFreshness,
  getTableBindingFreshness,
  setTableBindingFreshness,
  subscribeTableBindingFreshness,
} from '../table-binding-freshness-store';
import { markSystemsDirty } from '../../rendering/core/frame-scheduler-api';

jest.mock('../../rendering/core/frame-scheduler-api', () => ({
  markSystemsDirty: jest.fn(),
}));

const dirty = markSystemsDirty as jest.MockedFunction<typeof markSystemsDirty>;

beforeEach(() => {
  __resetTableBindingFreshnessForTests();
  jest.clearAllMocks();
});

// ─── 1. Η απουσία είναι δική της απάντηση ─────────────────────────────────────

describe('getTableBindingFreshness — «κανείς δεν κοίταξε» ≠ «όλα καλά»', () => {
  it('🔴 ΑΓΝΩΣΤΟΣ ΠΙΝΑΚΑΣ ⇒ `null`, ΠΟΤΕ «fresh»', () => {
    expect(getTableBindingFreshness('tbl_1')).toBeNull();
  });

  it('κρατά χωριστή απάντηση ανά οντότητα — δύο πίνακες δεν μοιράζονται ετυμηγορία', () => {
    setTableBindingFreshness('tbl_1', { status: 'fresh' });
    setTableBindingFreshness('tbl_2', { status: 'stale', freshRevision: 'abc' });

    expect(getTableBindingFreshness('tbl_1')).toEqual({ status: 'fresh' });
    expect(getTableBindingFreshness('tbl_2')).toEqual({ status: 'stale', freshRevision: 'abc' });
  });

  it('το «άγνωστο» αποθηκεύεται ΚΑΙ ΤΟ ΛΕΕΙ — δεν πέφτει σε `null`', () => {
    setTableBindingFreshness('tbl_1', { status: 'unknown', reason: 'source-not-wired' });

    expect(getTableBindingFreshness('tbl_1')).toEqual({
      status: 'unknown',
      reason: 'source-not-wired',
    });
  });
});

// ─── 2. Το καρέ ζητιέται μόνο όταν αλλάζει κάτι ───────────────────────────────

describe('setTableBindingFreshness — ο φύλακας ζει στον γραφέα', () => {
  it('νέα ετυμηγορία ⇒ ζητά καρέ', () => {
    setTableBindingFreshness('tbl_1', { status: 'stale', freshRevision: 'abc' });

    expect(dirty).toHaveBeenCalledTimes(1);
  });

  it('🔴 Η ΙΔΙΑ ΕΤΥΜΗΓΟΡΙΑ ΞΑΝΑ ⇒ ΚΑΝΕΝΑ ΚΑΡΕ — 20 πίνακες δεν ζητούν 20 άσκοπα καρέ', () => {
    setTableBindingFreshness('tbl_1', { status: 'stale', freshRevision: 'abc' });
    dirty.mockClear();

    setTableBindingFreshness('tbl_1', { status: 'stale', freshRevision: 'abc' });

    expect(dirty).not.toHaveBeenCalled();
  });

  it('ίδια κατάσταση αλλά ΑΛΛΟ αποτύπωμα ⇒ ζητά καρέ (η πηγή ξανακουνήθηκε)', () => {
    setTableBindingFreshness('tbl_1', { status: 'stale', freshRevision: 'abc' });
    dirty.mockClear();

    setTableBindingFreshness('tbl_1', { status: 'stale', freshRevision: 'def' });

    expect(dirty).toHaveBeenCalledTimes(1);
  });

  it('ίδιο «άγνωστο» αλλά ΑΛΛΟΣ λόγος ⇒ ζητά καρέ', () => {
    setTableBindingFreshness('tbl_1', { status: 'unknown', reason: 'source-not-wired' });
    dirty.mockClear();

    setTableBindingFreshness('tbl_1', { status: 'unknown', reason: 'source-unavailable' });

    expect(dirty).toHaveBeenCalledTimes(1);
  });

  it('μετάβαση stale → fresh ζητά καρέ (το σημάδι πρέπει να σβήσει)', () => {
    setTableBindingFreshness('tbl_1', { status: 'stale', freshRevision: 'abc' });
    dirty.mockClear();

    setTableBindingFreshness('tbl_1', { status: 'fresh' });

    expect(dirty).toHaveBeenCalledTimes(1);
  });
});

// ─── 3. Ο καθαρισμός ──────────────────────────────────────────────────────────

describe('clearTableBindingFreshness — ο πίνακας έπαψε να είναι δεμένος', () => {
  it('σβήνει την ετυμηγορία και ζητά καρέ', () => {
    setTableBindingFreshness('tbl_1', { status: 'stale', freshRevision: 'abc' });
    dirty.mockClear();

    clearTableBindingFreshness('tbl_1');

    expect(getTableBindingFreshness('tbl_1')).toBeNull();
    expect(dirty).toHaveBeenCalledTimes(1);
  });

  it('ιδεμποτής — καθαρισμός αγνώστου δεν ζητά καρέ', () => {
    clearTableBindingFreshness('tbl_ghost');

    expect(dirty).not.toHaveBeenCalled();
  });
});

// ─── 4. Το κανάλι ─────────────────────────────────────────────────────────────

describe('subscribeTableBindingFreshness — το κανάλι που ακυρώνει το bitmap cache', () => {
  it('ειδοποιεί σε αλλαγή και σιωπά σε επανάληψη', () => {
    const listener = jest.fn();
    const off = subscribeTableBindingFreshness(listener);

    setTableBindingFreshness('tbl_1', { status: 'fresh' });
    setTableBindingFreshness('tbl_1', { status: 'fresh' });

    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });

  it('η αποδέσμευση σταματά τις ειδοποιήσεις', () => {
    const listener = jest.fn();
    subscribeTableBindingFreshness(listener)();

    setTableBindingFreshness('tbl_1', { status: 'fresh' });

    expect(listener).not.toHaveBeenCalled();
  });
});
