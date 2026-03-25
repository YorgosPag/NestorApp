/**
 * SHARED MOCK SETUP — Imported by every AI pipeline test file.
 *
 * Jest hoists jest.mock() calls to the top of the file, so these
 * run before any handler import (crucial for `server-only` mock).
 *
 * USAGE: Add `import '../setup';` at the top of each test file.
 *        Then add your own jest.mock() calls as needed.
 *
 * @module __tests__/setup
 */

/* eslint-disable @typescript-eslint/no-require-imports */

// ── Server-only: resolved via moduleNameMapper in jest.config.js ──

// ── Firebase Admin ──
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: jest.fn(),
}));

// ── Telemetry (no-op loggers) ──
jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('@/lib/telemetry/sentry', () => ({
  captureMessage: jest.fn(),
}));

// ── Enterprise ID ──
jest.mock('@/services/enterprise-id.service', () => ({
  generateEntityId: jest.fn(() => 'ent_test_001'),
  generatePipelineAuditId: jest.fn(() => 'audit_test_001'),
  generateBankAccountId: jest.fn(() => 'bacc_test_001'),
  generateRelationshipId: jest.fn(() => 'rel_test_001'),
  generateTaskId: jest.fn(() => 'task_test_001'),
  generateContactId: jest.fn(() => 'cont_test_001'),
  generateCompanyId: jest.fn(() => 'comp_gen_001'),
}));

// ── Validation modules (dynamic-imported by handlers) ──
jest.mock('@/lib/validation/phone-validation', () => ({
  isValidPhone: jest.fn((v: string) => /^69\d{8}$|^2\d{9}$|^\+\d{10,14}$/.test(v)),
  cleanPhoneNumber: jest.fn((v: string) => v.replace(/[\s\-()]/g, '')),
}));

jest.mock('@/lib/validation/email-validation', () => ({
  isValidEmail: jest.fn((v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)),
  isValidUrl: jest.fn((v: string) => v.startsWith('http')),
}));

// ── Contact lookup (shared service) ──
jest.mock('@/services/ai-pipeline/shared/contact-lookup', () => ({
  createContactServerSide: jest.fn(),
  updateContactField: jest.fn(),
  emitEntitySyncSignal: jest.fn(),
}));

// ── Channel reply dispatcher ──
jest.mock('@/services/ai-pipeline/shared/channel-reply-dispatcher', () => ({
  sendChannelReply: jest.fn(() => ({ success: true, messageId: 'msg_test_001' })),
  sendChannelMediaReply: jest.fn(() => ({ success: true })),
}));

// ── Email templates ──
jest.mock('@/services/email-templates', () => ({
  wrapInBrandedTemplate: jest.fn(({ contentHtml }: { contentHtml: string }) => contentHtml),
  escapeHtml: jest.fn((s: string) => s),
}));

// ── Tool analytics (fire-and-forget) ──
jest.mock('@/services/ai-pipeline/tool-analytics-service', () => ({
  getToolAnalyticsService: jest.fn(() => ({
    recordToolExecution: jest.fn(() => Promise.resolve()),
  })),
}));

// ── Query strategy service ──
jest.mock('@/services/ai-pipeline/query-strategy-service', () => ({
  recordQueryStrategy: jest.fn(() => Promise.resolve()),
}));

// ── ESCO search utils ──
jest.mock('@/services/ai-pipeline/tools/esco-search-utils', () => ({
  enforceEscoOccupation: jest.fn(),
  enforceEscoSkill: jest.fn(),
  searchEscoOccupations: jest.fn(() => Promise.resolve([])),
  searchEscoSkills: jest.fn(() => Promise.resolve([])),
}));

// ── Contact tab filter ──
jest.mock('@/services/ai-pipeline/tools/contact-tab-filter', () => ({
  filterContactByTab: jest.fn((data: Record<string, unknown>) => data),
  resolveContactType: jest.fn(() => 'individual'),
}));

// ── Greek NLP ──
jest.mock('@/services/ai-pipeline/shared/greek-nlp', () => ({
  greekToLatin: jest.fn((s: string) => s),
  stripDiacritics: jest.fn((s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')),
  stemGreekWord: jest.fn((s: string) => s),
}));

// ── Super admin resolver ──
jest.mock('@/services/ai-pipeline/shared/super-admin-resolver', () => ({
  getAdminTelegramChatId: jest.fn(() => '5618410820'),
}));

// ── RBAC matrix ──
jest.mock('@/config/ai-role-access-matrix', () => ({
  AI_ROLE_ACCESS_MATRIX: {
    super_admin: {
      label: 'Super Admin',
      allowedCollections: ['contacts', 'projects', 'buildings', 'units'],
      blockedFields: [],
      promptDescription: 'Ο χρήστης είναι ο SUPER ADMIN. Έχεις ΠΛΗΡΗ πρόσβαση σε ΟΛΑ τα δεδομένα.',
    },
  },
  resolveAccessConfig: jest.fn(() => ({
    allowedCollections: ['contacts', 'projects', 'buildings', 'units'],
    scopeLevel: 'project',
    blockedFields: new Set<string>(),
  })),
  UNLINKED_ACCESS: {
    allowedCollections: ['contacts'],
    scopeLevel: 'none',
    blockedFields: new Set<string>(),
    promptDescription: 'Πρόσβαση μόνο στα δικά σου δεδομένα.',
  },
  UNKNOWN_USER_ACCESS: {
    allowedCollections: [],
    scopeLevel: 'none',
    blockedFields: new Set<string>(),
    promptDescription: 'Δεν αναγνωρίστηκες.',
  },
  deriveBlockedFieldSet: jest.fn(() => new Set<string>()),
}));

// ── JSON utils ──
jest.mock('@/lib/json-utils', () => ({
  safeJsonParse: jest.fn(<T>(str: string, fallback: T): T => {
    try { return JSON.parse(str) as T; } catch { return fallback; }
  }),
}));

// ── Error utils ──
jest.mock('@/lib/error-utils', () => ({
  getErrorMessage: jest.fn((e: unknown) =>
    e instanceof Error ? e.message : String(e)
  ),
}));

// ── Realtime types ──
jest.mock('@/services/realtime/types', () => ({}));

// ── Firebase Storage (for messaging attachments) ──
jest.mock('firebase-admin/storage', () => ({
  getStorage: jest.fn(() => ({
    bucket: jest.fn(() => ({
      file: jest.fn(() => ({
        download: jest.fn(() => Promise.resolve([Buffer.from('test')])),
        getMetadata: jest.fn(() => Promise.resolve([{ contentType: 'application/pdf' }])),
      })),
    })),
  })),
}));
