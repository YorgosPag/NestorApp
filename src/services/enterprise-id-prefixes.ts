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
  PUBLIC_LAND: 'land',       // ADR-777 Α1: η ΓΗ — το ΜΟΝΟ πράγμα που κρατά θέση. Δημόσια, χωρίς
                             // companyId. 🔴 ΠΟΤΕ OSM id (SPEC-777A §13.2): τα OSM id αλλάζουν όταν
                             // εθελοντές ξανασχεδιάζουν, και μια ζήτηση κρεμασμένη εκεί εξαφανίζεται
                             // ΣΙΩΠΗΛΑ. Δική μας ταυτότητα που ΔΕΙΧΝΕΙ στο OSM, ποτέ που ΕΙΝΑΙ.
  PUBLIC_BUILDING: 'pbld',   // ADR-777 Α11: «το κτίριο του κόσμου» — δημόσια οντότητα, κανενός.
                             // ⚠️ ΞΕΧΩΡΙΣΤΟ από το `bldg` (BUILDING): εκείνο είναι το εμπορικό
                             // κτίριο ΜΕΣΑ σε έργο ενός πελάτη (επίπεδο Β). Κοινό πρόθεμα θα
                             // σήμαινε ότι δύο πράγματα με διαφορετική ορατότητα και διαφορετικό
                             // γραφέα μοιράζονται χώρο ταυτοτήτων — η σύγχυση θα ήταν ΜΗ ΑΝΙΧΝΕΥΣΙΜΗ.
  PROPERTY_DEMAND: 'dmnd',   // ADR-777 Α9: Η ΖΗΤΗΣΗ — «ανοιχτή εντολή» σε αγορά, ισότιμη με την
                             // προσφορά. ΕΓΓΡΑΦΟ (επίπεδο Β, ιδιωτικό ανά ΧΡΗΣΤΗ), σε αντίθεση με
                             // το `offr` που είναι στοιχείο πίνακα μέσα στο Property.
                             // ⚠️ ΞΕΧΩΡΙΣΤΟ από το `opp` (OPPORTUNITY) και το `leads`: εκείνα είναι
                             // CRM — «πιθανός ΠΕΛΑΤΗΣ ενός πωλητή», tenant-scoped σε εταιρεία, με
                             // στάδια χοάνης. Αυτό είναι δήλωση ΑΝΘΡΩΠΟΥ για ΑΚΙΝΗΤΟ, ανήκει στον
                             // ίδιο, και ζει ακόμη κι όταν καμία εταιρεία δεν την κυνηγά.
  OWNER_PROPERTY: 'ownp',    // ADR-777 Α14: Η ΠΡΟΣΦΟΡΑ ΤΟΥ ΙΔΙΩΤΗ — το ακίνητο όπως το δηλώνει ο
                             // ίδιος ο κάτοχός του. ΕΓΓΡΑΦΟ (επίπεδο Β, ιδιωτικό ανά ΧΡΗΣΤΗ), το
                             // κάτοπτρο του `dmnd`: εκείνο είναι «ζητώ», αυτό «προσφέρω».
                             // ⚠️ ΞΕΧΩΡΙΣΤΟ από το `prop` (PROPERTY): εκείνο είναι μονάδα ΜΕΣΑ σε
                             // κτίριο μέσα σε έργο ΕΤΑΙΡΕΙΑΣ, με υποχρεωτική αλυσίδα ADR-284 §3.1.
                             // Ίδιο πρόθεμα θα σήμαινε ότι δύο πράγματα με διαφορετικό γραφέα,
                             // διαφορετικό πεδίο απομόνωσης και διαφορετικούς κανόνες μοιράζονται
                             // χώρο ταυτοτήτων — η σύγχυση θα ήταν ΜΗ ΑΝΙΧΝΕΥΣΙΜΗ.
                             // ⚠️ ΚΑΙ ΞΕΧΩΡΙΣΤΟ από το `offr` (PROPERTY_OFFER): εκείνο είναι η
                             // ΔΙΑΘΕΣΗ (στοιχείο πίνακα ΜΕΣΑ σε αυτό εδώ), όχι το ακίνητο.
  MANDATE_REQUEST: 'mreq',   // ADR-827 §8.7: ΤΟ ΑΙΤΗΜΑ ΑΝΑΘΕΣΗΣ — «ανάλαβε την αγγελία μου».
                             // ⚠️ ΞΕΧΩΡΙΣΤΟ από την ΕΝΤΟΛΗ (`BrokeredListingMandate`), που ΔΕΝ έχει
                             // δικό της πρόθεμα επίτηδες: η εντολή είναι ΠΕΔΙΟ μέσα στο `ownp_*`,
                             // όχι έγγραφο — «αλλάζει χέρια, όχι ταυτότητα» (ADR-827 Α3). Το αίτημα
                             // αντίθετα είναι έγγραφο, γιατί επιβιώνει της απόρριψης: ένα `declined`
                             // κρατά αγγελία+όρους+χρόνο+γραφείο ώστε το γραφείο να μη δει δεύτερη
                             // φορά ό,τι έκρινε (§8.5) — και ΜΗΔΕΝ προσωπικά, γιατί δεν έλαβε ποτέ.
                             // ⚠️ ΚΑΙ ΞΕΧΩΡΙΣΤΟ από το `brk` (BROKERAGE): εκείνο είναι η σύμβαση του
                             // ADR-230 σε έργο ΕΤΑΙΡΕΙΑΣ, με μεσίτη ως `cont_*`. Αυτό γεννιέται από
                             // ΙΔΙΩΤΗ που δεν είναι επαφή κανενός — και γίνεται επαφή ΜΟΝΟ αν το
                             // γραφείο δεχτεί (§8.4).
  STAY_BOOKING: 'stay',       // ADR-835 §6.1: Η ΚΡΑΤΗΣΗ ΒΡΑΧΥΧΡΟΝΙΑΣ ΔΙΑΜΟΝΗΣ — «αυτές οι
                              // νύχτες, σε αυτούς τους χώρους, για αυτόν τον άνθρωπο».
                              // ΕΓΓΡΑΦΟ, και ο λόγος είναι ο ίδιος με το `mreq`: έχει ΔΥΟ
                              // μέρη (επισκέπτης + οικοδεσπότης) και επιβιώνει της άρνησης —
                              // ένα `cancelled` κρατά ποιος ζήτησε τι και πότε, ώστε η
                              // ακύρωση να έχει ιστορία αντί να είναι εξαφάνιση.
                              // ⚠️ ΞΕΧΩΡΙΣΤΟ από το `offr` (PROPERTY_OFFER): εκείνο είναι η
                              // ΔΙΑΘΕΣΗ («νοικιάζω αυτό το κατάλυμα, 65 €/βράδυ») — στοιχείο
                              // πίνακα μέσα στο ακίνητο, μία ανά κατάλυμα. Αυτό είναι μια
                              // ΚΑΤΑΛΗΨΗ πάνω της — πολλές ανά διάθεση, καθεμιά με δικό της
                              // διάστημα. Κοινό πρόθεμα θα σήμαινε ότι «τι προσφέρεται» και
                              // «τι είναι πιασμένο» μοιράζονται χώρο ταυτοτήτων, και η
                              // σύγχυση θα φαινόταν ως ΔΙΠΛΟΚΡΑΤΗΣΗ.
                              // ⚠️ ΚΑΙ ΞΕΧΩΡΙΣΤΟ από το `appointment` (ραντεβού επίσκεψης):
                              // εκείνο είναι ώρα ενός ΜΕΣΙΤΗ, αυτό είναι νύχτες ενός ΧΩΡΟΥ.
  OWNERSHIP_TABLE: 'owntbl',  // ADR-235: Ownership percentage tables (deterministic composite key)
  TITLE_BLOCK_BINDING: 'tbb', // ADR-745 Φ3β: title-block cell → entity provenance (composite key)
  PROPERTY_OFFER: 'offr',     // ADR-777 Α20: ΔΙΑΘΕΣΗ — «ένα ακίνητο, πολλές διαθέσεις». Στοιχείο
                              // πίνακα μέσα στο Property, ΟΧΙ έγγραφο — και παίρνει ταυτότητα για
                              // τον ίδιο λόγο με τις γραμμές του ADR-759 Φ2β: μια διάθεση επιβιώνει
                              // αναδιάταξης, κλεισίματος και επαναδημοσίευσης. Χωρίς σταθερή
                              // ταυτότητα, «απόσυρε τις άλλες» (Α20 σημείο 4) δεν έχει υποκείμενο.
  SURVEY_RECORD: 'srv',       // ADR-759 Φ2: survey_records collection — institutional/legal plot data
                              // declared by a surveyor on a date. NOT `topo` (ADR-650) — that is TIN
                              // surface GEOMETRY per floor. Two meanings, two prefixes (ADR-759 §Ζ.2).

  // ADR-759 Φ2β — REPEATING ROWS INSIDE a survey record. Not documents; array
  // elements. They still get enterprise ids, and the reason is a rule, not a habit:
  //
  //   IFC gives a `GlobalId` only to ROOTED entities (subtypes of `IfcRoot`). A
  //   non-rooted value object — `IfcDocumentReference`, for instance — gets none,
  //   because it exists only through whoever references it. Revit draws the same
  //   line: every *element* carries a `UniqueId` assigned at creation that never
  //   changes; the *parameters* inside it do not, they are identified by definition.
  //
  // An act, an approval and a title deed are the rooted kind: the engineer points at
  // them one by one, and a deed links out to a notary contact. So each gets its own
  // prefix — one per row TYPE, mirroring `PO_ITEM` ('poi'), the project's existing
  // embedded-row precedent (`types/procurement/purchase-order.ts:193`).
  //
  // 🔴 The ΦΕΚ references (`GazetteRef`) and the remark strings deliberately get
  // NOTHING. They are value objects; their identity is their position. Minting ids
  // for them would claim an independence they do not have.
  SURVEY_ACT: 'svact',        // InstitutionalAct row — decree / ΓΠΣ / zoning act
  SURVEY_APPROVAL: 'svapr',   // SurveyApproval row — section Θ (ΕΓΚΡΙΣΕΙΣ)
  SURVEY_TITLE_DEED: 'svdeed', // SurveyTitleDeed row — section Ι (ΤΙΤΛΟΙ ΙΔΙΟΚΤΗΣΙΑΣ)

  // Legal Documents & Obligations
  SECTION: 'sec',
  ARTICLE: 'art',
  PARAGRAPH: 'par',
  OBLIGATION: 'obl',
  TRANSMITTAL: 'xmit',

  // OAuth 2.1 Authorization Server (ADR-738) — έγγραφα ΜΟΝΟ Admin SDK, deny-all στα rules
  /** Στιγμιότυπο CIMD ενός MCP client (client_id = HTTPS URL, βλ. ADR-738 §4). */
  OAUTH_CLIENT: 'oacli',
  /**
   * Εκκρεμές αίτημα εξουσιοδότησης — ζει όσο ο **άνθρωπος** σκέφτεται.
   * Ξεχωριστό από το `OAUTH_CODE` επίτηδες: άλλος κύκλος ζωής (λεπτά έναντι
   * δευτερολέπτων) και άλλος καταναλωτής (browser έναντι μηχανής).
   */
  OAUTH_AUTH_REQUEST: 'oareq',
  /** Authorization code — εφήμερο (60s), μιας χρήσης. */
  OAUTH_CODE: 'oacode',
  /** Access ή refresh token — αποθηκεύεται **μόνο** ως SHA-256, ποτέ ωμό. */
  OAUTH_TOKEN: 'oatok',
  /** Συγκατάθεση χρήστη προς client — ό,τι ο Γιώργος βλέπει και ανακαλεί. */
  OAUTH_CONSENT: 'oacons',

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
  FURNITURE: 'furn',
  IMPORTED_MESH: 'imesh',      // imported_meshes collection — εισαγόμενο ψημένο πλέγμα συνεργάτη (ADR-683 Φ3)           // floorplan_furniture collection — mesh-based CC0 furniture (ADR-410, chair first)
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
