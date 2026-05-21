// ============================================================================
// ♿ STATUS BAR TEXT GENERATOR — Accessibility (ADR-366 Phase 4.5 / A.7.Q3)
// ============================================================================
//
// Pure utility producing localized status-bar messages for selection / focus
// feedback. WCAG 1.4.1 — color is NEVER the sole signal: every color-coded
// selection delta is mirrored as text. Accepts i18n `t()` injected from the
// caller (no react-i18next dependency here → pure + trivially testable).
//
// Entity-type labels reuse the existing `bim3d.entityTypes.*` namespace so
// el ↔ en stay in sync without duplicate keys.
// ============================================================================

export type EntityTypeKey = 'wall' | 'column' | 'beam' | 'slab';

/** Minimal i18n contract — matches react-i18next's `t` (key + optional vars). */
export type TFn = (key: string, vars?: Record<string, unknown>) => string;

/** Maps raw `bimType` strings emitted by raycaster / store to canonical keys. */
export function normalizeEntityType(rawType: string | null | undefined): EntityTypeKey | null {
  if (!rawType) return null;
  const lower = rawType.toLowerCase();
  if (lower === 'wall' || lower === 'walls') return 'wall';
  if (lower === 'column' || lower === 'columns') return 'column';
  if (lower === 'beam' || lower === 'beams') return 'beam';
  if (lower === 'slab' || lower === 'slabs') return 'slab';
  return null;
}

/** Returns localized entity-type label, or empty string when type unrecognized. */
export function entityTypeLabel(rawType: string | null | undefined, t: TFn): string {
  const key = normalizeEntityType(rawType);
  if (!key) return '';
  return t(`entityTypes.${key}`);
}

/**
 * Focus status text — fires when Tab/Shift+Tab moves the focus ring.
 * Format: "Εστιασμένο: Τοίχος Wall_A12" (el) / "Focused: Wall Wall_A12" (en).
 */
export function generateFocusStatusText(
  bimType: string | null | undefined,
  entityName: string | null | undefined,
  t: TFn,
): string {
  if (!bimType && !entityName) return t('accessibility.status.focusCleared');
  const typeLabel = entityTypeLabel(bimType, t);
  const safeName = entityName ?? '';
  if (typeLabel && safeName) {
    return t('accessibility.status.focused', { type: typeLabel, name: safeName });
  }
  if (typeLabel) return t('accessibility.status.focusedTypeOnly', { type: typeLabel });
  if (safeName) return t('accessibility.status.focusedNameOnly', { name: safeName });
  return t('accessibility.status.focusedUnknown');
}

/**
 * Selection delta — "+1 added" / "-1 removed" — transient toast (3s auto-dismiss
 * is the caller's responsibility; this util only formats the text).
 */
export function generateSelectionDeltaText(
  delta: number,
  t: TFn,
): string {
  if (delta > 0) return t('accessibility.status.selectionAdded', { count: delta });
  if (delta < 0) return t('accessibility.status.selectionRemoved', { count: Math.abs(delta) });
  return '';
}

/** Total selection count — for persistent status bar slot. */
export function generateSelectionCountText(count: number, t: TFn): string {
  if (count <= 0) return t('accessibility.status.selectionNone');
  return t('accessibility.status.selectionCount', { count });
}
