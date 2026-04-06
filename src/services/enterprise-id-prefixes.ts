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
  ASSET: 'ast',
  RELATIONSHIP: 'rel',
  MEMBER: 'mbr',
  LANDOWNER: 'lown',         // ADR-244: Property ownership

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
  CUSTOM_CATEGORY: 'custcat',
  CUSTOMER_BALANCE: 'cbal',
  FISCAL_PERIOD: 'fp',
  ACCOUNTING_AUDIT_LOG: 'alog',

  // File & Media Operations
  PHOTO: 'photo',
  ATTACHMENT: 'att',
  FILE: 'file',
  SHARE: 'share',
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
  MILESTONE: 'mile',

  // Attendance (ADR-170: QR + GPS Geofencing)
  ATTENDANCE_QR_TOKEN: 'qrtok',
  ATTENDANCE_EVENT: 'attev',

  // HR & Employment
  EMPLOYMENT_RECORD: 'emprec',
  APPOINTMENT: 'appt',

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

  // Reports (ADR-268 Phase 7)
  SAVED_REPORT: 'srpt',

  // Cash Flow (ADR-268 Phase 8)
  RECURRING_PAYMENT: 'rpay',

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
