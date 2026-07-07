'use client';

/**
 * StatusBarActiveGroupLeaf — ADR-575 §enter-group status-bar breadcrumb.
 *
 * While the user is INSIDE a group (Revit «Edit Group» / Figma enter-group), shows
 * «Επεξεργασία ομάδας · Esc για έξοδο» (or «… · επίπεδο N» when drilled into a nested
 * group), so the modal drill-in state is legible and the exit affordance is discoverable.
 * Mirrors {@link StatusBarGroupSelectionLeaf}.
 *
 * ADR-040 micro-leaf: subscribes ONLY to the drill-in stack (low-freq — one transition
 * per enter/exit gesture, never 60fps), so the status-bar shell does not re-render on
 * cursor activity. Renders nothing at the top scene level.
 */

import { useTranslation } from '@/i18n';
import { useActiveGroupStack } from '../../systems/group/useActiveGroup';

interface StatusBarActiveGroupLeafProps {
  className?: string;
  separatorClassName?: string;
}

/** Inline «Επεξεργασία ομάδας · Esc για έξοδο» while inside a group, or nothing. */
export function StatusBarActiveGroupLeaf({ className, separatorClassName }: StatusBarActiveGroupLeafProps) {
  const { t } = useTranslation('dxf-viewer');
  const stack = useActiveGroupStack();
  if (stack.length === 0) return null;

  const label = stack.length > 1
    ? t('groupSelection.editingNested', { level: stack.length })
    : t('groupSelection.editingActive');

  return (
    <>
      <span className={separatorClassName}>|</span>
      <span className={className}>{label} · {t('groupSelection.editingHint')}</span>
    </>
  );
}
