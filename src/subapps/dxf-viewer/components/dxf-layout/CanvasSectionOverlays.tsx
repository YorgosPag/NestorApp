'use client';

/**
 * CanvasSection Overlays — extracted portal-style overlays (ADR-040 Phase XXII.A).
 *
 * Holds: 4 context menus (Drawing, Entity, Guide, GuideBatch), grip menus,
 * quick properties (3 leaves), mirror confirm, text editor overlays (×2),
 * and selection cycling popover. All are sibling overlays of the canvas
 * (each is its own ADR-040 micro-leaf subscriber where applicable).
 *
 * Lives directly below CanvasSection in the React tree. The orchestrator passes
 * down the wired callbacks/refs; this file owns the JSX shape so CanvasSection
 * stays under the 500-line file-size budget (CLAUDE.md N.7.1).
 */

import React from 'react';
import DrawingContextMenu, { type DrawingContextMenuHandle } from '../../ui/components/DrawingContextMenu';
import GuideContextMenu, { type GuideContextMenuHandle } from '../../ui/components/GuideContextMenu';
import GuideBatchContextMenu, { type GuideBatchContextMenuHandle } from '../../ui/components/GuideBatchContextMenu';
import { PromptDialog } from '../../systems/prompt-dialog';
import { GripHoverMenu } from '../grip/GripHoverMenu';
import { GripContextMenu } from '../grip/GripContextMenu';
import { QuickPropertiesHoverPopover } from '../../systems/properties/QuickPropertiesHoverPopover';
import { QuickPropertiesMiniPanel } from '../../systems/properties/QuickPropertiesMiniPanel';
import { PropertiesPalette } from '../../systems/properties/PropertiesPalette';
// ADR-532 B4 — the entity context menu is a selection-subscribed leaf now.
import { EntityContextMenuHost, type EntityContextMenuHostProps } from './EntityContextMenuHost';
import { MirrorConfirmOverlay } from '../../ui/components/MirrorConfirmOverlay';
import { TextEditorOverlay } from '../../ui/text-toolbar/TextEditorOverlay';
// ADR-612 — inline numeric cell editor for opening-info-tag (self-contained: reads
// its own store, dispatches UpdateEntityCommand via useCommandHistory). No props.
import { OpeningInfoTagEditorOverlay } from '../../ui/opening-info-tag/OpeningInfoTagEditorOverlay';
// ADR-739 Φ.Δ βήμα 2 — inline table-cell text editor (prop-driven, mirrors TextEditorOverlay).
import { TableCellEditorOverlay } from '../../ui/table-cell-editor/TableCellEditorOverlay';
// ADR-739 Φ.Δ βήμα 7 — η γραμμή τύπων (fx) + η αναφορά κελιού. Δεύτερο πεδίο της ΙΔΙΑΣ
// συνεδρίας, αγκυρωμένο στον πίνακα και όχι στο κελί.
import { TableFormulaBar } from '../../ui/table-cell-editor/TableFormulaBar';
// 🔴 Giorgio 2026-08-04 — η ζωντανή ένδειξη μεγέθους της σύρσης. Χωρίς props **επίτηδες**:
// διαβάζει μόνη της από store, ώστε η συνδρομή υψηλής συχνότητας να μην ανέβει εδώ (ADR-040).
import { TableResizeReadoutOverlay } from '../../ui/table-cell-editor/TableResizeReadoutOverlay';
// ADR-739 Φ.Δ βήμα 9 — δεξί κλικ στα γράμματα στηλών / αριθμούς γραμμών: εισαγωγή & διαγραφή.
// Ανοίγει imperative από τον δρομολογητή (`useCanvasContextMenu`, PRIORITY 1.4) μέσω θύρας.
import {
  TableHeaderContextMenu,
  type TableHeaderContextMenuHandle,
} from '../../ui/components/TableHeaderContextMenu';
import {
  TableRangeContextMenu,
  type TableRangeContextMenuHandle,
} from '../../ui/components/TableRangeContextMenu';
import {
  TableCellLinkContextMenu,
  type TableCellLinkContextMenuHandle,
} from '../../ui/components/TableCellLinkContextMenu';
// 🔴 ADR-739 §67 — δεξί κλικ **μέσα** σε πεδίο κειμένου της συνεδρίας (κελί ή γραμμή τύπων):
// **μόνο** το mini toolbar, χωρίς μενού (§67.10, μετρημένο στο Excel). Ανοίγει imperative μέσω
// θύρας — αλλά τη θύρα του **δεν** τη ρωτά ο δρομολογητής του καμβά: τη ρωτούν τα ίδια τα πεδία.
import {
  TableTextMiniToolbar,
  type TableTextToolbarHandle,
} from '../../ui/components/TableTextMiniToolbar';
import { TableLinkPicker } from '../../ui/components/TableLinkPicker';
// 🔴 ADR-828 §7.2 — μενού δεξιού συρσίματος της λαβής συμπλήρωσης. **Χωρίς props**:
// όλη η πράξη ταξιδεύει με τον στόχο — δες την κεφαλίδα του component.
import { TableFillOptionsMenu } from '../../ui/components/TableFillOptionsMenu';
import { SelectionCyclingPopover } from '../../systems/selection/SelectionCyclingPopover';
// ADR-659 — overlap «⧉ N» badge (store-driven leaf, no props).
import { OverlapCountBadge } from '../../systems/selection/OverlapCountBadge';
import { TableCellLinkTooltip } from '../../ui/table-cell-editor/TableCellLinkTooltip';

