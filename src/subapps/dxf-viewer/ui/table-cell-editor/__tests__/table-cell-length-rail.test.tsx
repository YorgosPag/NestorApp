/**
 * 🔴 ADR-833 Φ5Β — **Η ΤΕΛΕΥΤΑΙΑ ΔΙΑΔΡΟΜΗ ΤΗΣ ΠΟΡΤΑΣ 6: ο επεξεργαστής κελιού.**
 *
 * Η ερώτηση που φυλάει: **«μπορεί να μπει στο κελί κείμενο που δεν εξάγεται;»**
 *
 * Ο γραφέας (`writeCellInput`) κόβει στους 32.767 σε **κάθε** διαδρομή — αλλά η δέσμευση του
 * κελιού **δεν έχει κανάλι αναφοράς**: η επικόλληση περιοχής λέει `clippedTextCells`, η
 * εισαγωγή `.xlsx` λέει `sheetsDropped`, ενώ ο επεξεργαστής θα έκοβε **χωρίς να το πει
 * κανείς**. Δηλαδή η «σιωπηλή απώλεια» του §5.6.5 στην **πιο πιθανή** διαδρομή: επικόλληση
 * παραγράφου μέσα σε ένα κελί.
 *
 * 🔑 Η απάντηση είναι το σχήμα του **Excel**: το πεδίο **παύει να δέχεται**. Ό,τι δεν μπήκε
 * ποτέ δεν χάθηκε ποτέ — και δεν χρειάζεται μήνυμα.
 *
 * @see ui/table-cell-editor/use-table-cell-input-guard.ts
 */

import { renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { useTableCellInputGuard } from '../use-table-cell-input-guard';
import { MAX_TABLE_CELL_CHARACTERS } from '../../../bim/table/table-ooxml-limits';
import type { TableRichTextField } from '../../components/table-text-menu/table-text-toolbar-types';

/** Πεδίο `contenteditable` με δεδομένο περιεχόμενο, δεμένο στο έγγραφο (χρειάζεται επιλογή). */
function mountField(text: string): TableRichTextField {
  const field = document.createElement('div');
  field.setAttribute('contenteditable', 'plaintext-only');
  field.textContent = text;
  document.body.appendChild(field);
  return field;
}

/** Στήνει τον φρουρό πάνω σε **αυτό** το πεδίο, με τον δηλωμένο τρόπο. */
function guard(field: TableRichTextField, readOnly = false): void {
  renderHook(() => {
    const ref = useRef<TableRichTextField | null>(field);
    useTableCellInputGuard(ref, readOnly);
  });
}

/** Μια μεταβολή περιεχομένου όπως τη στέλνει ο browser — **ακυρώσιμη**, αλλιώς δεν μετρά. */
function beforeInput(field: TableRichTextField, data: string): InputEvent {
  const event = new InputEvent('beforeinput', {
    data,
    inputType: 'insertText',
    cancelable: true,
    bubbles: true,
  });
  field.dispatchEvent(event);
  return event;
}

afterEach(() => {
  document.body.innerHTML = '';
  window.getSelection()?.removeAllRanges();
});

describe('🔴 Η ΡΑΓΑ ΤΟΥ ΚΕΛΙΟΥ: η απώλεια γίνεται ΑΔΥΝΑΤΗ, όχι σιωπηλή', () => {
  it('συνηθισμένη πληκτρολόγηση περνά ανέγγιχτη — ο φρουρός δεν ενοχλεί κανέναν', () => {
    const field = mountField('Δοκός Δ');
    guard(field);
    expect(beforeInput(field, '1').defaultPrevented).toBe(false);
  });

  it('🔴 επικόλληση που ΞΕΠΕΡΝΑ τη ράγα ΑΠΟΡΡΙΠΤΕΤΑΙ — δεν μπαίνει για να κοπεί μετά', () => {
    const field = mountField('α'.repeat(MAX_TABLE_CELL_CHARACTERS - 5));
    guard(field);
    expect(beforeInput(field, 'x'.repeat(10)).defaultPrevented).toBe(true);
  });

  it('🔑 …ενώ ΑΚΡΙΒΩΣ όσο χωρά περνά: το όριο δεν είναι «περίπου»', () => {
    const field = mountField('α'.repeat(MAX_TABLE_CELL_CHARACTERS - 5));
    guard(field);
    expect(beforeInput(field, 'x'.repeat(5)).defaultPrevented).toBe(false);
  });

  it('🔴 Η ΔΙΑΓΡΑΦΗ ΔΕΝ ΦΡΑΣΣΕΤΑΙ ΠΟΤΕ — αλλιώς το γεμάτο κελί θα ήταν φυλακή', () => {
    // Ένα κελί **πάνω** από τη ράγα (φτιαγμένο πριν τη Φ5Β, ή από παλιό αρχείο) πρέπει να
    // μπορεί να **μικρύνει**. Φρουρός που αρνείται τα πάντα θα το καθιστούσε αδιόρθωτο.
    const field = mountField('α'.repeat(MAX_TABLE_CELL_CHARACTERS + 100));
    guard(field);
    const remove = new InputEvent('beforeinput', {
      inputType: 'deleteContentBackward',
      cancelable: true,
      bubbles: true,
    });
    field.dispatchEvent(remove);
    expect(remove.defaultPrevented).toBe(false);
  });

  it('🔑 το ΜΑΡΚΑΡΙΣΜΕΝΟ κείμενο αφαιρείται: αντικατάσταση όλου του κελιού επιτρέπεται', () => {
    // Χωρίς αυτό, μια επικόλληση που **αντικαθιστά** ό,τι υπάρχει θα απορριπτόταν παρότι
    // το αποτέλεσμα χωρά μια χαρά — άρνηση σε πράξη που δεν μεγαλώνει τίποτα.
    const field = mountField('α'.repeat(MAX_TABLE_CELL_CHARACTERS));
    guard(field);
    const range = document.createRange();
    range.selectNodeContents(field);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(beforeInput(field, 'Κ12').defaultPrevented).toBe(false);
  });

  it('🔴 δεμένο κελί: ΤΙΠΟΤΑ δεν γράφεται — ο παλιός φρουρός μένει ακέραιος (ADR-767 Δ1)', () => {
    const field = mountField('Κ12');
    guard(field, true);
    expect(beforeInput(field, 'α').defaultPrevented).toBe(true);
    const remove = new InputEvent('beforeinput', {
      inputType: 'deleteContentBackward',
      cancelable: true,
      bubbles: true,
    });
    field.dispatchEvent(remove);
    expect(remove.defaultPrevented).toBe(true);
  });
});
