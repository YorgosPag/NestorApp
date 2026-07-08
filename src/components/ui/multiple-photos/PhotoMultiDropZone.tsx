'use client';

import React from 'react';
import { TRANSITION_PRESETS } from '@/components/ui/effects';
import { PHOTO_COLORS, PHOTO_BORDERS } from '@/components/generic/config/photo-config';
import { layoutUtilities } from '@/styles/design-tokens';

// ============================================================================
// SSoT: shared bulk-upload drop zone for MultiplePhotos variants (ADR-596)
// ----------------------------------------------------------------------------
// The dashed empty-state zone + drag/drop wiring + hidden file-input onClick was
// duplicated verbatim across compact & full. Only the inner content (icon + copy)
// and padding differ → injected via children/props, NO variant branching here.
// ============================================================================

export interface PhotoMultiDropZoneProps {
  /** Bulk drop handler (also invoked by the synthetic file-input pick). */
  onDropFiles: (e: React.DragEvent<HTMLDivElement>) => void;
  disabled?: boolean;
  /** Padding class — compact 'p-3' vs full 'p-6'. */
  padding: string;
  /** Accessible label for the drop affordance. */
  ariaLabel: string;
  /** Injected content (icon + copy) per variant. */
  children: React.ReactNode;
}

/**
 * Shared drop/click upload affordance for multi-photo grids.
 * Renders a semantic `<aside role="button">` (unifies compact's semantic markup
 * with full's former `<div>`, fixing N.4 div-soup on the full path).
 */
export function PhotoMultiDropZone({
  onDropFiles,
  disabled,
  padding,
  ariaLabel,
  children,
}: PhotoMultiDropZoneProps) {
  return (
    <aside
      className={`${PHOTO_BORDERS.EMPTY_STATE} rounded-lg flex items-center justify-center text-center cursor-pointer ${TRANSITION_PRESETS.STANDARD_COLORS} ${PHOTO_BORDERS.EMPTY_HOVER} ${padding} mt-8`}
      style={layoutUtilities.dxf.colors.backgroundColor(
        PHOTO_COLORS.EMPTY_STATE_BACKGROUND
      )}
      onDrop={onDropFiles}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      role="button"
      aria-label={ariaLabel}
      onClick={() => {
        if (disabled) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.onchange = (e) => {
          const files = Array.from((e.target as HTMLInputElement).files || []);
          if (files.length > 0) {
            // Simulate drop event so both paths converge on onDropFiles
            const dropEvent = new DragEvent('drop', {
              dataTransfer: new DataTransfer()
            });
            files.forEach(file => dropEvent.dataTransfer!.items.add(file));
            onDropFiles(dropEvent as unknown as React.DragEvent<HTMLDivElement>);
          }
        };
        input.click();
      }}
    >
      {children}
    </aside>
  );
}
