/**
 * ADR-344 Phase 6.A — Diff helpers for text commands.
 *
 * Shallow field comparison used by Update*Command to emit audit entries
 * with field-level before/after pairs. Deep equality is intentionally
 * not used here: callers either pass primitive patches (style/geometry)
 * or whole-AST replacements (paragraph), and a shallow check is enough
 * to detect "no-op patches" and keep the audit trail useful.
 */

import type { DxfTextAuditChange } from './types';

export function buildShallowDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): DxfTextAuditChange[] {
  const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
  const changes: DxfTextAuditChange[] = [];
  for (const key of keys) {
    const oldValue = before[key];
    const newValue = after[key];
    if (oldValue === newValue) continue;
    changes.push({ field: key, oldValue, newValue });
  }
  return changes;
}
