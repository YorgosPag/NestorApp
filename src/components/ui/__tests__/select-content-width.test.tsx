/**
 * @fileoverview **ΠΟΙΟΣ ΑΠΟΦΑΣΙΖΕΙ ΤΟ ΠΛΑΤΟΣ ΤΗΣ ΛΙΣΤΑΣ;** — ADR-001 «Content width».
 * @related components/ui/select.tsx · SPEC-242C (επιλογή έργου στον «Τοίχο Λήξης Χρέους»)
 *
 * Η προεπιλογή (`trigger`) μένει ακριβώς όπως ήταν — 249 καταναλωτές στηρίζονται στην
 * ευθυγράμμιση. Το `width="content"` αφήνει τη λίστα να μεγαλώσει ως τη μεγαλύτερη ετικέτα,
 * με όριο, και ό,τι ξεπερνά το όριο **τυλίγεται** αντί να κοπεί.
 *
 * ⚠️ Το jsdom δεν μετρά πλάτη: φυλάγεται το **συμβόλαιο** (ποιες κλάσεις φτάνουν στο DOM).
 * Η οπτική επιβεβαίωση έγινε σε ζωντανή οθόνη (SPEC-242C §9).
 */

import React from 'react';
import { render } from '@testing-library/react';

import { Select, SelectContent, SelectItem, SelectTrigger, type SelectContentWidth } from '../select';

const LONG_LABEL = 'ΕΡΓΟ ΙΩΑΝΝΙΝΩΝ — Συγκρότημα κατοικιών με υπόγειο χώρο στάθμευσης';

function renderOpen(width?: SelectContentWidth): { listbox: HTMLElement; label: HTMLElement } {
  render(
    <Select open>
      <SelectTrigger>τ</SelectTrigger>
      <SelectContent width={width}>
        <SelectItem value="a">{LONG_LABEL}</SelectItem>
      </SelectContent>
    </Select>,
  );
  const listbox = document.querySelector('[role="listbox"]');
  const option = document.querySelector('[role="option"]');
  const label = option?.querySelector('span.flex-1');
  if (!(listbox instanceof HTMLElement) || !(label instanceof HTMLElement)) {
    throw new Error('η λίστα δεν αποδόθηκε');
  }
  return { listbox, label };
}

describe('Π — ο παρονομαστής', () => {
  it('Π1 — η ετικέτα αποδίδεται ολόκληρη και στις δύο λειτουργίες', () => {
    expect(renderOpen().label.textContent).toBe(LONG_LABEL);
  });
});

describe('Τ — προεπιλογή `trigger`: αμετάβλητη', () => {
  it('Τ1 — πλάτος ακριβώς του ενεργοποιητή, ετικέτα με αποσιωπητικά', () => {
    const { listbox, label } = renderOpen();
    expect(listbox.classList.contains('w-[var(--radix-select-trigger-width)]')).toBe(true);
    expect(listbox.classList.contains('w-auto')).toBe(false);
    expect(label.classList.contains('truncate')).toBe(true);
  });
});

describe('Π — `content`: όσο η ετικέτα, με όριο, χωρίς κρυμμένο κείμενο', () => {
  it('Π2 — ποτέ στενότερη από τον ενεργοποιητή, ποτέ φαρδύτερη από το όριο/την οθόνη', () => {
    const { listbox } = renderOpen('content');
    expect(listbox.className).toContain('w-auto');
    expect(listbox.className).toContain('min-w-[var(--radix-select-trigger-width)]');
    expect(listbox.className).toContain('max-w-[min(28rem,var(--radix-select-content-available-width))]');
    expect(listbox.classList.contains('w-[var(--radix-select-trigger-width)]')).toBe(false);
  });

  it('Π3 — στο όριο η ετικέτα τυλίγεται, δεν κόβεται', () => {
    const { label } = renderOpen('content');
    expect(label.classList.contains('truncate')).toBe(false);
    expect(label.classList.contains('whitespace-normal')).toBe(true);
    expect(label.classList.contains('min-w-0')).toBe(true);
  });
});
