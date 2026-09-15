/**
 * ENTERPRISE ID PREFIXES — DXF / CAD / BIM — CONFIG DATA
 * Split from `enterprise-id-prefixes.ts` (N.7.1 file size). Spread into the ONE
 * canonical `ENTERPRISE_ID_PREFIXES` map there — never import this directly for ids.
 */

export const DXF_BIM_ID_PREFIXES = {
  // DXF Text Engine (ADR-344)
  TEXT_TEMPLATE: 'tpl_text',   // text_templates collection — hybrid title block / stamp templates
  DRAWING_REVISION: 'drev',    // drawing_revisions collection — project-level drawing revision (ADR-651 Φάση Η)
  COMPANY_FONT: 'fnt',         // company_fonts collection — uploaded TTF/OTF/SHX fonts per company
  DICT_ENTRY: 'dict',          // text_custom_dictionary collection — per-company spell-check terms

  // DXF Stair Tool (ADR-358)
  STAIR: 'stair',              // floorplan_stairs collection — parametric stair entity (11 kinds)
  STAIR_PRESET: 'sprst',       // stair_presets collection — library presets (user/company/project scope)

  // DXF Layer Filters Builder (ADR-358 §5.7.bis Q11 — Phase 11)
  LAYER_FILTER_GROUP: 'lfg',     // group filter (manual layer list)
  LAYER_FILTER_PROPERTY: 'lfp',  // property filter (rule-based, AND/OR nested)
  // NOTE: smart filter ids (`lfs_*`) are DETERMINISTIC strings — not enterprise IDs.

  // DXF Layer States Manager (ADR-358 §5.9 Q12 — Phase 12)
  LAYER_STATE: 'lst',            // user-saved layer state snapshot (visibility + style)

  // DXF Layer State Templates (ADR-358 §5.9 Q12 — Phase 13B, Cross-project Templates)
  LAYER_STATE_TEMPLATE: 'lstpl', // dxf_layer_state_templates collection — companyId-scoped, shareable
  DXF_TEMPLATE_CATEGORY: 'lstcat', // dxf_template_categories collection — per-company free-string catalog

  // DXF Enterprise Dimension System (ADR-362)
  DIMENSION: 'dim',            // dimension entity (10 variants: linear/aligned/angular/radial/diameter/ordinate/baseline/continued/arcLength/joggedRadius)
  DIM_STYLE: 'dimstyle',       // DIMSTYLE — ~60 vars, 3 built-in templates + user customs
  LINE_STYLE: 'linestyle',     // ADR-570 — named line style (ByStyle), 8 built-ins + user customs
  TABLE_STYLE: 'tblstyle',     // ADR-739 — named table style (AutoCAD TABLESTYLE), presets + user customs
  CENTER_MARK: 'cmark',        // standalone center mark (D13)
  CENTER_LINE: 'cline',        // standalone centerline (D13)

  // DXF BIM Drawing Mode (ADR-363)
  WALL: 'wall',                // floorplan_walls collection — parametric wall entity (3 kinds)
  OPENING: 'opening',          // floorplan_openings collection — door/window/etc (5 kinds)
  SLAB: 'slab',                // floorplan_slabs collection — floor/ceiling/roof/ground/foundation (5 kinds)
  SLAB_OPENING: 'slbopn',      // floorplan_slab_openings collection — elevator shaft, stair well, duct, chimney
  BIM_STACK_GROUP: 'bmstkg',   // multiStoreyStackGroupId — shared by stacked slab-opening copies (ADR-363 Phase 3.7b+)
  COLUMN: 'col',               // floorplan_columns collection — rectangular/circular/L-shape/T-shape (4 kinds)
  BEAM: 'beam',                // floorplan_beams collection — straight/curved/cantilever (3 kinds)
  FOUNDATION: 'fnd',           // floorplan_foundations collection — pad/strip/tie-beam footings (3 kinds) (ADR-436)
  GRID_GUIDE: 'grd',           // floorplan_grid_guides collection — per-floor construction grid doc (ADR-441/189)
  TOPO_SURFACE: 'topo',        // floorplan_topo_surfaces collection — per-floor topographic surface DEFINITION doc (ADR-650)
  MEP_FIXTURE: 'mepfix',       // floorplan_mep_fixtures collection — point-based MEP fixture (ADR-406, light fixture first)
  MEP_SYSTEM: 'mepsys',        // floorplan_mep_systems collection — logical MEP network (ADR-408, electrical circuit first)
  ELECTRICAL_PANEL: 'elecpnl', // floorplan_electrical_panels collection — point-based electrical panel / circuit source (ADR-408 Φ3)
  MEP_SEGMENT: 'mepseg',       // floorplan_mep_segments collection — linear duct/pipe distribution run (ADR-408 Φ8)
  MEP_FITTING: 'mepfit',       // floorplan_mep_fittings collection — auto pipe fitting (junction element) (ADR-408 Φ11)
  MEP_MANIFOLD: 'mfld',        // floorplan_mep_manifolds collection — point-based plumbing manifold / water distribution source (ADR-408 Φ12)
  MEP_RADIATOR: 'rad',         // floorplan_mep_radiators collection — point-based hydronic radiator / heating terminal (ADR-408 Εύρος Β)
  MEP_BOILER: 'blr',           // floorplan_mep_boilers collection — point-based hydronic boiler / heating source (ADR-408 Εύρος Β #2)
  MEP_WATER_HEATER: 'wht',     // floorplan_mep_water_heaters collection — point-based domestic hot water heater / DHW source (ADR-408 DHW)
  MEP_UNDERFLOOR: 'uhf',       // floorplan_mep_underfloors collection — area-based radiant floor heating loop (ADR-408 Εύρος Β #3)
  RAILING: 'ral',              // floorplan_railings collection — standalone path-based railing (ADR-407)
  ROOF: 'roof',                // floorplan_roofs collection — parametric pitched roof (footprint + per-edge slopes) (ADR-417)
  FLOOR_FINISH: 'ffl',         // floorplan_floor_finishes collection — thin floor covering per room (ADR-419)
  WALL_COVERING: 'wcv',        // floorplan_wall_coverings collection — wall finish per room/face (IfcCovering CLADDING/INTERIOR) (ADR-511)
  HATCH: 'hatch',              // floorplan_hatches collection — flat DXF hatch fill / Revit Filled-Region (ADR-507)
  THERMAL_SPACE: 'tsp',        // floorplan_thermal_spaces collection — analytical thermal space / θερμικός χώρος (IfcSpace) (ADR-422)
  SPACE_SEPARATOR: 'ssp',      // floorplan_space_separators collection — space separator / γραμμή διαχωρισμού χώρου (IfcVirtualElement) (ADR-437)
  FURNITURE: 'furn',           // floorplan_furniture collection — mesh-based CC0 furniture (ADR-410, chair first)
  IMPORTED_MESH: 'imesh',      // imported_meshes collection — εισαγόμενο ψημένο πλέγμα συνεργάτη (ADR-683 Φ3)
  GENERIC_SOLID: 'gsol',       // floorplan_generic_solids collection — παραμετρικό γεωμετρικό στερεό (ADR-684)
  FLOORPLAN_SYMBOL: 'fpsym',   // floorplan_symbols collection — pure-vector 2D floorplan symbol (ADR-415, WC/sanitary first)
  BIM_PRESET: 'bpst',          // bim_presets collection — element type presets (system/company/project/user scope)
  BIM_MATERIAL: 'bmat',        // bim_materials collection — material library (Phase 6+)
  BLOCK_LIBRARY_ITEM: 'blklib', // block_library collection — 2D DXF block content library (ADR-652 M2)
  BIM_SETTINGS: 'bset',        // bim_settings collection — per-company BIM configuration
  BIM_FAMILY_TYPE: 'bimftype', // bim_family_types collection — shared parametric family type definitions (ADR-driven)

  // Opening Component Library — Frame Presets (ADR-676)
  OPENING_FRAME_PRESET: 'frmpst', // opening_frame_presets collection — frame/casing preset (system/company/project/user scope) (ADR-676)

  // DXF 3D BIM Viewer — Performance Diagnostics (ADR-366 §B.5)
  PERF_DIAG: 'perfdiag',       // performance_diagnostics collection — user-submitted HUD snapshots

  // DXF 3D BIM Viewer — Render Outputs (ADR-366 §B.4 / Phase 6)
  BIM_RENDER: 'bimrnd',        // bim_renders collection — final photoreal render exports (PNG/JPG/EXR)

  // DXF 3D BIM Viewer — User Preferences (ADR-366 Phase 4.3)
  BIM_3D_PREF: 'b3dpref',      // bim_3d_preferences collection — per-user 3D viewport UI preferences

  // DXF 3D BIM Viewer — Manual 3D Dimensions (ADR-366 Phase 9 / C.3)
  BIM_DIMENSION_3D: 'dim3d',   // bim_dimensions_3d collection — manual 3D dimensions (4 modes: aligned/linear/radial/angular)

  // ISO 19650 Cost Log (ADR-373 P2.5)
  ISO19650_COST_LOG: 'iso19650_cost',   // iso19650_cost_log — per-file AI enrichment cost records

  // DXF 3D BIM Viewer — Comments / Markup (ADR-366 Phase 9 / C.2)
  BIM_COMMENT: 'cmt_bim',      // bim_comments collection — typed comment markers (Issue/Question/Suggestion/Approval/Info)
  BIM_COMMENT_REPLY: 'cmtr_bim', // bim_comments/{id}/replies — flat 1-level reply thread

  // DXF 3D BIM Viewer — Anonymous Telemetry (ADR-366 §C.7.Q3)
  PERFORMANCE_TELEMETRY: 'telm_bim', // bim_performance_telemetry — GDPR-anonymized samples (top-level, no companyId, 30-day TTL)

  // DXF 3D BIM Viewer — Animations (ADR-366 Phase 9 / C.1.a)
  BIM_ANIMATION: 'anm_bim',       // bim_animations collection — turntable + waypoint camera animations
  BIM_RENDER_JOB: 'rnj_bim',      // bim_animations/{id}/render_jobs — render job FIFO queue (resumable, 30-day TTL post-complete)

  // DXF 3D BIM Viewer — Custom HDRI Environments (ADR-366 Group B)
  BIM_ENVIRONMENT: 'env_bim',     // bim_environments storage path — user-uploaded HDRI environment maps
} as const;
