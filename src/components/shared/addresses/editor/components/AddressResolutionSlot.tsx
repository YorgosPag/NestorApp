'use client';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import {
  AddressReconciliationPanel,
  type AddressReconciliationPanelProps,
} from './AddressReconciliationPanel';
import {
  AddressSuggestionsPanel,
  type AddressSuggestionsPanelProps,
} from './AddressSuggestionsPanel';

/**
 * Owns the vertical band that the two asynchronous resolution panels
 * (reconciliation / suggestions) occupy, and keeps that band from changing the
 * Y position of everything below it while the user is aiming at a control.
 *
 * ## Why this exists
 *
 * Both panels mount inline, roughly two seconds after the last keystroke, when
 * reverse geocoding returns. Everything beneath them — the activity log, the
 * form's own children, the surrounding dialog's actions — is pushed down at
 * that moment. A user aiming at «Άφησέ τα όλα» hit Save instead and the contact
 * was written. That is measurable CLS with a real failure attached, not a
 * cosmetic detail.
 *
 * ## Why reservation rather than animation or measurement
 *
 * The editor FSM (`AddressEditorState`) announces a resolution *before* it
 * lands: `typing` → `debouncing` → `loading` → `conflict` | `suggestions`. So
 * the band can be reserved while the caret is still in a field — the one moment
 * when a reflow costs the user nothing, because the pointer is not yet on a
 * button. By the time the panel materialises, the space is already its own.
 *
 * The residual shift is not zero: a panel taller than {@link RESERVED_BAND}
 * still grows the band on arrival. It is bounded and it happens in the same
 * frame as the panel becoming visible, whereas the shift it replaces happened
 * silently under a moving cursor. A measured latch (ResizeObserver → explicit
 * pixel height) would close the gap fully but needs a per-element inline style,
 * which N.3 forbids.
 *
 * An entry animation was rejected outright: it hides the movement without
 * removing it, so the click can still land on the wrong element mid-transition.
 */

/**
 * Height held open while a resolution is in flight. Sized to the reconciliation
 * panel at three conflicting fields — header, column captions, three rows and
 * the footer — which is the common case for a Greek street + postal code.
 */
const RESERVED_BAND = 'min-h-[12rem]';

export interface AddressResolutionSlotProps {
  /** FSM is heading towards a panel: `typing` / `debouncing` / `loading`. */
  reserving: boolean;
  showReconciliation: boolean;
  showSuggestions: boolean;
  reconciliation: AddressReconciliationPanelProps;
  suggestions: AddressSuggestionsPanelProps;
  /** Commits the reconciliation once every field has a decision. */
  onMergeConfirm: () => void;
  className?: string;
}

export function AddressResolutionSlot({
  reserving,
  showReconciliation,
  showSuggestions,
  reconciliation,
  suggestions,
  onMergeConfirm,
  className,
}: AddressResolutionSlotProps) {
  const { t } = useTranslation('addresses');

  const occupied = showReconciliation || showSuggestions;

  // Collapse only once the cycle is fully over. Releasing the band between two
  // panels — reconciliation resolved, suggestions still arriving — would
  // reintroduce exactly the shift this component removes.
  const holdsSpace = reserving || occupied;

  return (
    <section
      aria-live="polite"
      aria-busy={reserving && !occupied}
      className={cn('space-y-2', holdsSpace && RESERVED_BAND, className)}
    >
      {showReconciliation && (
        <div className="space-y-2">
          <AddressReconciliationPanel {...reconciliation} />
          {reconciliation.resolved && (
            <Button size="sm" onClick={onMergeConfirm}>
              {t('editor.reconciliation.applyAll')}
            </Button>
          )}
        </div>
      )}

      {showSuggestions && <AddressSuggestionsPanel {...suggestions} />}

      {/* Reserved but not yet filled. A bare 12rem hole reads as a layout bug;
          a skeleton reads as "something lands here". No label — the editor
          chrome already renders the phase, and repeating it would be noise. */}
      {reserving && !occupied && (
        <div aria-hidden className="space-y-2 pt-1">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-6 w-5/6" />
          <Skeleton className="h-6 w-2/3" />
        </div>
      )}
    </section>
  );
}
