'use client';

/**
 * StatusBarActiveBlockLeaf — ADR-641 §3 status-bar breadcrumb for the Block Editor (BEDIT).
 *
 * While the user is INSIDE a block (AutoCAD «Block Editor»), shows «Επεξεργασία μπλοκ «name» · Esc
 * για έξοδο» plus a clickable «Κλείσιμο» button, so the exclusive-editor state is legible and the
 * exit is discoverable by mouse as well as by Esc. Mirror of {@link StatusBarActiveGroupLeaf}, with
 * the added clickable Close (blocks are a modal editor, not just a drill-in). Both the button and the
 * Esc handler ({@link useBlockEditorExitEscape}) call the SAME {@link exitBlockEditAndReselect} SSoT.
 *
 * ADR-040 micro-leaf: subscribes ONLY to the active block's name (low-freq — one transition per
 * enter/exit gesture, never 60fps), so the status-bar shell does not re-render on cursor activity.
 * Renders nothing at the top scene level.
 */

import { useTranslation } from '@/i18n';
import { useActiveBlockEditName } from '../../systems/block/useActiveBlockEdit';
import { exitBlockEditAndReselect } from '../../systems/block/exit-block-editor';

interface StatusBarActiveBlockLeafProps {
  className?: string;
  separatorClassName?: string;
}

/** Inline «Επεξεργασία μπλοκ «name» · Esc για έξοδο» + clickable Close while inside a block, else nothing. */
export function StatusBarActiveBlockLeaf({ className, separatorClassName }: StatusBarActiveBlockLeafProps) {
  const { t } = useTranslation('dxf-viewer');
  const name = useActiveBlockEditName();
  if (name === null) return null;

  return (
    <>
      <span className={separatorClassName}>|</span>
      <span className={className}>
        {t('activeBlock.editingActive', { name })} · {t('activeBlock.editingHint')}
      </span>
      <button
        type="button"
        className={`${className ?? ''} underline underline-offset-2`}
        onClick={exitBlockEditAndReselect}
      >
        {t('activeBlock.close')}
      </button>
    </>
  );
}