type QuickHoverProps = React.ComponentProps<typeof QuickPropertiesHoverPopover>;
type QuickMiniProps = React.ComponentProps<typeof QuickPropertiesMiniPanel>;
type PalettePropsT = React.ComponentProps<typeof PropertiesPalette>;
type DrawingMenuProps = React.ComponentProps<typeof DrawingContextMenu>;
type GuideMenuProps = React.ComponentProps<typeof GuideContextMenu>;
type GuideBatchMenuProps = React.ComponentProps<typeof GuideBatchContextMenu>;
type MirrorOverlayProps = React.ComponentProps<typeof MirrorConfirmOverlay>;
type TextOverlayProps = React.ComponentProps<typeof TextEditorOverlay>;
// ADR-739 Φ.Δ βήμα 2 — το `key` ταξιδεύει ΔΙΠΛΑ στα props (το React το καταναλώνει, δεν
// φτάνει ποτέ στο component) γιατί περιέχει τον **αριθμό συνεδρίας** του δρομέα: `Escape`
// πάνω σε πρόχειρο ξαναστήνει το `<input>` στο ΙΔΙΟ κελί, και μαζί του τον φρουρό δέσμευσης.
type TableCellOverlayMount = { key: string; props: React.ComponentProps<typeof TableCellEditorOverlay> };
type TableFormulaBarMount = { key: string; props: React.ComponentProps<typeof TableFormulaBar> };
type CyclingProps = React.ComponentProps<typeof SelectionCyclingPopover>;
type TableRangeMenuMount = {
  ref: React.RefObject<TableRangeContextMenuHandle | null>;
  props: Omit<React.ComponentProps<typeof TableRangeContextMenu>, 'ref'>;
};

type TableHeaderMenuMount = {
  ref: React.RefObject<TableHeaderContextMenuHandle | null>;
  props: Omit<React.ComponentProps<typeof TableHeaderContextMenu>, 'ref'>;
};

// ADR-751 Φ8.β — τρίτο μενού δεξιού κλικ πίνακα, ίδιο συμβόλαιο μονταρίσματος με τα δύο
// από πάνω: ref για την επιτακτική εντολή `open`, props για τις ενέργειες.
type TableLinkMenuMount = {
  ref: React.RefObject<TableCellLinkContextMenuHandle | null>;
  props: Omit<React.ComponentProps<typeof TableCellLinkContextMenu>, 'ref'>;
};

// ADR-739 §67 — η τέταρτη επιφάνεια δεξιού κλικ πίνακα, ίδιο συμβόλαιο μονταρίσματος με τα
// τρία μενού από πάνω — με τη διαφορά ότι εδώ δεν υπάρχει μενού, μόνο η γραμμή εργαλείων.
type TableTextToolbarMount = {
  ref: React.RefObject<TableTextToolbarHandle | null>;
  props: Omit<React.ComponentProps<typeof TableTextMiniToolbar>, 'ref'>;
};

