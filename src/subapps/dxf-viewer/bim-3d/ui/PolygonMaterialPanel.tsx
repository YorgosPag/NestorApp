"use client";

/**
 * PolygonMaterialPanel — ADR-539 (Cinema 4D «Polygon Mode» material library).
 *
 * Floating βιβλιοθήκη υλικών/χρωμάτων στον 3D κάμβα. Όταν το Polygon Mode είναι ενεργό,
 * εφαρμόζεις χρώμα/υλικό με ΔΥΟ τρόπους (Cinema 4D parity):
 *   1. **click-to-apply** — επίλεξε όψη/όψεις (κλικ· Shift+κλικ multi, Φ4b) → κλικ σε swatch /
 *      «Προσαρμοσμένο χρώμα». Εφαρμόζεται σε ΟΛΕΣ τις επιλεγμένες όψεις με ΕΝΑ undo.
 *   2. **drag-drop (Φ2)** — σύρε ένα swatch πάνω στην όψη (HTML5 `application/x-bim-material`·
 *      ο drop handler ζει στο `use-polygon-drag-drop`). Το drag δουλεύει χωρίς προ-επιλογή όψης.
 *
 * Οι εφαρμογές περνούν από το shared `applyFaceAppearanceToFaces` SSoT (Φ4b batch = `CompositeCommand`
 * → ΕΝΑ undo, cross-entity· το drag-drop μένει per-face `applyFaceAppearance`). Reuse:
 * `listWallCoveringMaterials()` (catalog SSoT) + i18n labels
 * του ribbon (`dxf-viewer-shell:wallCovering.materials.*`) + `EnterpriseColorDialog` (custom
 * colour). ADR-040: leaf React component.
 *
 * @see ./apply-face-appearance.ts — apply SSoT (κοινό με drag-drop)
 * @see ./polygon-material-dnd.ts — drag MIME + serialize SSoT
 * @see bim-3d/stores/PolygonMode3DStore.ts
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EnterpriseColorDialog } from '../../ui/color/EnterpriseColorDialog';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { usePolygonMode3DStore } from '../stores/PolygonMode3DStore';
import { listWallCoveringMaterials } from '../../bim/wall-coverings/wall-covering-material-catalog';
import type { FaceAppearance } from '../../bim/types/face-appearance-types';
import { applyFaceAppearanceToFaces } from './apply-face-appearance';
import { BIM_MATERIAL_MIME, serializeFaceAppearanceDrag } from './polygon-material-dnd';

/** Default seed for the custom-colour dialog (a warm Cinema 4D red). */
const DEFAULT_CUSTOM_COLOR = '#C0392B';

export function PolygonMaterialPanel() {
  const { t } = useTranslation(['bim3d', 'dxf-viewer-shell']);
  const levels = useLevelsOptional();
  const active = usePolygonMode3DStore((s) => s.active);
  const selectedFaces = usePolygonMode3DStore((s) => s.selectedFaces);
  const [colorOpen, setColorOpen] = useState(false);
  const [customHex, setCustomHex] = useState(DEFAULT_CUSTOM_COLOR);

  if (!active) return null;

  /** Apply to ALL selected faces (click-to-apply / custom colour / clear) — Φ4b: ΕΝΑ undo. */
  const apply = (value: FaceAppearance | null): void => {
    applyFaceAppearanceToFaces(levels, usePolygonMode3DStore.getState().selectedFaces, value);
  };

  const faceCount = selectedFaces.length;
  const hasFace = faceCount > 0;

  return (
    <section
      className="absolute right-3 top-20 z-[60] w-52 select-none rounded-md border border-white/20 bg-black/60 p-2 text-white/90 backdrop-blur-sm"
      aria-label={t('polygonMode.title')}
    >
      <header className="mb-1.5">
        <h3 className="text-xs font-semibold">{t('polygonMode.title')}</h3>
        <p className="mt-0.5 text-[10px] text-white/60">
          {faceCount > 1
            ? t('polygonMode.hintMultiFace', { count: faceCount })
            : hasFace ? t('polygonMode.hintApply') : t('polygonMode.hintPickFace')}
        </p>
      </header>
      <ul className="grid grid-cols-2 gap-1">
        {listWallCoveringMaterials().map((m) => {
          const label = t(`dxf-viewer-shell:wallCovering.materials.${m.labelKeySuffix}`);
          return (
            <li key={m.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* draggable ALWAYS (Cinema 4D: drag onto any face, no pre-select needed);
                      click applies only when a face is already selected (apply() guards). */}
                  <button
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(BIM_MATERIAL_MIME, serializeFaceAppearanceDrag({ materialId: m.id }));
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => apply({ materialId: m.id })}
                    className="flex w-full cursor-grab items-center gap-1.5 rounded border border-white/15 px-1.5 py-1 text-[10px] transition-colors hover:bg-white/10 active:cursor-grabbing"
                  >
                    {/* Data-driven catalog colour → inline style (accepted N.3 exception, mirror MaterialSwatch). */}
                    <span
                      className="h-3 w-3 shrink-0 rounded-sm border border-white/30"
                      style={{ backgroundColor: m.color }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{label}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ul>
      {/* Custom colour (EnterpriseColorDialog) → apply({ colorHex }) to the selected face. */}
      <button
        type="button"
        disabled={!hasFace}
        onClick={() => setColorOpen(true)}
        className="mt-1.5 flex w-full items-center gap-1.5 rounded border border-white/15 px-1.5 py-1 text-[10px] transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span
          className="h-3 w-3 shrink-0 rounded-sm border border-white/30"
          style={{ backgroundColor: customHex }}
          aria-hidden="true"
        />
        <span className="truncate">{t('polygonMode.customColor')}</span>
      </button>
      <button
        type="button"
        disabled={!hasFace}
        onClick={() => apply(null)}
        className="mt-1 w-full rounded border border-white/15 px-1.5 py-1 text-[10px] transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {t('polygonMode.clearFace')}
      </button>

      <EnterpriseColorDialog
        isOpen={colorOpen}
        onClose={() => setColorOpen(false)}
        value={customHex}
        onChange={setCustomHex}
        onChangeEnd={(hex) => apply({ colorHex: hex })}
        title={t('polygonMode.customColorTitle')}
      />
    </section>
  );
}
