"use client";

/**
 * PolygonMaterialPanel — ADR-539 (Cinema 4D «Polygon Mode» material library).
 *
 * Floating βιβλιοθήκη υλικών/χρωμάτων στον 3D κάμβα. Όταν το Polygon Mode είναι ενεργό
 * και ο χρήστης έχει επιλέξει μία όψη (κλικ), ένα κλικ σε swatch εφαρμόζει το χρώμα/υλικό
 * σε εκείνη την όψη μέσω του undoable `SetFaceAppearanceCommand` (κοινό command history +
 * level-scene adapter — ίδιο pattern με `Grip3DVertexContextMenu`). MVP fallback =
 * click-to-apply· το HTML5 drag-drop έρχεται στη Φ2.
 *
 * Reuse: `listWallCoveringMaterials()` (catalog SSoT) + i18n labels του ribbon
 * (`dxf-viewer-shell:wallCovering.materials.*`). ADR-040: leaf React component.
 *
 * @see bim-3d/stores/PolygonMode3DStore.ts
 * @see core/commands/entity-commands/SetFaceAppearanceCommand.ts
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { usePolygonMode3DStore } from '../stores/PolygonMode3DStore';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { getGlobalCommandHistory } from '../../core/commands';
import { SetFaceAppearanceCommand } from '../../core/commands/entity-commands/SetFaceAppearanceCommand';
import { listWallCoveringMaterials } from '../../bim/wall-coverings/wall-covering-material-catalog';
import type { FaceAppearance } from '../../bim/types/face-appearance-types';

export function PolygonMaterialPanel() {
  const { t } = useTranslation(['bim3d', 'dxf-viewer-shell']);
  const levels = useLevelsOptional();
  const active = usePolygonMode3DStore((s) => s.active);
  const selectedFace = usePolygonMode3DStore((s) => s.selectedFace);

  if (!active) return null;

  const apply = (value: FaceAppearance | null): void => {
    const face = usePolygonMode3DStore.getState().selectedFace;
    if (!face || !levels?.currentLevelId) return;
    const adapter = createLevelSceneManagerAdapter(
      levels.getLevelScene, levels.setLevelScene, levels.currentLevelId,
    );
    getGlobalCommandHistory().execute(
      new SetFaceAppearanceCommand(face.bimId, face.faceKey, value, adapter),
    );
  };

  const hasFace = selectedFace !== null;

  return (
    <section
      className="absolute right-3 top-20 z-[60] w-52 select-none rounded-md border border-white/20 bg-black/60 p-2 text-white/90 backdrop-blur-sm"
      aria-label={t('polygonMode.title')}
    >
      <header className="mb-1.5">
        <h3 className="text-xs font-semibold">{t('polygonMode.title')}</h3>
        <p className="mt-0.5 text-[10px] text-white/60">
          {hasFace ? t('polygonMode.hintApply') : t('polygonMode.hintPickFace')}
        </p>
      </header>
      <ul className="grid grid-cols-2 gap-1">
        {listWallCoveringMaterials().map((m) => {
          const label = t(`dxf-viewer-shell:wallCovering.materials.${m.labelKeySuffix}`);
          return (
            <li key={m.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    disabled={!hasFace}
                    onClick={() => apply({ materialId: m.id })}
                    className="flex w-full items-center gap-1.5 rounded border border-white/15 px-1.5 py-1 text-[10px] transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
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
      <button
        type="button"
        disabled={!hasFace}
        onClick={() => apply(null)}
        className="mt-1.5 w-full rounded border border-white/15 px-1.5 py-1 text-[10px] transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {t('polygonMode.clearFace')}
      </button>
    </section>
  );
}
