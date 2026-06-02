/**
 * ENTERPRISE ID PREFIXES — CONFIG DATA
 * Cryptographically secure, collision-resistant ID generation prefixes.
 * Extracted from enterprise-id.service.ts (ADR-065 SRP split).
 */

// Enterprise prefix mappings for namespace isolation
export const ENTERPRISE_ID_PREFIXES = {
  // Core Business Entities
  COMPANY: 'comp',
  PROJECT: 'proj',
  BUILDING: 'bldg',
  PROPERTY: 'prop',
  STORAGE: 'stor',
  PARKING: 'park',
  CONTACT: 'cont',
  WORKSPACE: 'ws',
  ADDRESS: 'addr',
  OPPORTUNITY: 'opp',
  FLOOR: 'flr',
  DOCUMENT: 'doc',
  USER: 'usr',
  USER_PREFERENCES: 'usrprf',  // ADR-XXX: per-user UI settings (deterministic {userId}_{companyId})
  ASSET: 'ast',
  RELATIONSHIP: 'rel',
  MEMBER: 'mbr',
  LANDOWNER: 'lown',         // ADR-244: Property ownership
  OWNERSHIP_TABLE: 'owntbl',  // ADR-235: Ownership percentage tables (deterministic composite key)

  // Legal Documents & Obligations
  SECTION: 'sec',
  ARTICLE: 'art',
  PARAGRAPH: 'par',
  OBLIGATION: 'obl',
  TRANSMITTAL: 'xmit',

  // Runtime & Ephemeral
  SESSION: 'sess',
  TRANSACTION: 'txn',
  NOTIFICATION: 'notif',
  TASK: 'task',
  EVENT: 'evt',
  REQUEST: 'req',
  MESSAGE: 'msg',
  JOB: 'job',

  // DXF / CAD Viewer
  OVERLAY: 'ovrl',
  LEVEL: 'lvl',
  /** ADR-375 Phase B.3 — BIM View Template (reusable preset of drawingScale + viewRange + objectStyles). */
  VIEW_TEMPLATE: 'vtmpl',

  // Floorplan Background System (ADR-340)
  RASTER_BACKGROUND: 'rbg',

  // UI & Visualization
  LAYER: 'lyr',
  ELEMENT: 'elem',
  HISTORY: 'hist',
  ANNOTATION: 'annot',
  CONTROL_POINT: 'cp',
  ENTITY: 'ent',
  CUSTOMIZATION: 'cust',

  // Observability & Monitoring
  ERROR: 'err',
  METRIC: 'metric',
  ALERT: 'alert',
  TRACE: 'trace',
  SPAN: 'span',
  SEARCH: 'search',
  AUDIT: 'audit',

  // DevOps & Operations
  CONTAINER: 'ctr',
  DEPLOYMENT: 'deploy',
  PIPELINE: 'pipe',
  BACKUP: 'backup',
  RESTORE: 'rst',
  MIGRATION: 'migr',
  TEMPLATE: 'tpl',
  OPERATION: 'op',

  // BOQ / Quantity Surveying (ADR-175)
  BOQ_ITEM: 'boq',
  BOQ_CATEGORY: 'boqcat',
  BOQ_PRICE_LIST: 'boqpl',
  BOQ_TEMPLATE: 'boqtpl',

  // Accounting (Subapp — ADR-ACC-001 through ADR-ACC-010)
  JOURNAL_ENTRY: 'je',
  INVOICE_ACC: 'inv',
  BANK_TRANSACTION: 'btxn',
  FIXED_ASSET: 'fxa',
  DEPRECIATION: 'depr',
  EFKA_PAYMENT: 'efka',
  IMPORT_BATCH: 'batch',
  MATCH_GROUP: 'mgrp',
  MATCHING_RULE: 'mrule',
  EXPENSE_DOC: 'exdoc',
  APY_CERTIFICATE: 'apy',
  SERVICE_PRESET: 'sp',
  CUSTOM_CATEGORY: 'custcat',
  CUSTOMER_BALANCE: 'cbal',
  FISCAL_PERIOD: 'fp',
  ACCOUNTING_AUDIT_LOG: 'alog',

  // File & Media Operations
  PHOTO: 'photo',
  ATTACHMENT: 'att',
  FILE: 'file',
  SHARE: 'share',
  DISPATCH: 'dispatch',
  PENDING: 'pending',
  SUBSCRIPTION: 'sub',
  FOLDER: 'fldr',
  COMMENT: 'cmt',
  APPROVAL: 'appr',

  // Construction & Building (ADR-034: Gantt Chart)
  CONSTRUCTION_PHASE: 'cphase',
  CONSTRUCTION_TASK: 'ctask',
  CONSTRUCTION_BASELINE: 'cbase',
  CONSTRUCTION_RESOURCE_ASSIGNMENT: 'crasn',
  CONSTRUCTION_ALERT: 'calert',
  MILESTONE: 'mile',

  // Attendance (ADR-170: QR + GPS Geofencing)
  ATTENDANCE_QR_TOKEN: 'qrtok',
  ATTENDANCE_EVENT: 'attev',

  // Address Corrections Telemetry (ADR-332 §3.7 Phase 9)
  ADDRESS_CORRECTION_LOG: 'acl',

  // HR & Employment
  EMPLOYMENT_RECORD: 'emprec',
  APPOINTMENT: 'appt',

  // Org Structure (ADR-326)
  ORG_STRUCTURE: 'org',
  ORG_DEPARTMENT: 'odep',
  ORG_MEMBER: 'omem',

  // Integrations
  WEBHOOK: 'whk',

  // AI Learning
  LEARNED_PATTERN: 'lp',
  QUERY_STRATEGY: 'qstr',
  AI_CHAT_HISTORY: 'ach',

  // Omnichannel Conversations (ADR-031)
  CONVERSATION: 'conv',
  MESSAGE_DOC: 'msg',
  EXTERNAL_IDENTITY: 'eid',

  // Banking
  BANK_ACCOUNT: 'bacc',

  // Navigation & Routing
  NAVIGATION: 'nav',
  ROUTE_CONFIG: 'rcfg',

  // Voice Commands (ADR-164)
  VOICE_COMMAND: 'vcmd',

  // AI Pipeline & Audit
  FEEDBACK: 'fb',
  PIPELINE_AUDIT: 'paud',
  ENTITY_AUDIT: 'eaud',
  AI_USAGE: 'aiu',            // ADR-259A
  CONTRACT: 'lc',
  PIPELINE_QUEUE: 'pq',
  BROKERAGE: 'brk',
  COMMISSION: 'com',
  PAYMENT_PLAN: 'pp',
  PLAN_GROUP: 'ppg',
  PAYMENT_RECORD: 'pay',
  LOAN: 'loan',
  CHEQUE: 'chq',

  // Financial Intelligence (SPEC-242C)
  DEBT_MATURITY: 'dmt',
  BUDGET_VARIANCE: 'bvar',

  // Procurement (ADR-267)
  PURCHASE_ORDER: 'po',
  PO_ITEM: 'poi',
  PO_ATTACHMENT: 'poatt',

  // Quotes & RFQ (ADR-327)
  QUOTE: 'qt',
  RFQ: 'rfq',
  VENDOR_INVITE: 'vi',
  TRADE: 'trd',
  VENDOR_LOGO: 'vlogo',       // ADR-327 §6: deterministic per-quote logo claim

  // Quotes & RFQ — Multi-Vendor extension (ADR-327 §17 Q28-Q31, 2026-04-29)
  SOURCING_EVENT: 'srcev',    // §17 Q31: parent collection multi-trade RFQ package (HYBRID A-Enhanced)
  RFQ_LINE: 'rfqln',          // §17 Q29: sub-collection rfqs/{rfqId}/lines/{lineId} (HYBRID Γ BOQ-first)

  // Material Catalog (ADR-330 Phase 4)
  MATERIAL: 'mat',            // company-wide material master with ATOE FK + preferred suppliers

  // Framework Agreements (ADR-330 Phase 5)
  FRAMEWORK_AGREEMENT: 'fwa', // multi-project vendor contract with volume discount rules

  // Reports (ADR-268 Phase 7)
  SAVED_REPORT: 'srpt',

  // Cash Flow (ADR-268 Phase 8)
  RECURRING_PAYMENT: 'rpay',

  // DXF Text Engine (ADR-344)
  TEXT_TEMPLATE: 'tpl_text',   // text_templates collection — hybrid title block / stamp templates
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
  MEP_FIXTURE: 'mepfix',       // floorplan_mep_fixtures collection — point-based MEP fixture (ADR-406, light fixture first)
  BIM_PRESET: 'bpst',          // bim_presets collection — element type presets (system/company/project/user scope)
  BIM_MATERIAL: 'bmat',        // bim_materials collection — material library (Phase 6+)
  BIM_SETTINGS: 'bset',        // bim_settings collection — per-company BIM configuration

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

  // Optimistic & Temporary
  OPTIMISTIC: 'opt',
  TEMP: 'tmp',
} as const;

export type EnterpriseIdPrefix = typeof ENTERPRISE_ID_PREFIXES[keyof typeof ENTERPRISE_ID_PREFIXES];

/** Enterprise ID interface for type safety */
export interface EnterpriseId {
  readonly id: string;
  readonly prefix: EnterpriseIdPrefix;
  readonly uuid: string;
  readonly timestamp: number;
}

/** ID generation configuration */
export interface IdGenerationConfig {
  maxRetries: number;
  enableLogging: boolean;
  enableCache: boolean;
  cacheSize: number;
}
