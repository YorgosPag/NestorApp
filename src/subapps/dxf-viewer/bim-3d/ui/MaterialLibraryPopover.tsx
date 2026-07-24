'use client';

/**
 * MaterialLibraryPopover — ADR-687 Φ8. Το popover «Βιβλιοθήκη» της κάτω μπάρας (Ν.2): αφού η μπάρα
 * δείχνει ΜΟΝΟ τα υλικά της σκηνής, από εδώ ο χρήστης διαλέγει ΟΠΟΙΟΔΗΠΟΤΕ υλικό της γενικής
 * βιβλιοθήκης (Revit «Paint → Material Browser» / C4D Content Browser) → κλικ = apply → μπαίνει στη
 * σκηνή. Reuse του κοινού index (`buildMaterialLibraryEntries`) + `MaterialEntryButton` (μηδέν clone).
 *
 * @see ./PolygonMaterialPanel.tsx — consumer (κάτω μπάρα)
 * @see ./material-library-index.ts — η γενική βιβλιοθήκη (SSoT)
 */

import { useMemo } from 'react';
import type { TFunction } from 'i18next';
import { X } from 'lucide-react';
import type { BimMaterial } from '../../bim/types/bim-material-types';
import type { FaceAppearance } from '../../bim/types/face-appearance-types';
import { buildMaterialLibraryEntries } from './material-library-index';
import { MaterialEntryButton } from './MaterialEntryButton';

interface MaterialLibraryPopoverProps {
  readonly library: readonly BimMaterial[];
  readonly t: TFunction;
  readonly onApply: (value: FaceAppearance) => void;
  readonly onClose: () => void;
}

export function MaterialLibraryPopover({ library, t, onApply, onClose }: MaterialLibraryPopoverProps) {
  const entries = useMemo(() => buildMaterialLibraryEntries(library, t), [library, t]);

  return (
    <>
      {/* Click-away backdrop (a11y: labelled close button). */}
      <button
        type="button"
        aria-label={t('polygonMode.libraryClose')}
        onClick={onClose}
        className="fixed inset-0 z-[59] cursor-default bg-transparent"
      />
      <section
        aria-label={t('polygonMode.libraryTitle')}
        className="absolute inset-x-0 bottom-full z-[61] max-h-[42vh] overflow-y-auto border-t border-white/20 bg-black/85 px-3 py-2 text-white/90 backdrop-blur-sm"
      >
        <header className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-semibold">{t('polygonMode.libraryTitle')}</h4>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('polygonMode.libraryClose')}
            className="rounded border border-white/15 p-1 transition-colors hover:bg-white/10"
          >
            <X size={12} />
          </button>
        </header>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-2">
          {entries.map((entry) => (
            <li key={entry.id}>
              <MaterialEntryButton
                entry={entry}
                onApply={onApply}
                className="flex w-full cursor-pointer flex-col items-center gap-1 rounded border border-white/15 p-1 text-[9px] transition-colors hover:bg-white/10"
                swatchClassName="h-9 w-9 shrink-0 rounded-sm border border-white/30"
              />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
