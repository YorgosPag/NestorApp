'use client';

/**
 * Lazy-loaded UI subtree for DxfViewerContent.
 *
 * Extracted from DxfViewerContent.tsx to keep the host file under the
 * 500-line Google SRP limit (CHECK 4). Components are loaded lazily so
 * the initial DXF Viewer route bundle stays small.
 */
import React from 'react';

export const TestsModal = React.lazy(() => import('../ui/components/TestsModal').then(mod => ({ default: mod.TestsModal })));
export const CreditsDialog = React.lazy(() => import('../ui/components/CreditsDialog').then(mod => ({ default: mod.CreditsDialog })));
export const FloorplanBackgroundPanel = React.lazy(() => import('../floorplan-background').then(mod => ({ default: mod.FloorplanBackgroundPanel })));
export const ReplaceConfirmDialog = React.lazy(() => import('../floorplan-background').then(mod => ({ default: mod.ReplaceConfirmDialog })));
export const CalibrationDialog = React.lazy(() => import('../floorplan-background').then(mod => ({ default: mod.CalibrationDialog })));
export const DxfAiChatPanel = React.lazy(() => import('../ai-assistant/components/DxfAiChatPanel'));
export const DxfFindReplaceHost = React.lazy(() => import('../ui/text-toolbar/DxfFindReplaceHost').then(mod => ({ default: mod.DxfFindReplaceHost })));
export const DxfSymbolPickerHost = React.lazy(() => import('../ui/text-toolbar/DxfSymbolPickerHost').then(mod => ({ default: mod.DxfSymbolPickerHost })));
export const RenumberOpeningsHost = React.lazy(() => import('../ui/components/bim-openings/RenumberOpeningsHost').then(mod => ({ default: mod.RenumberOpeningsHost })));
export const OpeningTagStyleHost = React.lazy(() => import('../ui/components/bim-openings/OpeningTagStyleHost').then(mod => ({ default: mod.OpeningTagStyleHost })));
export const OpeningSchedulePdfHost = React.lazy(() => import('../ui/components/bim-openings/OpeningSchedulePdfHost').then(mod => ({ default: mod.OpeningSchedulePdfHost })));
// ADR-396 P6 — Thermal Envelope (ETICS) authoring dialog host
export const ThermalEnvelopeHost = React.lazy(() => import('../ui/components/bim-envelope/ThermalEnvelopeHost').then(mod => ({ default: mod.ThermalEnvelopeHost })));
// ADR-363 §6 Phase 8 — BIM Schedule («Πίνακας BIM») dialog host
export const BimScheduleHost = React.lazy(() => import('./BimScheduleHost').then(mod => ({ default: mod.BimScheduleHost })));
// ADR-453 — Print/Export («Εκτύπωση») dialog host
export const PrintHost = React.lazy(() => import('./PrintHost').then(mod => ({ default: mod.PrintHost })));
// ADR-662 Φάση 1 — «Τοπογραφικό» ribbon bridge host (mounts topo hooks + section-in-dialog)
export const TopoRibbonHost = React.lazy(() => import('./TopoRibbonHost').then(mod => ({ default: mod.TopoRibbonHost })));
// ADR-505 — Export («Εξαγωγή») dialog host (DXF/IFC/PDF, scope-filtered, multi-floor)
export const ExportHost = React.lazy(() => import('./ExportHost').then(mod => ({ default: mod.ExportHost })));
// ADR-651 Φάση Ε — διάλογος σφραγίδας μηχανικού (ανοίγει από το «Πινακίδα Σχεδίου» tab).
export const StampHost = React.lazy(() => import('./StampHost').then(mod => ({ default: mod.StampHost })));
// ADR-651 Φάση Δ — διάλογος «AI Πινακίδα» (ανοίγει από το «Πινακίδα Σχεδίου» tab).
export const AiTitleBlockHost = React.lazy(() => import('./AiTitleBlockHost').then(mod => ({ default: mod.AiTitleBlockHost })));
export const RevisionsHost = React.lazy(() => import('./RevisionsHost').then(mod => ({ default: mod.RevisionsHost })));
// ADR-651 Φάση Θ — διάλογος «Βιβλιοθήκη Προτύπων Πινακίδας» (γραφείου / έργου / δικά μου).
export const TitleBlockLibraryDialogHost = React.lazy(() => import('./TitleBlockLibraryDialogHost').then(mod => ({ default: mod.TitleBlockLibraryDialogHost })));
// ADR-457 — Column Reinforcement Detail Sheet («Λεπτομέρεια Οπλισμού») dialog host
export const ColumnDetailHost = React.lazy(() => import('../ui/components/column-detail/ColumnDetailHost').then(mod => ({ default: mod.ColumnDetailHost })));
// ADR-463 — Footing Reinforcement Detail Sheet («Λεπτομέρεια Οπλισμού») dialog host
export const FoundationDetailHost = React.lazy(() => import('../ui/components/foundation-detail/FoundationDetailHost').then(mod => ({ default: mod.FoundationDetailHost })));
// ADR-471 — Beam Reinforcement Detail Sheet («Λεπτομέρεια Οπλισμού») dialog host
export const BeamDetailHost = React.lazy(() => import('../ui/components/beam-detail/BeamDetailHost').then(mod => ({ default: mod.BeamDetailHost })));
// ADR-476 — Slab Reinforcement Detail Sheet («Λεπτομέρεια Οπλισμού») dialog host
export const SlabDetailHost = React.lazy(() => import('../ui/components/slab-detail/SlabDetailHost').then(mod => ({ default: mod.SlabDetailHost })));
// ADR-723 — «Διαχειριστής Στρώσεων» ως modeless palette (ήταν modal dialog, ADR-391).
// Το ενδιάμεσο `AdminLayerManagerDialogHost` καταργήθηκε: ήταν καθαρό pass-through των props.
export const AdminLayerManagerPalette = React.lazy(() => import('../ui/components/AdminLayerManagerPalette').then(mod => ({ default: mod.AdminLayerManagerPalette })));
// ADR-736 Φ4 — modeless παλέτα «Εξωτερικές Αναφορές» (αδελφή της παραπάνω, ίδιο κέλυφος).
export const ExternalReferencesPalette = React.lazy(() => import('../ui/components/ExternalReferencesPalette').then(mod => ({ default: mod.ExternalReferencesPalette })));
// ADR-745 Φ3β — «Σύνδεση Πινακίδας»: lazy όπως κάθε παλέτα, ώστε ο Λ2 και το στιγμιότυπο επαφών
// να μην μπαίνουν καν στο πακέτο εκκίνησης του θεατή.
export const TitleBlockBindingPalette = React.lazy(() => import('../ui/components/TitleBlockBindingPalette').then(mod => ({ default: mod.TitleBlockBindingPalette })));
// ADR-736 §5 — ΠΑΝΤΑ mounted, ζωγραφίζει `null`: η αυτόματη επίλυση δεν επιτρέπεται να κρέμεται
// από την παλέτα (που είναι κλειστή σχεδόν πάντα). Βλ. το αρχείο για το μετρημένο περιστατικό.
export const ExternalReferencesAutoResolveHost = React.lazy(() => import('../ui/components/ExternalReferencesAutoResolveHost').then(mod => ({ default: mod.ExternalReferencesAutoResolveHost })));
// ADR-683 Φ3.1β — «Ανάθεση προμέτρησης» dialog host (εισαγόμενο πλέγμα → άρθρο ΑΤΟΕ + μονάδα)
export const ImportedMeshBoqHost = React.lazy(() => import('./ImportedMeshBoqHost').then(mod => ({ default: mod.ImportedMeshBoqHost })));
export const ImportedMeshMaterialMapHost = React.lazy(() => import('./ImportedMeshMaterialMapHost').then(mod => ({ default: mod.ImportedMeshMaterialMapHost })));
// Floor management («Όροφοι Κτιρίου») dialog host — open from Levels panel ⚙️ / floor-tab right-click
export const FloorManagementDialogHost = React.lazy(() => import('./FloorManagementDialogHost').then(mod => ({ default: mod.FloorManagementDialogHost })));
// ADR-581 — «Αντιγραφή Ιδιοτήτων» (Match/Transfer Properties) dialog host — open from multi-selection contextual tab
export const MatchPropertiesDialogHost = React.lazy(() => import('./MatchPropertiesDialogHost').then(mod => ({ default: mod.MatchPropertiesDialogHost })));
// ADR-581 §12 — optional AI intent row inside the Match dialog (flag-gated, kept out of base bundle)
export const MatchAiPrompt = React.lazy(() => import('../ui/match-properties/MatchAiPrompt').then(mod => ({ default: mod.MatchAiPrompt })));
// ADR-363 Φ3c — «Κολώνα από περίγραμμα» confirm dialog (self-subscribing, zero props)
export const ColumnPerimeterConfirmDialog = React.lazy(() => import('../ui/dialogs/ColumnPerimeterConfirmDialog').then(mod => ({ default: mod.ColumnPerimeterConfirmDialog })));
// ADR-419 §gap-close — «Να κλείσω το κενό;» confirm dialog (self-subscribing, zero props)
export const GapCloseConfirmDialog = React.lazy(() => import('../ui/dialogs/GapCloseConfirmDialog').then(mod => ({ default: mod.GapCloseConfirmDialog })));
// ADR-398 §3.17 — «Υιοθέτηση μεγέθους ορθογωνίου» confirm dialog (self-subscribing, zero props)
export const ColumnAdoptSizeDialog = React.lazy(() => import('../ui/dialogs/ColumnAdoptSizeDialog').then(mod => ({ default: mod.ColumnAdoptSizeDialog })));
// ADR-363 §5.6 — «Οι διαστάσεις δημιουργούν τοιχίο» edit-time confirm dialog (self-subscribing, zero props)
export const ColumnBecomesWallDialog = React.lazy(() => import('../ui/dialogs/ColumnBecomesWallDialog').then(mod => ({ default: mod.ColumnBecomesWallDialog })));
// ADR-363 §5.6b — «Ασυνήθιστες διαστάσεις τοιχίου» (πάχος/μήκος) edit-time confirm dialog (self-subscribing)
export const ShearWallExtentDialog = React.lazy(() => import('../ui/dialogs/ShearWallExtentDialog').then(mod => ({ default: mod.ShearWallExtentDialog })));
// ADR-363 §5.6c — «Σχέσεις διατομής εκτός εύρους» ΓΕΝΙΚΟ edit-time confirm dialog (όλοι οι τύποι, self-subscribing)
export const SectionRelationshipDialog = React.lazy(() => import('../ui/dialogs/SectionRelationshipDialog').then(mod => ({ default: mod.SectionRelationshipDialog })));
// ADR-524 — «Πολλαπλή πλήρωση όμοιων πλαισίων» confirm dialog (self-subscribing, zero props)
export const ColumnBatchFillConfirmDialog = React.lazy(() => import('../ui/dialogs/ColumnBatchFillConfirmDialog').then(mod => ({ default: mod.ColumnBatchFillConfirmDialog })));
// ADR-563 — «Αυτόματη Διαστασιολόγηση» options dialog (self-subscribing, zero props)
export const AutoDimensionOptionsDialog = React.lazy(() => import('../ui/dialogs/AutoDimensionOptionsDialog').then(mod => ({ default: mod.AutoDimensionOptionsDialog })));
// ADR-533 — «Ανίχνευση συμβόλου κουφώματος σε τοίχο» confirm dialog (self-subscribing, zero props)
export const DxfSymbolDetectConfirmDialog = React.lazy(() => import('../ui/dialogs/DxfSymbolDetectConfirmDialog').then(mod => ({ default: mod.DxfSymbolDetectConfirmDialog })));
// ADR-529 — «Προαγωγή γωνιακής κολόνας σε Γ (boundary element)» confirm dialog (self-subscribing, zero props)
export const ColumnPromoteConfirmDialog = React.lazy(() => import('../ui/dialogs/ColumnPromoteConfirmDialog').then(mod => ({ default: mod.ColumnPromoteConfirmDialog })));
// ADR-507 Φ3 — «η περιοχή έχει ήδη γραμμοσκίαση» confirm dialog (warn+allow, self-subscribing)
export const HatchOverlapConfirmDialog = React.lazy(() => import('../ui/dialogs/HatchOverlapConfirmDialog').then(mod => ({ default: mod.HatchOverlapConfirmDialog })));
// ADR-739 §36.22 — «υπάρχουν ήδη δεδομένα εδώ» (μεταφορά περιοχής πίνακα).
export const TableRangeOverwriteConfirmDialog = React.lazy(() => import('../ui/dialogs/TableRangeOverwriteConfirmDialog').then(mod => ({ default: mod.TableRangeOverwriteConfirmDialog })));
// ADR-755 — «θα κρατηθεί μόνο η επάνω αριστερή τιμή» (συγχώνευση κελιών πάνω σε περιεχόμενο).
export const TableMergeDiscardConfirmDialog = React.lazy(() => import('../ui/dialogs/TableMergeDiscardConfirmDialog').then(mod => ({ default: mod.TableMergeDiscardConfirmDialog })));
// ADR-833 §1.4 — «Άνοιγμα» αρχείου Excel: ο ΜΟΝΟΣ διάλογος του πίνακα με τρεις απαντήσεις.
export const TableXlsxOpenConfirmDialog = React.lazy(() => import('../ui/dialogs/TableXlsxOpenConfirmDialog').then(mod => ({ default: mod.TableXlsxOpenConfirmDialog })));
// ADR-763 — «Εισαγωγή συνάρτησης» (fx της γραμμής τύπων), parity με τον ομώνυμο διάλογο του Excel.
export const TableInsertFunctionDialog = React.lazy(() => import('../ui/dialogs/TableInsertFunctionDialog').then(mod => ({ default: mod.TableInsertFunctionDialog })));
// 🔴 ADR-739 §61 — «Μορφοποίηση κελιών»: ο **ΕΝΑΣ** ξενιστής των πέντε υποδοχών (δύο βελάκια
// κορδέλας · «Περισσότερα περιγράμματα…» · δεξί κλικ σε κελιά και σε ζώνες δείκτη · `Ctrl+1`).
// Μέχρι το §60 κάθε εκκινητής ζωγράφιζε τον δικό του — αδύνατο για συντόμευση, που δεν έχει
// component. Gate-at-mount: ο host ακούει μόνο το ελαφρύ store.
export const TableFormatCellsDialogHost = React.lazy(() => import('../ui/components/table-format-toolbar/format-cells-dialog/TableFormatCellsDialogHost').then(mod => ({ default: mod.TableFormatCellsDialogHost })));
// 🔴 ADR-828 Φ4β — gate-at-mount: το δέντρο του διαχειριστή λιστών (φόρμα, κατάλογος,
// συνδρομή στο `UserSettings`) φορτώνεται μόνο όταν κάποιος ζητήσει τον διάλογο.
export const AutoFillListsDialogHost = React.lazy(() => import('../ui/components/auto-fill-lists/AutoFillListsDialogHost').then(mod => ({ default: mod.AutoFillListsDialogHost })));
// 🔴 ADR-828 Φ4β — ο διάλογος «Προσαρμοσμένη ταξινόμηση…», gate-at-mount όπως τα αδέλφια του.
export const TableSortDialogHost = React.lazy(() => import('../ui/components/table-sort/TableSortDialogHost').then(mod => ({ default: mod.TableSortDialogHost })));
// ADR-763 Φ2 — «Ορίσματα συνάρτησης»: το δεύτερο βήμα της ίδιας εντολής, όπου η κλήση γεμίζει.
//
// 🔴 Ο ΜΟΝΟΣ ΔΙΑΛΟΓΟΣ ΤΟΥ ΑΡΧΕΙΟΥ ΜΕ PRELOAD — ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΒΕΛΤΙΣΤΟΠΟΙΗΣΗ ΤΑΧΥΤΗΤΑΣ.
// Οι υπόλοιποι ανοίγουν από **χειρονομία** του χρήστη, οπότε μια στιγμή `Suspense` είναι απλώς
// αναμονή. Αυτός ανοίγει από το **κλείσιμο άλλου διαλόγου**: ανάμεσα στο ξεμοντάρισμα της
// Φάσης 1 και στο μοντάρισμα αυτού, η εστίαση πέφτει στο `document.body` — δηλαδή ο δομικός
// φύλακας `isTextEntryTarget` απαντά `false` και οι **43** window listeners ξυπνούν πάνω σε
// έναν χρήστη που κοιτά διάλογο (ADR-763 §10). Ένα `Delete` σε εκείνο το παράθυρο σβήνει
// **οντότητα**. Με το chunk ήδη φορτωμένο, το `Suspense` δεν ενεργοποιείται καθόλου και τα δύο
// μονταρίσματα συμβαίνουν στο **ίδιο** commit.
//
// Η προφόρτωση **δεν** ζει εδώ αλλά στον έναν καλούντα (`TableInsertFunctionDialog`), δίπλα
// στη χειρονομία που τη δικαιολογεί: μια εξαγωγή εδώ θα ανάγκαζε εκείνο το αρχείο να κάνει
// στατικό import ολόκληρου αυτού του μητρώου για να πάρει μία γραμμή.
export const TableFunctionArgumentsDialog = React.lazy(() => import('../ui/dialogs/TableFunctionArgumentsDialog').then(mod => ({ default: mod.TableFunctionArgumentsDialog })));
export const DxfImportModal = React.lazy(() => import('../components/DxfImportModal'));
export const SimpleProjectDialog = React.lazy(() => import('../components/SimpleProjectDialog').then(mod => ({ default: mod.SimpleProjectDialog })));
export const ConstructionLayerScaffoldDialog = React.lazy(() => import('../hooks/useConstructionLayerScaffold').then(mod => ({ default: mod.ConstructionLayerScaffoldDialog })));
export const FloorplanImportWizard = React.lazy(() => import('@/features/floorplan-import').then(mod => ({ default: mod.FloorplanImportWizard })));
export const MainContentSection = React.lazy(() => import('../layout/MainContentSection').then(mod => ({ default: mod.MainContentSection })));
export const FloatingPanelsSection = React.lazy(() => import('../layout/FloatingPanelsSection').then(mod => ({ default: mod.FloatingPanelsSection })));
