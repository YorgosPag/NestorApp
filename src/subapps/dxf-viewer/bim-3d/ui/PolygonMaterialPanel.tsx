"use client";

/**
 * PolygonMaterialPanel — ADR-539 (Cinema 4D «Polygon Mode» material library).
 *
 * Floating βιβλιοθήκη υλικών/χρωμάτων στον 3D κάμβα. Όταν το Polygon Mode είναι ενεργό,
 * εφαρμόζεις υλικό με ΔΥΟ τρόπους (Cinema 4D parity):
 *   1. **click-to-apply** — επίλεξε όψη/όψεις (κλικ· Shift+κλικ multi, Φ4b) → κλικ σε swatch.
 *      Εφαρμόζεται σε ΟΛΕΣ τις επιλεγμένες όψεις με ΕΝΑ undo.
 *   2. **drag-drop (Φ2)** — σύρε ένα swatch πάνω στην όψη (HTML5 `application/x-bim-material`·
 *      ο drop handler ζει στο `use-polygon-drag-drop`). Το drag δουλεύει χωρίς προ-επιλογή όψης.
 *
 * ADR-687 Φ1 — «＋ Νέο Υλικό» (αντικατέστησε το «Προσαρμοσμένο χρώμα»): ανοίγει το πλήρες
 * `MaterialEditorDialog` σε create-mode (χρώμα+γυαλάδα+μέταλλο+υφή+3D σφαίρα-preview)· μετά την
 * αποθήκευση το υλικό εμφανίζεται αμέσως ως swatch (feed always-on). Big-player: όλα είναι υλικά·
 * το low-level `colorHex` per-face override μένει εσωτερικό (drag-drop/ADR-539/686).
 *
 * Οι εφαρμογές περνούν από το shared `applyFaceAppearanceToFaces` SSoT (Φ4b batch = `CompositeCommand`
 * → ΕΝΑ undo, cross-entity· το drag-drop μένει per-face `applyFaceAppearance`). Reuse:
 * `listWallCoveringMaterials()` (catalog SSoT) + i18n labels του ribbon
 * (`dxf-viewer-shell:wallCovering.materials.*`). ADR-040: leaf React component.
 *
 * @see ./apply-face-appearance.ts — apply SSoT (κοινό με drag-drop)
 * @see ./polygon-material-dnd.ts — drag MIME + serialize SSoT
 * @see bim-3d/stores/PolygonMode3DStore.ts
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Library } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/auth/hooks/useAuth';
import { useCompanyId } from '@/hooks/useCompanyId';
import { MaterialEditorDialog, type PendingPbrUpload } from '../../ui/panels/materials/MaterialEditorDialog';
import { persistMaterialFromEditor } from '../../ui/panels/materials/persist-material-from-editor';
import type {
  SaveBimMaterialInput,
  UpdateBimMaterialPatch,
} from '../../bim/types/bim-material-types';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { useProjectHierarchyOptional } from '../../contexts/ProjectHierarchyContext';
import { usePolygonMode3DStore, type PolygonTargetLayer } from '../stores/PolygonMode3DStore';
import type { FaceAppearance } from '../../bim/types/face-appearance-types';
import { applyFaceAppearanceToFaces } from './apply-face-appearance';
import { applyWholeElementBodyAppearance } from './apply-entity-face-appearance-map';
// ADR-449 PART B Slice C — «Σοβάς» layer: ίδιο picking/panel/dialog, route στο faceOverrides.
import { applyFinishToWholeElement, faceAppearanceToFinishOverride } from './apply-finish-face-override';
// ADR-539 (Giorgio 2026-07-22) — entity-level modes (ΣΩΜΑ/ΣΟΒΑΣ) βάφουν την ΕΠΙΛΕΓΜΕΝΗ οντότητα.
import { useSelection3DStore } from '../stores/Selection3DStore';
// ADR-539 Φ7 — per-sub-element paint σκάλας (πάτημα/ρίχτι/πλατύσκαλο/πλάκα) στο ΙΔΙΟ swatch flow.
import { useStairSubElementSelectionStore } from '../../bim/stairs/stair-sub-element-selection-store';
import { applyStairSubElementAppearance } from './apply-stair-sub-element-appearance';
// ADR-407 Φ8 — per-component paint κιγκλιδώματος (κουπαστή/κάγκελα/κολόνες) στο ΙΔΙΟ swatch flow.
import { useRailingComponentSelectionStore } from '../../bim/railings/railing-component-selection-store';
import { applyRailingComponentAppearance } from './apply-railing-appearance';
import { FINISH_MATERIAL_OPTIONS } from '../../ui/ribbon/hooks/bridge/finish-param';
import { getMaterialFlatColorHex } from '../../bim/materials/material-catalog-defs';
// ADR-679 Φ2b / ADR-539 Φ4d — BODY layer textured swatches (catalog + user bmat_* library).
import { useMaterialLibrary } from '../../ui/panels/materials/hooks/useMaterialLibrary';
// ADR-687 Φ8 — η μπάρα δείχνει ΜΟΝΟ υλικά σκηνής (useSceneMaterials)· το popover «Βιβλιοθήκη» δείχνει ΟΛΑ.
import type { LibraryEntry } from './material-library-index';
import { useSceneMaterials } from './useSceneMaterials';
import { MaterialEntryButton } from './MaterialEntryButton';
import { MaterialLibraryPopover } from './MaterialLibraryPopover';

export function PolygonMaterialPanel() {
  const { t } = useTranslation(['bim3d', 'dxf-viewer-shell']);
  const levels = useLevelsOptional();
  // ADR-679 Φ2b — user material library (bmat_*) for the BODY layer's textured swatches.
  // Called UNCONDITIONALLY (React hook rules) — mirrors MaterialsLibraryPanel's companyId/
  // userId wiring; projectId comes from the same hierarchy context BimViewport3D itself reads.
  const { user } = useAuth();
  const companyResult = useCompanyId();
  const hierarchy = useProjectHierarchyOptional();
  const projectId = hierarchy?.selectedProject?.id ?? undefined;
  // ADR-687 Φ1 — same library hook as MaterialsLibraryPanel; here we also drive
  // create (save/update) so «＋ Νέο Υλικό» authors a material straight from the bar.
  const { materials: libraryMaterials, save, update } = useMaterialLibrary({
    companyId: companyResult?.companyId,
    userId: user?.uid,
    projectId,
  });
  const selectedFaces = usePolygonMode3DStore((s) => s.selectedFaces);
  const targetLayer = usePolygonMode3DStore((s) => s.targetLayer);
  const setTargetLayer = usePolygonMode3DStore((s) => s.setTargetLayer);
  // ADR-539 (Giorgio 2026-07-22) — στα entity-level modes (ΣΩΜΑ/ΣΟΒΑΣ) το swatch click βάφει την
  // κανονική 3D επιλογή· στο ΠΟΛΥΓΩΝΑ mode χρησιμεύει ως «όλο το στοιχείο» fallback (καμία όψη).
  const selectedBimId = useSelection3DStore((s) => s.selectedBimId);
  // ADR-687 Φ1 — «＋ Νέο Υλικό»: opens the full Material Editor in create-mode. After
  // save the new material auto-appears in this bar (the user-material feed is always-on).
  const [editorOpen, setEditorOpen] = useState(false);
  // ADR-687 Φ8 — «Βιβλιοθήκη»: popover με ΟΛΑ τα υλικά (η μπάρα δείχνει μόνο σκηνή), για να βάψεις
  // υλικό που δεν υπάρχει ακόμη στη σκηνή (Revit «Paint → Material Browser» / C4D Content Browser).
  const [libraryOpen, setLibraryOpen] = useState(false);
  const handleEditorSave = useCallback(
    async (
      payload: SaveBimMaterialInput | UpdateBimMaterialPatch,
      mode: 'create' | 'edit',
      pendingThumbnail?: File | null,
      pendingPbr?: PendingPbrUpload | null,
    ) => {
      await persistMaterialFromEditor(
        { companyId: companyResult?.companyId, save, update },
        payload, mode, undefined, pendingThumbnail, pendingPbr,
      );
      setEditorOpen(false);
    },
    [companyResult?.companyId, save, update],
  );

  // Panel ΠΑΝΤΑ ορατό στον 3D κάμβα (Giorgio 2026-07-22): κανένα `active` gate — μπαίνεις στο 3D
  // και τα υλικά είναι αμέσως εκεί (Cinema 4D Material Manager), χωρίς επιλογή/κουμπί «Όψεις».
  const isPolygon = targetLayer === 'polygon';
  const isFinish = targetLayer === 'finish';

  /**
   * Apply — Revit/Cinema 4D «base + override» μοντέλο, ΕΝΑ tool, ΤΡΙΑ modes (Giorgio 2026-07-22):
   *   - **ΠΟΛΥΓΩΝΑ** (539 per-face): N επιλεγμένες όψεις → per-face· καμία → ΟΛΟ το σώμα (base `'*'`).
   *   - **ΣΩΜΑ** (539 entity): βάφει ΟΛΟ το σώμα της επιλεγμένης οντότητας (base `'*'`).
   *   - **ΣΟΒΑΣ** (449 entity): βάφει τον σοβά σε ΟΛΕΣ τις κάθετες όψεις της οντότητας.
   * Όλα μέσω batch SSoT = ΕΝΑ undo.
   *
   * ADR-678 Εύρημα A — το «όλο το στοιχείο» χρησιμοποιεί **replace semantics** μέσω του
   * `applyWholeElementBodyAppearance` (solid → `entireElementFaceMap` base `'*'`· ΣΚΑΛΑ → Φ7
   * `params.materials.appearance`), ώστε να καθαρίζει τυχόν προϋπάρχοντα per-face overrides —
   * αλλιώς «βάψε όλο» άφηνε βαμμένες όψεις αναλλοίωτες.
   */
  const apply = (value: FaceAppearance | null): void => {
    const store = usePolygonMode3DStore.getState();
    const target = useSelection3DStore.getState().selectedBimId;
    if (store.targetLayer === 'polygon') {
      // ADR-539 Φ7 — μια επιλεγμένη υποενότητα σκάλας (Revit «Paint») κερδίζει: γράψε το appearance
      // στα stair params (το per-face override δεν ισχύει σε παραμετρική σκάλα). Mutually-exclusive
      // με το `selectedFaces` (το pointer handler καθαρίζει το ένα όταν επιλέγει το άλλο).
      const sub = useStairSubElementSelectionStore.getState().selected;
      if (sub) { applyStairSubElementAppearance(levels, sub.stairId, sub.part, sub.index, value); return; }
      // ADR-407 Φ8 — επιλεγμένο component κιγκλιδώματος (κουπαστή/κάγκελα/κολόνες) κερδίζει: γράψε το
      // per-component appearance στα railing params (mirror σκάλας). Mutually-exclusive με stair sub/faces.
      const railComp = useRailingComponentSelectionStore.getState().selected;
      if (railComp) { applyRailingComponentAppearance(levels, railComp.railingId, railComp.component, value); return; }
      const faces = store.selectedFaces;
      if (faces.length > 0) applyFaceAppearanceToFaces(levels, faces, value);
      else if (target) applyWholeElementBodyAppearance(levels, target, value);
      return;
    }
    if (!target) return;
    if (store.targetLayer === 'finish') applyFinishToWholeElement(levels, target, faceAppearanceToFinishOverride(value));
    else applyWholeElementBodyAppearance(levels, target, value);
  };

  /** ADR-687 Φ8 — «Βιβλιοθήκη» apply: εφάρμοσε + κλείσε το popover (το υλικό μπαίνει στη σκηνή). */
  const applyFromLibrary = (value: FaceAppearance): void => {
    apply(value);
    setLibraryOpen(false);
  };

  const faceCount = selectedFaces.length;
  /** ΠΟΛΥΓΩΝΑ: επιλεγμένες όψεις Ή (fallback) η 3D επιλογή. ΣΩΜΑ/ΣΟΒΑΣ: η 3D επιλογή. */
  const canApply = (isPolygon && faceCount > 0) || selectedBimId !== null;

  // ADR-687 Φ8 — η μπάρα σώμα/πολύγωνα δείχνει ΜΟΝΟ τα ρητά βαμμένα υλικά της σκηνής (C4D Material
  // Manager). Ο σοβάς μένει fixed finish palette (click-only, flat — αμετάβλητο).
  const sceneEntries = useSceneMaterials(libraryMaterials, t);
  const finishEntries: LibraryEntry[] = useMemo(
    () =>
      FINISH_MATERIAL_OPTIONS.map((o): LibraryEntry => ({
        id: o.value,
        label: t(o.labelKey),
        source: 'paint',
        apply: { materialId: o.value },
        color: getMaterialFlatColorHex(o.value),
        editable: false,
        deletable: false,
      })),
    [t],
  );
  const barEntries = isFinish ? finishEntries : sceneEntries;

  return (
    // ADR-539 — Cinema 4D «Material Manager»: φαρδιά μπάρα υλικών στη ΒΑΣΗ του 3D κάμβα
    // (full-width, οριζόντια swatches), όχι πλαϊνό panel πάνω δεξιά (Giorgio 2026-07-19).
    <section
      className="absolute inset-x-0 bottom-0 z-[60] flex select-none items-stretch gap-3 border-t border-white/20 bg-black/70 px-3 py-2 text-white/90 backdrop-blur-sm"
      aria-label={t('polygonMode.title')}
    >
      {/* Αριστερό cluster: τίτλος + hint + mode toggle (σώμα/σοβάς/πολύγωνα). */}
      <header className="flex min-w-[190px] shrink-0 flex-col justify-center gap-1 border-r border-white/10 pr-3">
        <h3 className="text-xs font-semibold">{t('polygonMode.title')}</h3>
        <p className="text-[10px] leading-tight text-white/60">
          {isPolygon
            ? faceCount > 1
              ? t('polygonMode.hintMultiFace', { count: faceCount })
              : faceCount === 1
                ? t('polygonMode.hintApply')
                : t('polygonMode.hintPickFace')
            : isFinish
              ? t('polygonMode.hintFinishWhole')
              : t('polygonMode.hintBodyWhole')}
        </p>
        {/* Mode toggle (Giorgio 2026-07-22): ΣΩΜΑ (539 entity) · ΣΟΒΑΣ (449 entity) · ΠΟΛΥΓΩΝΑ
            (539 per-face). Τα δύο πρώτα μικρότερα· το ΠΟΛΥΓΩΝΑ ανοίγει το per-face picking. */}
        <fieldset className="grid grid-cols-3 gap-1" aria-label={t('polygonMode.layerLabel')}>
          {(['body', 'finish', 'polygon'] as PolygonTargetLayer[]).map((layer) => (
            <button
              key={layer}
              type="button"
              aria-pressed={targetLayer === layer}
              onClick={() => setTargetLayer(layer)}
              className={`rounded border px-1 py-0.5 text-[9px] leading-tight transition-colors ${
                targetLayer === layer ? 'border-white/60 bg-white/20' : 'border-white/15 hover:bg-white/10'
              }`}
            >
              {t(layer === 'body'
                ? 'polygonMode.layerBody'
                : layer === 'finish'
                  ? 'polygonMode.layerFinish'
                  : 'polygonMode.layerPolygon')}
            </button>
          ))}
        </fieldset>
      </header>

      {/* ADR-687 Φ1 — «＋ Νέο Υλικό» στην ΑΡΧΗ της μπάρας (αμέσως μετά το mode toggle «Πολύγωνα»),
          όπως το C4D Material Manager. Prominent, ΠΑΝΤΑ ενεργό (δημιουργείς υλικό ανεξάρτητα από
          επιλεγμένη όψη). Αντικατέστησε το παλιό «Προσαρμοσμένο χρώμα» (big-player: όλα είναι υλικά). */}
      <div className="flex shrink-0 items-center gap-2 border-r border-white/10 pr-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              className="flex items-center justify-center gap-1.5 rounded border border-[hsl(var(--bg-info)/0.5)] bg-[hsl(var(--bg-info)/0.2)] px-3 py-2 text-[11px] font-semibold transition-colors hover:bg-[hsl(var(--bg-info)/0.3)]"
            >
              <span className="whitespace-nowrap">{t('polygonMode.newMaterial')}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>{t('polygonMode.newMaterialTooltip')}</TooltipContent>
        </Tooltip>
        {/* ADR-687 Φ8 — «Βιβλιοθήκη»: άνοιξε το popover με ΟΛΑ τα υλικά (η μπάρα δείχνει μόνο σκηνή).
            Big-player: Revit «Paint → Material Browser» / C4D Content Browser. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-pressed={libraryOpen}
              onClick={() => setLibraryOpen((o) => !o)}
              className={`flex items-center justify-center gap-1.5 rounded border px-3 py-2 text-[11px] font-semibold transition-colors ${
                libraryOpen ? 'border-white/60 bg-white/20' : 'border-white/15 hover:bg-white/10'
              }`}
            >
              <Library size={14} />
              <span className="whitespace-nowrap">{t('polygonMode.library')}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>{t('polygonMode.libraryTooltip')}</TooltipContent>
        </Tooltip>
      </div>

      {/* Κεντρικό cluster: οριζόντια σειρά υλικών ΣΚΗΝΗΣ (C4D Material Manager), scroll όταν δεν χωράνε. */}
      <ul className="flex flex-1 items-center gap-2 overflow-x-auto py-1">
        {!isFinish && barEntries.length === 0 && (
          <li className="px-2 text-[10px] leading-tight text-white/50">
            {t('polygonMode.sceneEmptyHint')}
          </li>
        )}
        {barEntries.map((entry) => (
          <li key={entry.id} className="shrink-0">
            <MaterialEntryButton
              entry={entry}
              onApply={apply}
              draggable={!isFinish}
              className={`flex w-14 flex-col items-center gap-1 rounded border border-white/15 p-1 text-[9px] transition-colors hover:bg-white/10 ${
                isFinish ? '' : 'cursor-grab active:cursor-grabbing'
              }`}
              swatchClassName="h-9 w-9 shrink-0 rounded-sm border border-white/30"
            />
          </li>
        ))}
      </ul>

      {/* Δεξί cluster: καθαρισμός εμφάνισης. */}
      <div className="flex min-w-[120px] shrink-0 flex-col justify-center gap-1 border-l border-white/10 pl-3">
        <button
          type="button"
          disabled={!canApply}
          onClick={() => apply(null)}
          className="w-full rounded border border-white/15 px-1.5 py-1 text-[10px] transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {faceCount > 0 ? t('polygonMode.clearFace') : t('polygonMode.clearWhole')}
        </button>
      </div>

      {/* ADR-687 Φ8 — popover «Βιβλιοθήκη» (όλα τα υλικά) πάνω από τη μπάρα· κλικ = apply στη σκηνή. */}
      {libraryOpen && (
        <MaterialLibraryPopover
          library={libraryMaterials}
          t={t}
          onApply={applyFromLibrary}
          onClose={() => setLibraryOpen(false)}
        />
      )}

      <MaterialEditorDialog
        open={editorOpen}
        mode="create"
        projectId={projectId}
        onSave={handleEditorSave}
        onCancel={() => setEditorOpen(false)}
      />
    </section>
  );
}