export interface CanvasSectionOverlaysProps {
  drawingMenuRef: React.RefObject<DrawingContextMenuHandle | null>;
  guideMenuRef: React.RefObject<GuideContextMenuHandle | null>;
  guideBatchMenuRef: React.RefObject<GuideBatchContextMenuHandle | null>;
  drawingMenu: Omit<DrawingMenuProps, 'ref'>;
  // ADR-532 B4 — entity menu is a selection-subscribed leaf (own props bag, incl. ref).
  entityMenuHost: EntityContextMenuHostProps;
  guideMenu: Omit<GuideMenuProps, 'ref'>;
  guideBatchMenu: Omit<GuideBatchMenuProps, 'ref'>;
  quickHover: QuickHoverProps;
  quickMini: QuickMiniProps;
  propertiesPalette: PalettePropsT;
  mirrorOverlay: MirrorOverlayProps | null;
  textEditorOverlay: TextOverlayProps | null;
  textCreationOverlay: TextOverlayProps | null;
  // ADR-739 Φ.Δ βήμα 2 — ο δρομέας κελιού πίνακα (null όταν δεν υπάρχει τρέχον κελί).
  tableCellEditorOverlay: TableCellOverlayMount | null;
  // ADR-739 Φ.Δ βήμα 7 — η γραμμή τύπων (null με τον ίδιο ακριβώς όρο: κανένα τρέχον κελί).
  tableFormulaBar: TableFormulaBarMount | null;
  // ADR-739 Φ.Δ βήμα 9 — το μενού των ζωνών δείκτη: μονταρισμένο **πάντα** (ανοίγει imperative
  // μέσω ref, όπως κάθε άλλο μενού συμφραζομένων), αόρατο όσο δεν έχει στόχο.
  tableHeaderMenu: TableHeaderMenuMount;
  // ADR-750 Φ4 — το μενού περιγραμμάτων του δεξιού κλικ σε κελιά· ίδια σύμβαση με το παραπάνω:
  // μονταρισμένο πάντα, ανοίγει imperative μέσω ref, αόρατο όσο δεν έχει στόχο.
  tableRangeMenu: TableRangeMenuMount;
  tableLinkMenu: TableLinkMenuMount;
  // ADR-739 §67 — η γραμμή του κειμένου: ίδια σύμβαση με τα τρία από πάνω (μονταρισμένη πάντα,
  // αόρατη όσο δεν έχει στόχο), αλλά η θύρα της ανοίγει από τα **πεδία**, όχι από τον καμβά.
  tableTextToolbar: TableTextToolbarMount;
  selectionCycling: CyclingProps;
}

