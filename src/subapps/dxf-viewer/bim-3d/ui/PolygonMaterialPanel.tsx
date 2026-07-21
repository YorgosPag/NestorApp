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
import type { TFunction } from 'i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/auth/hooks/useAuth';
import { useCompanyId } from '@/hooks/useCompanyId';
import { EnterpriseColorDialog } from '../../ui/color/EnterpriseColorDialog';
import { MaterialSwatch } from '../../ui/components/shared/MaterialSwatch';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { useProjectHierarchyOptional } from '../../contexts/ProjectHierarchyContext';
import { usePolygonMode3DStore, type PolygonTargetLayer } from '../stores/PolygonMode3DStore';
import { listWallCoveringMaterials } from '../../bim/wall-coverings/wall-covering-material-catalog';
import type { FaceAppearance } from '../../bim/types/face-appearance-types';
import { BASE_FACE_KEY } from '../../bim/types/face-appearance-types';
import { applyFaceAppearanceToFaces } from './apply-face-appearance';
import { BIM_MATERIAL_MIME, serializeFaceAppearanceDrag } from './polygon-material-dnd';
// ADR-449 PART B Slice C — «Σοβάς» layer: ίδιο picking/panel/dialog, route στο faceOverrides.
import { applyFinishFaceOverrideToFaces } from './apply-finish-face-override';
import { FINISH_MATERIAL_OPTIONS } from '../../ui/ribbon/hooks/bridge/finish-param';
import { getMaterialFlatColorHex } from '../../bim/materials/material-catalog-defs';
import type { FinishFaceOverride } from '../../bim/finishes/structural-finish-types';
// ADR-679 Φ2b / ADR-539 Φ4d — BODY layer textured swatches (catalog + user bmat_* library).
import { useMaterialLibrary } from '../../ui/panels/materials/hooks/useMaterialLibrary';
import { constructionMaterialLabelKey } from '../../bim/materials/construction-materials';
import type { BimMaterial, BimMaterialCategory } from '../../bim/types/bim-material-types';
import { FACE_TEXTURE_MATERIAL_IDS, buildLibraryMaterialSwatches } from './polygon-material-swatches';

/** Default seed for the custom-colour dialog (a warm Cinema 4D red). */
const DEFAULT_CUSTOM_COLOR = '#C0392B';

/**
 * Textured swatch reference (ADR-679 Φ2b) — catalog `mat-*` id OR user-library `bmat_*`
 * category+urls. Rendered via the shared `<MaterialSwatch>` (real photo/albedo), not a flat span.
 */
interface SwatchTextureRef {
  readonly materialId?: string;
  readonly category?: BimMaterialCategory;
  readonly thumbnailUrl?: string | null;
  readonly albedoUrl?: string | null;
}

/**
 * Ένα swatch υλικού στο panel (layer-agnostic: label + drag id), σε ΔΥΟ σχήματα:
 *   - flat χρώμα (legacy wall-covering paints + finish materials) → `color` hex, καμία υφή·
 *   - textured (ADR-679 Φ2b: catalog cladding + user library) → `swatch` ref, render μέσω
 *     `<MaterialSwatch>` (πραγματική φωτογραφία/albedo).
 * Discriminated ώστε το render branch να είναι type-safe (όχι optional-both, όχι `!`).
 */
type SwatchItem =
  | {
      readonly id: string;
      readonly label: string;
      /** Body swatches είναι draggable (drag-drop 539)· finish = click-only. */
      readonly draggable: boolean;
      readonly color: string;
      readonly swatch?: undefined;
    }
  | {
      readonly id: string;
      readonly label: string;
      readonly draggable: boolean;
      readonly swatch: SwatchTextureRef;
      readonly color?: undefined;
    };

/**
 * ADR-679 Φ2b — BODY layer swatch groups, Cinema 4D Material Manager order:
 *   1. textured catalog cladding materials (`FACE_TEXTURE_MATERIAL_IDS`) — brick/stone/wood/…
 *   2. the user's own material library (`bmat_*`, `useMaterialLibrary`)
 *   3. legacy flat wall-covering paints (unchanged — N.18 reuse of `listWallCoveringMaterials`)
 */
