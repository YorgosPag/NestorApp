'use client';

import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';
import { FullscreenToggleButton } from './FullscreenToggleButton';
import { useStableHost } from './fullscreen/use-stable-host';
import { useFullscreenOpener, useFullscreenSurface } from './fullscreen/use-fullscreen-surface';

export { FullscreenToggleButton } from './FullscreenToggleButton';

// =============================================================================
// 🏢 ENTERPRISE: FullscreenOverlay (ADR-241)
// =============================================================================
//
// Μία ΕΠΙΦΑΝΕΙΑ πλήρους οθόνης που δεν ξαναχτίζει ποτέ τα παιδιά της.
//
//  - Σταθερός ξενιστής (`useStableHost`): τα παιδιά αποδίδονται ΠΑΝΤΑ με portal στον ίδιο ξενιστή, και ο ξενιστής
//    μετακινείται ανάμεσα στη θέση του μέσα στη σελίδα και στην επιφάνεια. 🔴 Ως 2026-09-11 το component επέστρεφε
//    `<section>` ή `createPortal` — άλλη θέση στο δέντρο ⇒ remount σε κάθε εναλλαγή (μετρημένο: πεδίο «Ανάθεση»
//    χαμένο στα Νομικά, 4/4 καμβάδες του DXF ξαναστημένοι), παρά το σχόλιο «Children are NOT remounted».
//  - Συμπεριφορά επιφάνειας (`useFullscreenSurface`): ένα Esc = ένα πλαίσιο προς τα έξω, αδράνεια ό,τι είναι έξω,
//    focus μέσα στην είσοδο και πίσω στον opener στην έξοδο, κλείδωμα κύλισης.
//  - Η επιφάνεια μένει ΠΑΝΤΑ προσαρτημένη (`hidden` όταν δεν χρειάζεται): αν ξεπροσαρτιόταν στην έξοδο, το React θα
//    την αφαιρούσε από το DOM ΠΡΙΝ τρέξουν οι layout effects, με τον ξενιστή μέσα της.
//  - Στρώση = ρόλος `fullscreenSurface` της κλίμακας (ADR-780 Φάση Δ): κάτω από την παροδική οικογένεια, κάτω από
//    την πλωτή παλέτα του DXF.
//  - `role="dialog"` + ετικέτα, ΧΩΡΙΣ `aria-modal`: μια επιφάνεια με συνοδό έξω από αυτήν (η πλωτή παλέτα του DXF)
//    δεν επιτρέπεται να δηλώνει ότι τα πάντα έξω είναι αδρανή — αυτό το επιβάλλει πραγματικά το `inert` (ADR-711).
//
// Για πλήρη οθόνη βασισμένη σε διάλογο: `<Dialog>` + `<DialogContent size="fullscreen">` (composition).
// =============================================================================

export interface FullscreenOverlayProps {
  /** Children rendered inside the container */
  children: React.ReactNode;
  /** Whether fullscreen is active */
  isFullscreen: boolean;
  /** Toggle callback */
  onToggle: () => void;
  /** Optional header content rendered in fullscreen mode */
  headerContent?: React.ReactNode;
  /** Additional className on the container wrapper */
  className?: string;
  /** Additional className applied only when in fullscreen */
  fullscreenClassName?: string;
  /** Accessible label for the fullscreen region */
  ariaLabel?: string;
}

/** Η επιφάνεια: σταθερή στήλη που γεμίζει το παράθυρο — κεφαλίδα που δεν συρρικνώνεται + σώμα που κυλά. */
const SURFACE_CLASS = 'fixed inset-0 z-[var(--z-index-fullscreen-surface)] flex flex-col';

/**
 * Το σώμα της επιφάνειας = ο ξενιστής των παιδιών. **Block** (όχι flex) και ο ΜΟΝΟΣ scroll container: ποτέ δεν
 * συρρικνώνει τα παιδιά του (η κεφαλίδα του Πίνακα Ελέγχου Χρονοδιαγράμματος μετρήθηκε ύψος 0 όταν η επιφάνεια ήταν
 * η ίδια στήλη flex που κυλούσε — ADR-332 D27 Ζ8). Όποιος καταναλωτής θέλει διάταξη flex τη ζητά ρητά.
 */
const SURFACE_BODY_CLASS = 'min-h-0 flex-1 overflow-y-auto';

export function FullscreenOverlay({
  children,
  isFullscreen,
  onToggle,
  headerContent,
  className,
  fullscreenClassName,
  ariaLabel,
}: FullscreenOverlayProps) {
  const colors = useSemanticColors();
  // ⚠️ Σειρά δήλωσης = σειρά των layout effects: ο opener πριν μετακινηθεί ο ξενιστής, η επιφάνεια μετά.
  const openerRef = useFullscreenOpener(isFullscreen);
  const surfaceRef = useRef<HTMLElement | null>(null);
  const { host, inlineSlotRef, surfaceSlotRef } = useStableHost({
    isFullscreen,
    inlineClassName: className ?? '',
    fullscreenClassName: cn(SURFACE_BODY_CLASS, fullscreenClassName),
    ariaLabel,
  });
  useFullscreenSurface({ isFullscreen, ready: host !== null, onExit: onToggle, surfaceRef, openerRef });

  const surface = (
    <section
      ref={surfaceRef}
      className={isFullscreen ? cn(SURFACE_CLASS, colors.bg.primary) : undefined}
      hidden={!isFullscreen}
      role="dialog"
      aria-label={ariaLabel}
      tabIndex={-1}
      data-fullscreen-surface=""
    >
      {headerContent && (
        <header className="flex items-center justify-between shrink-0 border-b px-2 py-2">
          <span className="flex items-center gap-2">{headerContent}</span>
          <FullscreenToggleButton isFullscreen onToggle={onToggle} />
        </header>
      )}
      <div ref={surfaceSlotRef} className="contents" />
    </section>
  );

  return (
    <>
      <div ref={inlineSlotRef} className="contents" />
      {host && createPortal(surface, document.body)}
      {host && createPortal(children, host)}
    </>
  );
}