export const CanvasSectionOverlays: React.FC<CanvasSectionOverlaysProps> = (p) => {
  return (
    <>
      <DrawingContextMenu ref={p.drawingMenuRef as React.Ref<DrawingContextMenuHandle>} {...p.drawingMenu} />
      <EntityContextMenuHost {...p.entityMenuHost} />
      <GuideContextMenu ref={p.guideMenuRef as React.Ref<GuideContextMenuHandle>} {...p.guideMenu} />
      <GuideBatchContextMenu ref={p.guideBatchMenuRef as React.Ref<GuideBatchContextMenuHandle>} {...p.guideBatchMenu} />
      <PromptDialog />
      <GripHoverMenu />
      {/* ADR-357 Phase 11 — Right-click hot grip context menu (AutoCAD, micro-leaf, ADR-040) */}
      <GripContextMenu />
      {/* ADR-357 Phase 8 — Quick Properties hover tooltip (micro-leaf, ADR-040) */}
      <QuickPropertiesHoverPopover {...p.quickHover} />
      {/* ADR-357 Phase 9 — Quick Properties mini-panel on double-click (micro-leaf, ADR-040) */}
      <QuickPropertiesMiniPanel {...p.quickMini} />
      {/* ADR-357 Phase 10 — Full Properties Palette F11/Ctrl+1 (micro-leaf, ADR-040) */}
      <PropertiesPalette {...p.propertiesPalette} />
      {p.mirrorOverlay && <MirrorConfirmOverlay {...p.mirrorOverlay} />}
      {p.textEditorOverlay && <TextEditorOverlay {...p.textEditorOverlay} />}
      {p.textCreationOverlay && <TextEditorOverlay {...p.textCreationOverlay} />}
      {/* ADR-612 — opening-info-tag inline numeric cell editor (store-driven, no props). */}
      <OpeningInfoTagEditorOverlay />
      {/* ADR-739 Φ.Δ βήμα 2 — ο δρομέας κελιού: ζει όσο υπάρχει τρέχον κελί, αόρατος σε
          κατάσταση πλοήγησης, και κατέχει το πληκτρολόγιο επειδή ΕΙΝΑΙ πεδίο κειμένου. */}
      {p.tableCellEditorOverlay && (
        <TableCellEditorOverlay key={p.tableCellEditorOverlay.key} {...p.tableCellEditorOverlay.props} />
      )}
      {/* ADR-739 Φ.Δ βήμα 7 — η γραμμή τύπων: δείχνει ΠΟΙΟ κελί και ΟΛΟΚΛΗΡΗ την τιμή του,
          χωρίς να μπεις σε γραφή — και είναι το μόνο μέρος όπου τύπος και αποτέλεσμα
          μπορούν να συνυπάρξουν (προϋπόθεση του Φ.Δ.11). */}
      {p.tableFormulaBar && (
        <TableFormulaBar key={p.tableFormulaBar.key} {...p.tableFormulaBar.props} />
      )}
      {/* Giorgio 2026-08-04 — «Πλάτος: 14,14 (104 pixel)» όσο σέρνεται ένα διαχωριστικό.
          Φύλλο χωρίς props: δες την κεφαλίδα του για το γιατί (ADR-040). */}
      <TableResizeReadoutOverlay />
      {/* ADR-739 Φ.Δ βήμα 9 — εισαγωγή/διαγραφή γραμμής & στήλης από τις ζώνες δείκτη. Είναι
          **μέλος της συνεδρίας** επεξεργασίας: δες την κεφαλίδα του component. */}
      <TableHeaderContextMenu
        ref={p.tableHeaderMenu.ref as React.Ref<TableHeaderContextMenuHandle>}
        {...p.tableHeaderMenu.props}
      />
      {/* ADR-750 Φ4 — δεξί κλικ ΜΕΣΑ στο πλέγμα: οι 13 εντολές περιγράμματος του Excel, με
          στόχο την επιλογή όταν το κελί ανήκει σε αυτήν και το κελί μόνο του αλλιώς (Α22). */}
      <TableRangeContextMenu
        ref={p.tableRangeMenu.ref as React.Ref<TableRangeContextMenuHandle>}
        {...p.tableRangeMenu.props}
      />
      {/* 🔴 ADR-751 Φ8.β — δεξί κλικ πάνω σε **διεύθυνση** μέσα σε κελί: άνοιγμα + αντιγραφή.
          Δύο εντολές, όχι οι τέσσερις του Excel — ο σύνδεσμός μας παράγεται από το κείμενο,
          άρα «επεξεργασία/αφαίρεση» δεν έχουν αντικείμενο (δες την κεφαλίδα του component). */}
      <TableCellLinkContextMenu
        ref={p.tableLinkMenu.ref as React.Ref<TableCellLinkContextMenuHandle>}
        {...p.tableLinkMenu.props}
      />
      {/* 🔴 ADR-739 §67 — δεξί κλικ ΜΕΣΑ σε πεδίο κειμένου της συνεδρίας: **μόνο** το mini
          toolbar τυπογραφίας, χωρίς μενού — ακριβώς όπως το Excel σε κατάσταση Επεξεργασίας
          (§67.10). Χωρίς αυτό ο browser έδειχνε το native μενού του, γιατί τα δύο πεδία ζουν
          εκτός του δοχείου όπου ακούει ο δρομολογητής δεξιού κλικ του καμβά. */}
      <TableTextMiniToolbar
        ref={p.tableTextToolbar.ref as React.Ref<TableTextToolbarHandle>}
        {...p.tableTextToolbar.props}
      />
      {/* ADR-357 Phase 15 — G13 Selection Cycling popover (portal, micro-leaf, ADR-040) */}
      <SelectionCyclingPopover {...p.selectionCycling} />
      {/* ADR-659 — overlap «⧉ N» badge (portal, micro-leaf, ADR-040) */}
      <OverlapCountBadge />
      {/* 🔴 ADR-751 Φ7 — η ένδειξη που διδάσκει το Ctrl+κλικ πάνω σε διεύθυνση κελιού. Δίπλα
          στον αδελφό της (ίδιο portal, ίδιο micro-leaf συμβόλαιο): χωρίς προπ, όλη η
          κατάσταση έρχεται από το χαμηλόσυχνο store της. */}
      <TableCellLinkTooltip />
      {/* 🔴 ADR-751 Φ8.γ — «Άνοιγμα εντοπισμένου συνδέσμου…» (μοτίβο VS Code): οι διευθύνσεις
          του πίνακα χωρίς ποντίκι. Χωρίς προπ, όπως το tooltip: όλη η κατάσταση έρχεται από
          το χαμηλόσυχνο store της, άρα ο orchestrator δεν αποκτά συνδρομή (ADR-040). */}
      <TableLinkPicker />
      {/* 🔴 ADR-828 §7.2 — δεξί **σύρσιμο** της λαβής: αντιγραφή / σειρά / μόνο μορφή /
          χωρίς μορφή, και οι τέσσερις μονάδες ημερολογίου. Η χειρονομία το ανοίγει μόνη της
          (θύρα), γιατί ο δρομολογητής δεξιού κλικ **καταπνίγει** κάθε μενού μετά από δεξί σύρσιμο. */}
      <TableFillOptionsMenu />
    </>
  );
};
