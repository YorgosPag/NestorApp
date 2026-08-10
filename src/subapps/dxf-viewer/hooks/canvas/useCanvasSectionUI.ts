import { useCallback, useEffect } from 'react';
import type React from 'react';
import type { ICommand } from '../../core/commands';
import type { ToolType } from '../../ui/toolbar/types';
import type { LevelManagerLike } from './canvas-click-types';
import type { Overlay } from '../../overlays/types';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { Point2D } from '../../rendering/types/Types';
import { useTextDoubleClickEditor } from '../../ui/text-toolbar/hooks/useTextDoubleClickEditor';
// ADR-612 — opening-info-tag inline numeric cell editor: sibling of the text
// double-click editor, opens a store-driven numeric input over the clicked cell.
import { useOpeningInfoTagDoubleClick } from './use-opening-info-tag-double-click';
// ADR-739 Φ.Δ βήμα 2 — ο οδηγός του δρομέα κελιού πίνακα: το διπλό κλικ τον ανοίγει, τα
// Tab/Enter/βέλη τον μετακινούν. Η κατάστασή του ζει σε store (και όχι σε React state)
// επειδή τον διαβάζει ΚΑΙ ο ζωγράφος του καμβά, που δεν βλέπει React — χαμηλή συχνότητα
// (ένα πάτημα πλήκτρου), άρα ίδιο κόστος απόδοσης με το `useState` που αντικατέστησε.
import { useTableCellDoubleClickEditor } from '../../ui/table-cell-editor/useTableCellDoubleClickEditor';
// ADR-739 Φ.Δ βήμα 4 — οι είσοδοι ΧΩΡΙΣ σημείο: `Enter`/`F2` σε επιλεγμένο πίνακα (WAI-ARIA
// APG «Grid» + Excel) και η εντολή `TABLEDIT` (AutoCAD). Το διπλό κλικ μένει στον οδηγό του,
// γιατί μόνο εκείνο ξέρει ΠΟΙΟ κελί και ΠΟΙΟΝ χαρακτήρα έδειξε ο χρήστης.
import { useTableModeEntry } from '../../ui/table-cell-editor/use-table-mode-entry';
// ADR-739 Φ.Δ βήμα 9 — το μενού των ζωνών δείκτη (γράμματα στηλών / αριθμοί γραμμών). Ζει
// δίπλα στον οδηγό του δρομέα και όχι μέσα του: διαβάζει μόνο του δρομέα + σκηνή, και ο
// οδηγός είναι ήδη στα όρια των 500 γραμμών (N.7.1). Δεν εγγράφει ακροατή — εκθέτει getter
// που ρωτά ο ΕΝΑΣ δρομολογητής δεξιού κλικ (`useCanvasContextMenu`).
import { useTableHeaderMenu } from '../../ui/table-cell-editor/use-table-header-menu';
import { useTableRangeMenu } from '../../ui/table-cell-editor/use-table-range-menu';
// 🔴 ADR-739 §52 — η **τρίτη** θύρα πίνακα: η μορφοποίηση προς την κορδέλα. Δεν επιστρέφει
// τίποτα και δεν μοντάρει επιφάνεια — δημοσιεύει getters που ρωτά ο ribbon bridge, ο οποίος
// ζει σε άλλο κλαδί του δέντρου (`DxfViewerTopBar`) και δεν μπορεί να πάρει props από εδώ
// χωρίς να ανεβεί η κατάσταση στον orchestrator (παλινδρόμηση ADR-040/532).
import { useTableFormatActions } from '../../ui/table-cell-editor/use-table-format-actions';
// 🔴 ADR-739 §61 — `Ctrl+1`: ο **ένας** ιδιοκτήτης της σημασίας «Μορφοποίηση κελιών». Δες τη
// σημείωση μέσα στον χειριστή για το γιατί κρίνεται πριν τον φύλακα εστίασης.
import { claimTableFormatCellsShortcut } from '../../ui/table-cell-editor/table-format-cells-shortcut';
import { useTableLinkMenu } from '../../ui/table-cell-editor/use-table-link-menu';
// 🔴 ADR-739 §67 — η **τέταρτη** θύρα δεξιού κλικ πίνακα, και η μόνη που **δεν** ρωτιέται από τον
// δρομολογητή του καμβά: τα δύο πεδία κειμένου της συνεδρίας ζουν εκτός του δοχείου του, οπότε
// τη ρωτούν τα ίδια τα πεδία μέσω `onContextMenu`. Δες `table-text-menu-port.ts`.
import { useTableTextToolbar } from '../../ui/table-cell-editor/use-table-text-toolbar';
import { useTableLinkShortcut } from '../../ui/table-cell-editor/use-table-link-shortcut';
import { useAutoAreaMouseMove } from './useAutoAreaMouseMove';
import { useRegionPerimeterMouseMove } from './useRegionPerimeterMouseMove';
import { useBathroomAutoArrangeMouseMove } from './useBathroomAutoArrangeMouseMove';
import { QuickPropertiesMiniPanelStore } from '../../systems/properties/QuickPropertiesMiniPanelStore';
import { PropertiesPaletteStore } from '../../systems/properties/PropertiesPaletteStore';
// ADR-575 §enter-group — double-click a selected GROUP to step INTO it (Revit «Edit
// Group» / Figma). Selection-driven (single-click selects the whole group, double-click
// enters): resolve the selected id to its container, push the drill-in level.
import { enterGroup, getActiveGroupId } from '../../systems/group/ActiveGroupStore';
import { resolveGroupContainingEntity } from '../../systems/group/group-selection-bounds';
// ADR-641 §3 — double-click a selected BLOCK to step INTO its exclusive Block Editor (AutoCAD
// BEDIT). Mirror of enter-group, but a scene-scope SWAP (the canvas shows ONLY the block's
// block-local members). Mutually exclusive with GROUP drill-in (ADR-641 §7).
import { enterBlockEdit, isBlockEditActive } from '../../systems/block/ActiveBlockEditStore';
// ADR-641 — capture the real-size/recenter VIEW transform at enter time (fixed for the session) so the
// Block Editor shows the block at its world size, framed on the origin (Revit/ArchiCAD/Figma parity).
import { computeBlockEditViewTransform } from '../../systems/block/block-edit-view-transform';
import { collectBlockEntities } from '../../systems/block/block-selection-bounds';