function buildBodySwatches(library: readonly BimMaterial[], t: TFunction): SwatchItem[] {
  const catalog: SwatchItem[] = FACE_TEXTURE_MATERIAL_IDS.map((id) => ({
    id,
    label: t(`dxf-viewer-shell:${constructionMaterialLabelKey(id)}`),
    draggable: true,
    swatch: { materialId: id },
  }));
  const fromLibrary: SwatchItem[] = buildLibraryMaterialSwatches(library).map((d) => ({
    id: d.id,
    label: d.label,
    draggable: true,
    swatch: { category: d.category, thumbnailUrl: d.thumbnailUrl, albedoUrl: d.albedoUrl },
  }));
  const flatPaints: SwatchItem[] = listWallCoveringMaterials().map((m) => ({
    id: m.id,
    color: m.color,
    label: t(`dxf-viewer-shell:wallCovering.materials.${m.labelKeySuffix}`),
    draggable: true,
  }));
  return [...catalog, ...fromLibrary, ...flatPaints];
}

/**
 * ADR-449 Slice C — `FaceAppearance` (panel) → `FinishFaceOverride` (σοβάς). `colorHex` του
 * panel = `colorOverride` του σοβά· `materialId` περνά αυτούσιο. `null` → clear.
 */
function toFinishOverride(value: FaceAppearance | null): FinishFaceOverride | null {
  if (!value) return null;
  return value.colorHex ? { colorOverride: value.colorHex } : { materialId: value.materialId };
}

