/**
 * RadialCommandRing — pure helpers (predicates + inline style builders).
 *
 * Εξήχθησαν από το `RadialCommandRing.tsx` (file-size SRP, N.7.1, 2026-07-06): stateless
 * predicates (heads-up numeric key, editable target) + inline cursor-follow/anchor style
 * builders. Testable χωρίς DOM/React· το component τα καταναλώνει, δεν κρατούν state.
 *
 * @see ./RadialCommandRing — the consuming component
 * @see ADR-513 — Δαχτυλίδι Εντολών
 */

import type React from 'react';
import { portalComponents } from '@/styles/design-tokens';

/**
 * ADR-513 §direct-distance-entry — pure predicate: ένα πλήκτρο ενεργοποιεί το heads-up άνοιγμα του
 * «Μήκος» (AutoCAD direct distance entry). Δεκτά: ψηφία 0-9, δεκαδικό (`.`/`,`), πρόσημο (`-`) —
 * ΧΩΡΙΣ ctrl/alt/meta (ώστε shortcuts όπως Ctrl+1 να μην κλέβονται). Testable χωρίς DOM.
 */
export function isHeadsUpNumericKey(
  e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'metaKey'>,
): boolean {
  if (e.ctrlKey || e.altKey || e.metaKey) return false;
  return /^[0-9.,-]$/.test(e.key);
}

/** `true` αν το element δέχεται πληκτρολόγηση (input/textarea/select/contentEditable) → μη το κλέψεις. */
export function isEditableTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return (el as HTMLElement).isContentEditable === true;
}

/** Inline cursor-follow box (px). Κεντραρισμένο στο δαχτυλίδι. */
export function boxStyle(x: number, y: number, box: number): React.CSSProperties {
  return {
    left: `${x}px`,
    top: `${y}px`,
    width: `${box}px`,
    height: `${box}px`,
    zIndex: portalComponents.overlay.controls.zIndex() + 90,
  };
}

/** Θέση popup στο anchor του wedge (px εντός του box). */
export function anchorStyle(x: number, y: number): React.CSSProperties {
  return { left: `${x}px`, top: `${y}px` };
}