interface Params {
  transformRef: React.MutableRefObject<{ scale: number; offsetX: number; offsetY: number }>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  activeTool: ToolType;
  executeCommand: (command: ICommand) => void;
  getSelectedEntityIds: () => readonly string[];
  dxfScene: DxfScene | null;
  handleMouseMove: (worldPos: Point2D, screenPos: Point2D) => void;
  levelManager: LevelManagerLike;
  currentOverlays: Overlay[];
  transformScale: number;
}

export function useCanvasSectionUI({
  transformRef, containerRef, activeTool, executeCommand,
  getSelectedEntityIds, dxfScene,
  handleMouseMove, levelManager, currentOverlays, transformScale,
}: Params) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 🔴 ADR-739 §61 — ΤΟ `Ctrl+1` ΚΡΙΝΕΤΑΙ **ΠΡΙΝ** ΤΟΝ ΦΥΛΑΚΑ ΕΣΤΙΑΣΗΣ, ΚΑΙ ΟΧΙ ΤΥΧΑΙΑ.
      //
      // Το πλήκτρο έχει δύο νόμιμους ιδιοκτήτες (Excel: Μορφοποίηση κελιών · AutoCAD: Παλέτα
      // Ιδιοτήτων) και τους ξεχωρίζει η **συνεδρία πίνακα**, όχι το πού βρίσκεται η εστίαση:
      //   · με δρομέα σε κελί η εστίαση είναι `<textarea>` ⇒ ο φύλακας από κάτω θα έβγαινε
      //     νωρίς και το πλήκτρο δεν θα έκανε **τίποτα** (τρύπα, όχι σύγκρουση — δες το module
      //     της συντόμευσης για τη μέτρηση)·
      //   · με ανοιχτή συνεδρία και εστίαση σε **κουμπί** του mini toolbar, ο φύλακας θα το
      //     άφηνε να περάσει και θα άνοιγε την Παλέτα Ιδιοτήτων μέσα σε πίνακα.
      // Άρα η ερώτηση δεν είναι «γράφει κάπου ο χρήστης;» αλλά «υπάρχει στόχος μορφοποίησης;»,
      // και την απαντά **ένας** ιδιοκτήτης — αυτός εδώ δεν μαθαίνει τίποτα για πίνακες.
      if (e.ctrlKey && e.key === '1') {
        e.preventDefault();
        if (!claimTableFormatCellsShortcut()) PropertiesPaletteStore.toggle();
        return;
      }
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') return;
      if (e.key === 'F11') { e.preventDefault(); PropertiesPaletteStore.toggle(); return; }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, []);
  const textEditor = useTextDoubleClickEditor({ transformRef, containerRef, executeCommand, getSelectedEntityIds });
  const openingTagEditor = useOpeningInfoTagDoubleClick({ transformRef, containerRef, getSelectedEntityIds });
  const tableCellEditor = useTableCellDoubleClickEditor({ transformRef, containerRef, getSelectedEntityIds, levelManager });
  useTableModeEntry({ getSelectedEntityIds, levelManager });
  const tableHeaderMenu = useTableHeaderMenu({ containerRef, transformRef, levelManager });
  // ADR-750 Φ4 — δεύτερη θύρα δεξιού κλικ (PRIORITY 1.45): περιγράμματα σε επιλογή κελιών.
  const tableRangeMenu = useTableRangeMenu({ containerRef, transformRef, levelManager });
  // ADR-751 Φ8.β — τρίτη θύρα δεξιού κλικ (PRIORITY 1.44): σύνδεσμος μέσα σε κελί. Χωρίς
  // παραμέτρους επίτηδες — ο στόχος έρχεται από το hover store, όχι από νέο hit-test.
  const tableLinkMenu = useTableLinkMenu();
  // 🔴 ADR-739 §67 — τέταρτη θύρα: δεξί κλικ **μέσα** στο κείμενο που γράφεται. Χωρίς
  // `containerRef`/`transformRef` επίτηδες — δεν κάνει hit-test: το πεδίο του το δίνει το ίδιο το
  // συμβάν, και το κελί το ξέρει ο δρομέας.
  const tableTextToolbar = useTableTextToolbar({ levelManager });
  // ADR-751 Φ8.γ — `Ctrl+Shift+K`: η λίστα όλων των διευθύνσεων του επιλεγμένου πίνακα
  // (μοτίβο VS Code «Open Detected Link…»). Χωρίς επιστρεφόμενη τιμή: η επιφάνεια είναι
  // micro-leaf πάνω σε store, όχι μονταρισμένο ref.
  useTableLinkShortcut({ levelManager, getSelectedEntityIds });
  // ADR-739 §52 — χωρίς επιστρεφόμενη τιμή, όπως το `useTableLinkShortcut`: ο καταναλωτής
  // είναι η κορδέλα μέσω module θύρας, όχι μονταρισμένο ref αυτού του δέντρου.
  useTableFormatActions({ levelManager, getSelectedEntityIds });
  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'select') {
      const ids = getSelectedEntityIds();
      if (ids.length === 1) {
        // ADR-575 §enter-group — double-click a selected GROUP → drill in (Revit «Edit
        // Group»). Read the RAW scene at event time (groups survive only pre-expansion);
        // a member/nested group double-clicked while inside resolves to its own container.
        const levelId = levelManager.currentLevelId;
        const rawScene = levelId ? levelManager.getLevelScene(levelId) : null;
        const group = resolveGroupContainingEntity(rawScene?.entities, ids[0]);
        // GROUP mutual-exclusivity (ADR-641 §7): never enter a group while a Block Editor is open.
        if (group && !isBlockEditActive()) { enterGroup(group.id); return; }
        // ADR-641 §3 — a BLOCK is selected via its container id (members carry block.id), so the
        // single selected id resolves straight to the block. Enter its exclusive editor, but NOT
        // while inside a group (mutual-exclusivity — else two scope systems fight over one canvas).
        const block = collectBlockEntities(rawScene?.entities).get(ids[0]);
        if (block) {
          if (getActiveGroupId() === null) {
            enterBlockEdit(block.id, block.name, computeBlockEditViewTransform(block));
          }
          return;
        }
        const entity = dxfScene?.entities.find(en => en.id === ids[0]);
        if (entity?.type === 'line') {
          const rect = containerRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
          QuickPropertiesMiniPanelStore.open(ids[0], { x: e.clientX - rect.left, y: e.clientY - rect.top });
          return;
        }
      }
    }
    // ADR-612 — opening-info-tag cell editor claims the double-click when it lands on
    // a cell of the single selected tag; otherwise fall through to the text editor.
    if (openingTagEditor.handleDoubleClick(e)) return;
    // ADR-739 Φ.Δ βήμα 2 — ο δρομέας κελιού είναι no-op αν η μία επιλογή δεν είναι πίνακας
    // ΚΑΙ το κλικ δεν πέφτει μέσα στο πλέγμα (ελέγχεται εσωτερικά, void όπως ο textEditor).
    tableCellEditor.handleDoubleClick(e);
    textEditor.handleDoubleClick(e);
  }, [activeTool, getSelectedEntityIds, dxfScene, containerRef, textEditor, openingTagEditor, tableCellEditor, levelManager]);
  const { handleMouseMoveWithAutoArea } = useAutoAreaMouseMove({ handleMouseMove, activeTool, levelManager, currentOverlays, transformScale });
  // ADR-419 Layer 3 — αλυσίδωση: region/perimeter hover preview πάνω από το auto-area.
  const { handleMouseMoveWithRegionPreview } = useRegionPerimeterMouseMove({ handleMouseMove: handleMouseMoveWithAutoArea, activeTool, levelManager });
  // ADR-638 Στάδιο 2b — αλυσίδωση: bathroom auto-arrange hover highlight πάνω από το
  // region preview (τρέχει ΤΕΛΕΥΤΑΙΟ → οδηγεί το ΙΔΙΟ RegionPerimeterPreviewStore όταν
  // είναι ενεργό το εργαλείο μπάνιου· αλλιώς καθαρό passthrough).
  const { handleMouseMoveWithBathroomPreview } = useBathroomAutoArrangeMouseMove({ handleMouseMove: handleMouseMoveWithRegionPreview, activeTool, levelManager });
  return { textEditor, tableCellEditor, tableHeaderMenu, tableRangeMenu, tableLinkMenu, tableTextToolbar, handleDoubleClick, handleMouseMoveWithAutoArea: handleMouseMoveWithBathroomPreview };
}
