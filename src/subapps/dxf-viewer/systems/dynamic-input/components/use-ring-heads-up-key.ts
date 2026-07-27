/**
 * use-ring-heads-up-key — ADR-513 §direct-distance-entry (AutoCAD heads-up), extracted from
 * `RadialCommandRing.tsx` (N.7.1 SRP file-size split; the component owns layout, this owns the
 * one window-level accelerator it installs).
 *
 * With the ring mounted and NO popup open, a digit / decimal point / sign auto-opens the heads-up
 * field seeded with that key (the first digit REPLACES). Capture-phase + `stopPropagation` so it
 * wins over the rest of the keyboard listeners — but never steals a character from an element that
 * would consume it.
 *
 * ⚠️ ADR-711 §5.6 — the previous local check *claimed* to respect the «ribbon combobox» while
 * asking `tagName`: the app's canonical Radix dropdown is a `<button role="combobox">` (ADR-001,
 * 237 files), so the claim was false for every one of them. The question is asked by ROLE now,
 * through the `keyboard-scope` SSoT — and it is deliberately `focusConsumesTypedCharacters`
 * («will this element eat the printable character?»), NOT `isTextEntryFocused` («is the user
 * entering text?»): a `<select>` answers yes to the first and no to the second.
 */

import { useEffect } from 'react';
import { focusConsumesTypedCharacters } from '@/lib/a11y/keyboard-scope';
import { isHeadsUpNumericKey } from './radial-command-ring-helpers';
import type { RingFieldDef } from '../ring-config';

export interface RingHeadsUpKeyDeps {
  /** Non-null ⇒ a popup already owns the typing; the accelerator stays out of the way. */
  readonly openField: string | null;
  /** ADR-513 §rectangle — tool-agnostic target field (line/wall → «Μήκος», rectangle → «Πλάτος»). */
  readonly headsUpFieldKey: string | undefined;
  readonly fieldByKey: ReadonlyMap<string, RingFieldDef>;
  /** Open `key`'s popup seeded with the pressed character. */
  readonly onOpen: (key: string, seed: string) => void;
}

export function useRingHeadsUpKey({ openField, headsUpFieldKey, fieldByKey, onOpen }: RingHeadsUpKeyDeps): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (openField !== null) return; // popup ανοιχτό → το input χειρίζεται την πληκτρολόγηση
      if (!isHeadsUpNumericKey(e)) return;
      if (focusConsumesTypedCharacters()) return;
      const key = headsUpFieldKey ?? 'length';
      const field = fieldByKey.get(key);
      if (!field || field.kind !== 'numeric') return; // δεν υπάρχει numeric heads-up → no-op
      e.preventDefault();
      e.stopPropagation();
      onOpen(key, e.key);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [fieldByKey, openField, headsUpFieldKey, onOpen]);
}
