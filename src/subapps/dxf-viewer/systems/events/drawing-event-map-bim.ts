/**
 * Drawing Event Map — BIM entity events (params/delete, grid-generation, attach,
 * perimeter, 3D placement, MEP circuits/networks, restore, IFC).
 *
 * Extracted from drawing-event-map.ts to keep that file <500 LOC (Google SRP,
 * CLAUDE.md N.7.1). Pure type module: zero runtime logic. `DrawingEventMap`
 * extends `BimEventMap` from here (sibling of `MepAutoDesignEventMap`).
 */

import type { Point2D } from '../../rendering/types/Types';
import type { AnySceneEntity } from '../../types/scene';
import type { OpeningKind } from '../../bim/types/opening-types';
import type { WallEntity, WallKind, WallCategory } from '../../bim/types/wall-types';
import type { OpeningUpdate } from '../../bim/walls/wall-split';

export interface BimEventMap {
  // ADR-363 Phase 1E — BIM wall grip + delete events
  'bim:wall-params-updated': { wallId: string };
  'bim:wall-delete-requested': { wallId: string };
  // ADR-363 Phase 2 — BIM opening grip + delete events
  'bim:opening-params-updated': { openingId: string };
  'bim:opening-delete-requested': { openingId: string };
  // ADR-376 Phase B.1 — Renumber Openings dialog trigger
  'bim:opening-renumber-requested': Record<string, never>;
  // ADR-376 Phase C.2 — Opening Tag Style dialog trigger
  'bim:opening-tag-style-requested': Record<string, never>;
  // ADR-376 Phase C.3 — Opening Schedule PDF export trigger
  'bim:opening-schedule-pdf-requested': Record<string, never>;
  // ADR-396 Phase P6 — Thermal Envelope (ETICS) authoring dialog trigger
  'bim:thermal-envelope-requested': Record<string, never>;
  // ADR-363 §6 Phase 8 — BIM Schedule («Πίνακας BIM») dialog trigger
  'bim:schedule-dialog-requested': Record<string, never>;
  // ADR-363 Phase 3 — BIM slab params + delete events
  'bim:slab-params-updated': { slabId: string };
  'bim:slab-delete-requested': { slabId: string };
  // ADR-417 Φ1-part-2 — BIM roof (κεκλιμένη στέγη) params + delete events
  'bim:roof-params-updated': { roofId: string };
  'bim:roof-delete-requested': { roofId: string };
  // ADR-419 — BIM floor-finish covering (IfcCovering FLOORING) params + delete events
  'bim:floor-finish-params-updated': { floorFinishId: string };
  'bim:floor-finish-delete-requested': { id: string };
  // ADR-422 — BIM thermal space (IfcSpace) params + delete events
  'bim:thermal-space-params-updated': { thermalSpaceId: string };
  'bim:thermal-space-delete-requested': { id: string };
  // ADR-437 — BIM space separator (IfcVirtualElement) params + delete events
  'bim:space-separator-params-updated': { spaceSeparatorId: string };
  'bim:space-separator-delete-requested': { id: string };
  // ADR-363 Phase 3.7 — BIM slab-opening params + delete events
  'bim:slab-opening-params-updated': { slabOpeningId: string };
  'bim:slab-opening-delete-requested': { slabOpeningId: string };
  // ADR-363 Phase 3.7b+ — multi-storey stack dialog trigger
  'bim:slab-opening-stack-requested': { opening: import('../../bim/types/slab-opening-types').SlabOpeningEntity };
  // ADR-363 Phase 4 — BIM column params + delete events
  'bim:column-params-updated': { columnId: string };
  'bim:column-delete-requested': { columnId: string };
  // ADR-436 Slice 1b — BIM foundation params event (grip-drag commit)
  'bim:foundation-params-updated': { foundationId: string };
  // ADR-436 Slice 1-persist — BIM foundation delete event (Firestore deleteDoc)
  'bim:foundation-delete-requested': { foundationId: string };
  // ADR-441 Slice 2+6+6b+5a-grid — managed reconcile εσχάρας από τον κάναβο.
  // `created` = νέες λωρίδες· `deleted` = obsolete που αντικαταστάθηκαν (split)·
  // `rehosted` = legacy ορφανές που ξανα-κρεμάστηκαν (Slice 6b)· `reJustified` = auto
  // λωρίδες που ευθυγραμμίστηκαν με τον κανόνα έδρασης όταν άλλαξε ρόλος άξονα (5a-grid).
  // 0/0/0/0 → «ενημερωμένο» (idempotent re-run). UI: non-blocking Revit-style summary
  // toast (πληθυντικότητα ICU).
  'bim:foundations-from-grid': { created: number; deleted: number; rehosted: number; reJustified: number };
  // ADR-441 Slice 7 — ένας άξονας του κανάβου μετακινήθηκε & «κάθισε» (drag-complete
  // settle). Εκπέμπεται από τον grid settle-emitter όταν αλλάζει όντως το σύνολο των
  // ορατών offsets ΚΑΙ δεν σύρεται πια οδηγός. Ο foundation bridge το ακούει → τρέχει
  // αυτόματα το ίδιο managed reconcile με το «Εσχάρα» (live re-split + reflow γωνιών),
  // χωρίς ο μηχανικός να πατήσει κουμπί (Revit associative grid). Toast μόνο αν delta>0.
  'bim:grid-guides-settled': { levelId: string };
  // ADR-441 Slice 2 — η εσχάρα δεν παρήχθη: 'insufficient-guides' (<2 άξονες
  // ανά διεύθυνση) ή 'empty' (κανένα έγκυρο segment). UI: warning toast.
  'bim:foundations-from-grid-failed': { reason: 'insufficient-guides' | 'empty' };
  // ADR-441 Slice GEN-COL — «Κολώνες από κάναβο»: born-bound κολώνα ανά τομή αξόνων.
  // `skipped` = τομές με ήδη υπάρχουσα grid κολώνα (idempotent). 0 created → «ενημερωμένο».
  'bim:columns-from-grid': { created: number; skipped: number };
  'bim:columns-from-grid-failed': { reason: 'insufficient-guides' };
  // ADR-441 Slice GEN-WALL — «Τοίχοι από κάναβο»: born-bound τοίχος ανά segment άξονα.
  'bim:walls-from-grid': { created: number; skipped: number };
  'bim:walls-from-grid-failed': { reason: 'insufficient-guides' };
  // ADR-441 Slice GEN-TIE — «Συνδετήριες από κάναβο»: born-bound συνδετήρια ανά segment.
  // `skipped` = segments με ήδη υπάρχουσα grid συνδετήρια (idempotent)· `jointed` =
  // υπάρχουσες που έκλεισαν γωνία (junction-miter). 0 created & 0 jointed → «ενημερωμένο».
  'bim:tie-beams-from-grid': { created: number; skipped: number; jointed: number };
  'bim:tie-beams-from-grid-failed': { reason: 'insufficient-guides' };
  // ADR-441 Slice GEN-BEAM — «Δοκάρια από κάναβο»: born-bound δοκός ανά segment άξονα.
  // `skipped` = segments με ήδη υπάρχουσα grid δοκό (idempotent). 0 created → «ενημερωμένο».
  'bim:beams-from-grid': { created: number; skipped: number };
  'bim:beams-from-grid-failed': { reason: 'insufficient-guides' };
  // ADR-441 Slice GEN-SLAB — «Πλάκες από κάναβο»: εδαφόπλακα (ενιαία) / δάπεδα / οροφές.
  // `skipped` = components/φατνώματα με ήδη υπάρχουσα grid πλάκα (idempotent).
  // `reason='no-footprint'` = μηδέν δομικά στοιχεία (κενός όροφος).
  'bim:slabs-from-grid': { created: number; skipped: number };
  'bim:slabs-from-grid-failed': { reason: 'no-footprint' | 'insufficient-guides' };
  // ADR-448 Phase 2 — soft warning: θεμελίωση/εδαφόπλακα δημιουργείται εκτός του
  // κατώτατου ορόφου (Revit-style: επιτρέπεται αλλά προειδοποιεί, δεν μπλοκάρει).
  'bim:foundation-on-upper-storey': { kind: 'foundation' | 'ground-slab' };
  // ADR-461 — soft warning: κανονικό (floor-framing) δοκάρι σε στάθμη ΘΕΜΕΛΙΩΣΗΣ·
  // πιθανώς εννοείται πεδιλοδοκός/συνδετήρια δοκός (Revit-style: επιτρέπεται, προτείνει).
  'bim:beam-on-foundation-storey': Record<string, never>;
  // ADR-441 3-mode — soft warning: δομικά στοιχεία διαφορετικού τύπου στον ΙΔΙΟ άξονα με
  // αντίθετη έδραση (π.χ. κολόνες inner + τοίχοι outer) → παρειές δεν ευθυγραμμίζονται.
  // Revit-style: μη-blocking. `axisCount` = πόσοι άξονες έχουν ασυνέπεια.
  'bim:grid-justification-conflict': { axisCount: number };
  // ADR-406 — BIM MEP fixture params + delete events
  'bim:mep-fixture-params-updated': { fixtureId: string };
  'bim:mep-fixture-delete-requested': { fixtureId: string };
  // ADR-410 — BIM furniture params + delete events
  'bim:furniture-params-updated': { furnitureId: string };
  'bim:furniture-delete-requested': { furnitureId: string };
  // ADR-408 Φ3 — BIM electrical panel params + delete events
  'bim:electrical-panel-params-updated': { panelId: string };
  'bim:electrical-panel-delete-requested': { panelId: string };
  // ADR-408 Φ12 — BIM MEP manifold (plumbing) params + delete events
  'bim:mep-manifold-params-updated': { manifoldId: string };
  'bim:mep-manifold-delete-requested': { manifoldId: string };
  // ADR-408 Εύρος Β — BIM heating radiator params + delete events
  'bim:mep-radiator-params-updated': { radiatorId: string };
  'bim:mep-radiator-delete-requested': { radiatorId: string };
  // ADR-408 Εύρος Β #2 — BIM heating boiler params + delete events
  'bim:mep-boiler-params-updated': { boilerId: string };
  'bim:mep-boiler-delete-requested': { boilerId: string };
  // ADR-408 — BIM DHW water heater (θερμοσίφωνας / ΖΝΧ) params + delete + 3D placement events
  'bim:mep-water-heater-params-updated': { waterHeaterId: string };
  'bim:mep-water-heater-delete-requested': { waterHeaterId: string };
  'bim:place-mep-water-heater-3d': { point: Point2D };
  // ADR-408 Εύρος Β #3 — BIM underfloor heating loop params + delete events
  'bim:mep-underfloor-params-updated': { underfloorId: string };
  'bim:mep-underfloor-delete-requested': { underfloorId: string };
  // ADR-408 Φ8 — BIM MEP segment (duct/pipe) params + delete events
  'bim:mep-segment-params-updated': { segmentId: string };
  'bim:mep-segment-delete-requested': { segmentId: string };
  // ADR-408 — MEP system (electrical circuit) lifecycle + integrity events.
  'bim:mep-system-changed': { systemId: string };
  'bim:mep-system-member-missing': { systemId: string; entityId: string; connectorId: string };
  // ADR-408 Φ5 — circuit creation feedback (create-from-selection UI).
  'bim:mep-circuit-created': { memberCount: number };
  'bim:mep-circuit-create-failed': { reason: 'no-source' | 'multiple-sources' | 'no-members' };
  // ADR-408 Φ6 — circuit member-management feedback (properties panel).
  'bim:mep-circuit-members-added': { memberCount: number };
  'bim:mep-circuit-members-removed': { memberCount: number };
  'bim:mep-circuit-edit-failed': { reason: 'noActiveCircuit' | 'addFailed' | 'removeFailed' };
  // ADR-408 Φ10 — pipe-network auto-derivation feedback (whole-scene connectivity).
  'bim:mep-networks-derived': { networkCount: number };
  // ADR-408 Φ13 — plumbing pipe-network from-manifold-selection feedback.
  'bim:mep-network-created': { memberCount: number };
  'bim:mep-network-create-failed': { reason: 'no-source' | 'multiple-sources' | 'no-members' };
  'bim:mep-network-members-added': { memberCount: number };
  'bim:mep-network-members-removed': { memberCount: number };
  'bim:mep-network-edit-failed': { reason: 'noActiveNetwork' | 'addFailed' | 'removeFailed' };
  // MEP auto-design feedback events (water-supply…gas) → `MepAutoDesignEventMap` (N.7.1 split).
  // ADR-407 — BIM railing params + delete events
  'bim:railing-params-updated': { railingId: string };
  'bim:railing-delete-requested': { railingId: string };
  // ADR-412 Φ5 — a BIM family type's `typeParams` changed (edit or delete).
  // The optimistic store `setTypes` already re-flows geometry to in-scene
  // instances (useWallTypeReresolution); this event drives the all-floors BOQ
  // re-feed side-effect, which needs project/building context only the
  // persistence host holds. Fires on command execute/undo. `category` reserved
  // for non-wall family types (host handler scopes to 'wall' + 'slab' + 'roof').
  'bim:family-type-changed': { typeId: string; category: 'wall' | 'slab' | 'stair' | 'roof' | 'opening' };
  // ADR-403 — 3D column placement: the 3D viewport projected a click onto the
  // active floor plane and converted it to the active scene units. The 2D
  // `useColumnTool` listens and runs its existing `onCanvasClick(point)` commit
  // path (enterprise id + scene append + auto 3D-resync) — no logic duplicated.
  'bim:place-column-3d': { point: Point2D };
  // ADR-406 — 3D MEP fixture placement (mirror of bim:place-column-3d).
  'bim:place-mep-fixture-3d': { point: Point2D };
  // ADR-408 Φ3 — 3D electrical panel placement (mirror of bim:place-column-3d).
  'bim:place-electrical-panel-3d': { point: Point2D };
  // ADR-408 Φ12 — 3D plumbing manifold placement (mirror of bim:place-electrical-panel-3d).
  'bim:place-mep-manifold-3d': { point: Point2D };
  // ADR-408 Εύρος Β — 3D heating radiator placement (mirror of bim:place-mep-manifold-3d).
  'bim:place-mep-radiator-3d': { point: Point2D };
  // ADR-408 Εύρος Β #2 — 3D heating boiler placement (mirror of bim:place-mep-radiator-3d).
  'bim:place-mep-boiler-3d': { point: Point2D };
  // ADR-408 Φ8 — 3D MEP segment placement (2-click bridge; reserved for 3D tool).
  // The point carries an optional `z` (mm, floor-relative): the endpoint elevation
  // resolved at click time — a snapped connector's z (Φ-B1 connector-mate) or the
  // current centreline offset (Revit-style per-click elevation → sloped runs/risers).
  'bim:place-mep-segment-3d': { point: Point2D & { z?: number } };
  // ADR-407 — 3D railing placement (mirror of bim:place-column-3d).
  'bim:place-railing-3d': { point: Point2D };
  // ADR-410 — 3D furniture placement (mirror of bim:place-column-3d).
  'bim:place-furniture-3d': { point: Point2D };
  // ADR-401 — 3D manual attach pick-host: the 3D viewport raycast a structural
  // host (beam/slab) while a `*-attach-top/-base` tool is active. The 2D
  // `useWallAttachTool` listens and dispatches the existing Attach{Walls|Columns|
  // Stairs} command for the already-captured target(s) — no logic duplicated
  // (mirror of the `bim:place-column-3d` bridge).
  'bim:attach-host-picked-3d': { hostId: string };
  // ADR-363 «Δοκάρι από τοίχο» — 3D pick: the 3D viewport raycast a wall mesh
  // while the `beam-from-wall` tool is active. The 2D `useBeamTool` listens and
  // builds the beam on that wall's axis via its existing from-wall commit core
  // (`buildBeamFromWall` + `onBeamCreated` → auto-attaches the wall top, ADR-401
  // D) — no geometry/commit logic duplicated (mirror of `bim:place-column-3d`).
  'bim:beam-from-wall-picked-3d': { wallId: string };
  // ADR-363 Phase 5 — BIM beam params + delete events
  'bim:beam-params-updated': { beamId: string };
  'bim:beam-delete-requested': { beamId: string };
  // ADR-358 Phase 9C-3 — stair delete (Firestore cleanup on canvas Delete key)
  'bim:stair-delete-requested': { stairId: string };
  // ADR-390 — Symmetric undo/restore for BIM entity deletion.
  // Single generic event with type-discriminated payload — listeners type-guard
  // via `payload.entityType` + `isXType(snapshot)`. Emitted by
  // DeleteEntityCommand.undo() and DeleteMultipleEntitiesCommand.undo().
  'bim:entity-restore-requested': {
    // ADR-406 — 'mep-fixture' appended. ADR-407 — 'railing' appended. ADR-408 Φ3 — 'electrical-panel'. ADR-408 Φ8 — 'mep-segment'. ADR-410 — 'furniture'. ADR-408 Φ12 — 'mep-manifold'. ADR-408 Εύρος Β — 'mep-radiator'. ADR-408 Εύρος Β #2 — 'mep-boiler'. ADR-408 — 'mep-water-heater'.
    entityType: 'wall' | 'opening' | 'slab' | 'slab-opening' | 'column' | 'beam' | 'stair' | 'mep-fixture' | 'electrical-panel' | 'mep-manifold' | 'mep-radiator' | 'mep-boiler' | 'mep-water-heater' | 'mep-underfloor' | 'railing' | 'mep-segment' | 'furniture' | 'floor-finish' | 'roof' | 'thermal-space' | 'space-separator';
    entitySnapshot: AnySceneEntity;
    source: 'undo-delete' | 'redo-restore';
  };
  // ADR-363 Phase 5.5i+ — beam persisted → slabs re-compute BOQ deductions
  'bim:beam-persisted': { floorplanId: string };
  // ADR-459 — Structural Organism re-derived (DERIVED graph + cross-entity checks).
  // Emitted by `useStructuralOrganism` after each recompute so observers (panels,
  // future diagnostics dock) can react. `diagnosticCount` = total findings.
  'bim:structural-organism-updated': { diagnosticCount: number; levelId: string };
  // ADR-459 Φ4d — «Αυτόματος Οπλισμός» request (από ribbon action). `entityIds` =
  // η τρέχουσα επιλογή· κενό → ο handler οπλίζει όλον τον οργανισμό του ορόφου.
  'bim:auto-reinforce-requested': { entityIds: string[] };
  // ADR-459 Φ4d — N μέλη οπλίστηκαν (auto-apply command). `count` = πόσα πράγματι
  // οπλίστηκαν (idempotent skip). Trigger organism re-derive + toast.
  'bim:structural-auto-reinforced': { entityIds: string[]; count: number };
  // ADR-464 Slice 4 — «Υπολογισμός Φορτίων» request (από ribbon action). Tributary
  // load takedown σε όλα τα εγγράψιμα πέδιλα του ενεργού ορόφου (χωρίς scope επιλογής).
  'bim:compute-loads-requested': Record<string, never>;
  // ADR-464 Slice 4 — N πέδιλα έλαβαν αυτόματο φορτίο (takedown command). `count` =
  // πόσα πράγματι (skip χειροκίνητων). Trigger organism re-derive (έδραση) + toast.
  'bim:structural-loads-computed': { entityIds: string[]; count: number };
  // ADR-395 G6 — opening persisted/deleted → host wall re-computes net BOQ area
  'bim:opening-persisted': { wallId: string };
  // ADR-395 G2 — slab-opening persisted/deleted → host slab re-computes net BOQ volume
  'bim:slab-opening-persisted': { slabId: string };
  // ADR-363 Phase X — Wall split committed: persist delete+create+opening patch
  'bim:wall-split-committed': {
    originalWallId: string;
    wall1: WallEntity;
    wall2: WallEntity;
    openingUpdates: readonly OpeningUpdate[];
  };
  // ADR-363 Phase 7B — BIM variant kind shortcuts (keyboard D / Wn)
  // ADR-363 Phase A — BIM wall category chords (We/Wi/Wp/Wf/Wt)
  'bim:set-opening-kind': { kind: OpeningKind };
  'bim:set-wall-kind': { kind: WallKind };
  'bim:set-wall-category': { category: WallCategory };
  // ADR-363 Phase 1K Mode C — «Τοίχος σε περιοχή» box-select: the marquee
  // (window/crossing) collected these line-entity ids. The wall tool detects
  // ALL enclosed rectangles among them and builds one filling wall per
  // rectangle. Carries only ids (the tool re-reads the live scene geometry).
  'bim:wall-region-box-select': { entityIds: string[] };
  // ADR-401 Phase C — a deleted structural host (beam/slab) left ≥1 `attached`
  // wall without its top support. The wall falls back to baseline geometry
  // automatically (resolveWallTopProfile.missingHostIds); this signal lets the
  // UI surface a non-blocking warning (Revit "Top Constraint no longer valid").
  'bim:wall-attach-host-missing': { wallIds: string[]; deletedHostIds: string[] };
  // ADR-401 Phase D — N walls auto-attached their top to a just-created
  // structural host (beam/slab over them). Lets the UI surface a non-blocking
  // info toast (Revit auto-attach feedback). Undoable via AttachWallsTopCommand.
  'bim:walls-auto-attached': { wallIds: string[]; hostId: string };
  // ADR-401 (γ) — N walls auto-attached their BASE to a just-created foundation
  // host (beam/slab below them). Undoable via AttachWallsBaseCommand.
  'bim:walls-auto-attached-base': { wallIds: string[]; hostId: string };
  // ADR-401 Phase E.1 — manual attach/detach of wall top/base to a structural
  // host (ribbon «Σύνδεση/Αποκόλληση Κορυφής/Βάσης»). Undoable. UI surfaces a
  // non-blocking info toast (Revit Attach/Detach feedback).
  'bim:walls-attached-manual': { side: 'top' | 'base'; wallIds: string[]; hostId: string };
  'bim:walls-detached': { side: 'top' | 'base'; wallIds: string[] };
  // ADR-363 «Τοίχος από περίγραμμα» — N filling walls built from selected faces;
  // `ignored` counts garbage shapes + validator-rejected legs. UI surfaces a
  // non-blocking Revit-style summary toast («Δημιουργήθηκαν N· αγνοήθηκαν X»).
  'bim:walls-from-perimeter': { built: number; ignored: number };
  // ADR-363 Φάση 3 «Τοιχίο από περίγραμμα» — N τοιχία (ColumnEntity) χτίστηκαν από
  // τις επιλεγμένες παρειές (ΕΝΑ ανά κλειστή περίμετρο)· `ignored` = validator-
  // rejected περιγράμματα. UI surfaces non-blocking summary toast.
  'bim:columns-from-perimeter': { built: number; ignored: number };
  // ADR-363 Φάση 3c «Κολώνα από περίγραμμα» — ΧΩΡΙΣ ένωση· αυτόματη ταξινόμηση ανά
  // αναλογία πλευρών: `columns` = κολώνες (aspect<4), `walls` = τοιχία (aspect≥4 ή
  // σύνθετα), `ignored` = validator-rejected. UI: ενημερωτικό breakdown toast.
  'bim:columns-discrete-from-perimeter': { columns: number; walls: number; ignored: number };
  // ADR-419 — region/perimeter pick απορρίφθηκε (Layer 4/5). `oversized` = το
  // ανιχνευμένο περίγραμμα είναι το εξωτερικό περίγραμμα του σχεδίου (πολύ μεγάλο
  // για δομικό μέλος)· `no-closed-loop` = δεν βρέθηκε κλειστό loop κοντά στο pick
  // (οι γραμμές δεν ενώνονται). UI: non-blocking warning toast (+ optional highlight
  // ασύνδετων άκρων μέσω dxf.highlightByIds). widthM/depthM = διαστάσεις σε μέτρα.
  'bim:region-perimeter-rejected': {
    reason: 'oversized' | 'no-closed-loop';
    widthM?: number;
    depthM?: number;
  };
  // ADR-401 Phase F.3 — column attach mirrors of the wall events above. N columns
  // auto-attached their top/base to a just-created structural host. Undoable via
  // AttachColumnsCommand. UI surfaces a non-blocking info toast (Revit parity).
  'bim:columns-auto-attached': { columnIds: string[]; hostId: string };
  'bim:columns-auto-attached-base': { columnIds: string[]; hostId: string };
  // ADR-459 Phase 2 — N κολόνες εδραίωσαν το αναλυτικό FK πεδίλου (footingId) προς
  // ΕΝΑ footing element (auto, δημιουργία πεδίλου/κολόνας). Undoable via
  // AttachColumnFootingCommand. Triggers structural-organism recompute.
  'bim:column-footing-attached': { columnIds: string[]; footingId: string };
  // ADR-459 Φ4f — manual connectivity requests από την «Ανάλυση» (selection-driven,
  // δουλεύει με multi-selection). `useStructuralFootingConnect` αναλύει την επιλογή
  // → undoable Attach/DetachColumnFootingCommand.
  'bim:column-footing-attach-requested': { entityIds: string[] };
  'bim:column-footing-detach-requested': { entityIds: string[] };
  // ADR-459 Φ4f — result events: σύνδεση επιλεγμένων κολόνων σε πέδιλο / αποσύνδεση.
  // Trigger organism recompute + toast.
  'bim:column-footing-attached-manual': { columnIds: string[]; footingId: string };
  'bim:column-footing-detached': { columnIds: string[] };
  // ADR-401 Phase F.3 — manual attach/detach of column top/base (ribbon pick-host).
  'bim:columns-attached-manual': { side: 'top' | 'base'; columnIds: string[]; hostId: string };
  'bim:columns-detached': { side: 'top' | 'base'; columnIds: string[] };
  // ADR-363 Post-Creation Adjacency Merge — N γειτονικές κολόνες που σχηματίζουν
  // τοιχίο (Γ/Τ/Π) συγχωνεύτηκαν σε ΕΝΑ composite ColumnEntity (MergeColumnsCommand,
  // single undo). UI surfaces a non-blocking success toast (Revit «merge» feedback).
  'bim:columns-merged': { sourceIds: string[]; compositeId: string };
  // ADR-401 Phase G.3 — stair attach mirrors of the wall/column events above. N
  // stairs auto-attached their top/base to a just-created structural host (Revit
  // «Desired number of risers» re-step at render). Undoable via AttachStairsCommand.
  'bim:stairs-auto-attached': { stairIds: string[]; hostId: string };
  'bim:stairs-auto-attached-base': { stairIds: string[]; hostId: string };
  // ADR-401 Phase G.3 — manual attach/detach of stair top/base (ribbon pick-host).
  'bim:stairs-attached-manual': { side: 'top' | 'base'; stairIds: string[]; hostId: string };
  'bim:stairs-detached': { side: 'top' | 'base'; stairIds: string[] };
  // ADR-363 fix — multi-entity move dirty-flag propagation.
  // Carries the post-move entities directly so listeners never call
  // getLevelScene() (which returns stale React state at emit time).
  'bim:entities-moved': { movedEntities: ReadonlyArray<AnySceneEntity> };
  // ADR-396 P7 Part B — thermal envelope applied to a floor: per-element
  // `envelopeLayer`/`revealInsulation` written into the scene. Carries the
  // changed entities directly (same stale-state guard as `bim:entities-moved`)
  // so the existing persistence hooks (column/beam/slab via the shared moved
  // effect + opening via its own listener) save + audit + structural-BOQ them.
  'bim:envelope-applied': { entities: ReadonlyArray<AnySceneEntity> };
  // ADR-401 — N walls/columns/stairs had their structural attach binding changed
  // (auto-attach below a new host, manual attach/detach, detach-on-edit) by an
  // Attach/Detach command. Carries the post-change entities directly (same
  // stale-state guard as `bim:entities-moved`) so the shared persistence effect
  // (`useBimEntityMovedPersistEffect` for wall/column + the stair listener) saves +
  // audits them AND marks them dirty. WITHOUT this, a non-selected entity (the
  // common auto-attach case) never persists and the next Firestore snapshot's
  // diff-merge reverts the in-memory binding. Fires on execute/undo/redo.
  'bim:entities-attached': { entities: ReadonlyArray<AnySceneEntity> };
  /**
   * ADR-469 — ribbon «Ορατότητα στοιχείων» per-element override request. Το widget
   * (StructuralComponentElementOverride) emit-άρει το current selection + component +
   * value· ο `useStructuralComponentOverride` hook ακούει, χτίζει τον sceneManager
   * και εκτελεί `SetComponentVisibilityCommand` (undoable + persist). `value=null`
   * ⇒ καθάρισε το override (επιστροφή στο per-view flag).
   */
  'bim:set-component-visibility': {
    entityIds: readonly string[];
    component: 'core' | 'plaster' | 'reinforcement';
    value: boolean | null;
  };
  /** ADR-369 Q8.2 — ribbon IFC button → open PsetEditorHost dialog. */
  'bim:pset-editor-open': { entityId: string; levelId: string; entityType: string };
  /** ADR-457 — column contextual «Λεπτομέρεια Οπλισμού» → open ColumnDetailHost dialog. */
  'bim:column-detail-requested': { columnId: string; levelId: string };
  /** ADR-463 — foundation contextual «Λεπτομέρεια Οπλισμού» → open FoundationDetailHost dialog. */
  'bim:foundation-detail-requested': { foundationId: string; levelId: string };
  /** ADR-369 Q8.3 — ribbon IFC Export button → IfcExportHost downloads .ifc file. */
  'bim:ifc-export-requested': {
    /** Scope filter — if omitted, exports every building in project. */
    projectId?: string;
    buildingIds?: readonly string[];
    /** When true, include per-entity Property Sets in the IFC output. */
    includePsets?: boolean;
  };
}