export function PolygonMaterialPanel() {
  const { t } = useTranslation(['bim3d', 'dxf-viewer-shell']);
  const levels = useLevelsOptional();
  // ADR-679 Φ2b — user material library (bmat_*) for the BODY layer's textured swatches.
  // Called UNCONDITIONALLY (React hook rules) — mirrors MaterialsLibraryPanel's companyId/
  // userId wiring; projectId comes from the same hierarchy context BimViewport3D itself reads.
  const { user } = useAuth();
  const companyResult = useCompanyId();
  const hierarchy = useProjectHierarchyOptional();
  const { materials: libraryMaterials } = useMaterialLibrary({
    companyId: companyResult?.companyId,
    userId: user?.uid,
    projectId: hierarchy?.selectedProject?.id ?? undefined,
  });
  const active = usePolygonMode3DStore((s) => s.active);
  const selectedFaces = usePolygonMode3DStore((s) => s.selectedFaces);
  const targetBimId = usePolygonMode3DStore((s) => s.targetBimId);
  const targetLayer = usePolygonMode3DStore((s) => s.targetLayer);
  const setTargetLayer = usePolygonMode3DStore((s) => s.setTargetLayer);
  const [colorOpen, setColorOpen] = useState(false);
  const [customHex, setCustomHex] = useState(DEFAULT_CUSTOM_COLOR);

  if (!active) return null;

  const isFinish = targetLayer === 'finish';

  /**
   * Apply — Revit/Cinema 4D «base + override» μοντέλο, ΕΝΑ tool, δύο layers (Slice C):
   *   - **Σώμα** (539): N όψεις → per-face· καμία όψη → ΟΛΟ το στοιχείο (base `'*'`).
   *   - **Σοβάς** (449): ΜΟΝΟ per-face (το override είναι ανά ακμή· δεν υπάρχει base «όλο»)
   *     → route στο `applyFinishFaceOverrideToFaces` (γράφει `spec.faceOverrides[ref]`).
   * Και τα δύο μέσω batch SSoT = ΕΝΑ undo.
   */
  const apply = (value: FaceAppearance | null): void => {
    const faces = usePolygonMode3DStore.getState().selectedFaces;
    if (usePolygonMode3DStore.getState().targetLayer === 'finish') {
      if (faces.length > 0) applyFinishFaceOverrideToFaces(levels, faces, toFinishOverride(value));
      return;
    }
    const target = usePolygonMode3DStore.getState().targetBimId;
    if (faces.length > 0) applyFaceAppearanceToFaces(levels, faces, value);
    else if (target) applyFaceAppearanceToFaces(levels, [{ bimId: target, faceKey: BASE_FACE_KEY }], value);
  };

  const faceCount = selectedFaces.length;
  /** Σώμα: όψεις Ή «όλο το στοιχείο». Σοβάς: μόνο επιλεγμένες όψεις (per-face override). */
  const canApply = faceCount > 0 || (!isFinish && targetBimId !== null);
  /**
   * Swatches ανά layer: σώμα = textured catalog + user library + wall coverings (draggable,
   * ADR-679 Φ2b)· σοβάς = finish materials (click-only, flat — αμετάβλητο).
   */
  const swatches: SwatchItem[] = isFinish
    ? FINISH_MATERIAL_OPTIONS.map((o) => ({ id: o.value, color: getMaterialFlatColorHex(o.value), label: t(o.labelKey), draggable: false }))
    : buildBodySwatches(libraryMaterials, t);

  return (
    // ADR-539 — Cinema 4D «Material Manager»: φαρδιά μπάρα υλικών στη ΒΑΣΗ του 3D κάμβα
    // (full-width, οριζόντια swatches), όχι πλαϊνό panel πάνω δεξιά (Giorgio 2026-07-19).
    <section
      className="absolute inset-x-0 bottom-0 z-[60] flex select-none items-stretch gap-3 border-t border-white/20 bg-black/70 px-3 py-2 text-white/90 backdrop-blur-sm"
      aria-label={t('polygonMode.title')}
    >
      {/* Αριστερό cluster: τίτλος + hint + layer toggle (σώμα/σοβάς). */}
      <header className="flex min-w-[190px] shrink-0 flex-col justify-center gap-1 border-r border-white/10 pr-3">
        <h3 className="text-xs font-semibold">{t('polygonMode.title')}</h3>
        <p className="text-[10px] leading-tight text-white/60">
          {faceCount > 1
            ? t('polygonMode.hintMultiFace', { count: faceCount })
            : faceCount === 1
              ? t('polygonMode.hintApply')
              : isFinish
                ? t('polygonMode.hintFinishPickFace')
                : targetBimId
                  ? t('polygonMode.hintWholeElement')
                  : t('polygonMode.hintPickFace')}
        </p>
        {/* ADR-449 Slice C — layer toggle: σώμα (539 FaceAppearance) ↔ σοβάς (449 faceOverrides). */}
        <fieldset className="grid grid-cols-2 gap-1" aria-label={t('polygonMode.layerLabel')}>
          {(['body', 'finish'] as PolygonTargetLayer[]).map((layer) => (
            <button
              key={layer}
              type="button"
              aria-pressed={targetLayer === layer}
              onClick={() => setTargetLayer(layer)}
              className={`rounded border px-1.5 py-1 text-[10px] transition-colors ${
                targetLayer === layer ? 'border-white/60 bg-white/20' : 'border-white/15 hover:bg-white/10'
              }`}
            >
              {t(layer === 'body' ? 'polygonMode.layerBody' : 'polygonMode.layerFinish')}
            </button>
          ))}
        </fieldset>
      </header>

      {/* Κεντρικό cluster: οριζόντια σειρά υλικών (C4D thumbnails), scroll όταν δεν χωράνε. */}
      <ul className="flex flex-1 items-center gap-2 overflow-x-auto py-1">
        {swatches.map((m) => (
          <li key={m.id} className="shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                {/* Body swatches: draggable (Cinema 4D drag-drop). Finish: click-only. */}
                <button
                  type="button"
                  draggable={m.draggable}
                  onDragStart={m.draggable ? (e) => {
                    e.dataTransfer.setData(BIM_MATERIAL_MIME, serializeFaceAppearanceDrag({ materialId: m.id }));
                    e.dataTransfer.effectAllowed = 'copy';
                  } : undefined}
                  onClick={() => apply({ materialId: m.id })}
                  className={`flex w-14 flex-col items-center gap-1 rounded border border-white/15 p-1 text-[9px] transition-colors hover:bg-white/10 ${m.draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
                >
                  {m.swatch ? (
                    // ADR-679 Φ2b — textured catalog/library swatch: real photo/albedo image.
                    <MaterialSwatch
                      materialId={m.swatch.materialId}
                      category={m.swatch.category}
                      thumbnailUrl={m.swatch.thumbnailUrl}
                      albedoUrl={m.swatch.albedoUrl}
                      className="h-9 w-9 shrink-0 rounded-sm border border-white/30"
                    />
                  ) : (
                    // Data-driven catalog colour → inline style (accepted N.3 exception, mirror MaterialSwatch).
                    <span
                      className="h-9 w-9 shrink-0 rounded-sm border border-white/30"
                      style={{ backgroundColor: m.color }}
                      aria-hidden="true"
                    />
                  )}
                  <span className="w-full truncate text-center">{m.label}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>{m.label}</TooltipContent>
            </Tooltip>
          </li>
        ))}
      </ul>

      {/* Δεξί cluster: προσαρμοσμένο χρώμα + καθαρισμός. */}
      <div className="flex min-w-[170px] shrink-0 flex-col justify-center gap-1 border-l border-white/10 pl-3">
        {/* Custom colour (EnterpriseColorDialog) → apply({ colorHex }) to the faces, or whole solid. */}
        <button
          type="button"
          disabled={!canApply}
          onClick={() => setColorOpen(true)}
          className="flex w-full items-center gap-1.5 rounded border border-white/15 px-1.5 py-1 text-[10px] transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
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
          disabled={!canApply}
          onClick={() => apply(null)}
          className="w-full rounded border border-white/15 px-1.5 py-1 text-[10px] transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {faceCount > 0 ? t('polygonMode.clearFace') : t('polygonMode.clearWhole')}
        </button>
      </div>

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
