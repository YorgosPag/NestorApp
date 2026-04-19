/**
 * Golden fixtures for registry-golden-regex.test.js.
 *
 * For each sampled module in .ssot-registry.json:
 *   - shouldMatch: realistic code blob containing TRUE POSITIVES for every
 *     forbiddenPattern of that module. The ratchet regex must fire on at
 *     least one line per pattern.
 *   - shouldSkip: realistic code blob containing KNOWN FALSE-POSITIVE
 *     traps (imports of the SSoT, SSoT API usage, type-union literals,
 *     JSDoc-style comments, etc.). The ratchet regex must NOT fire.
 *
 * Sampling covers one representative per architectural tier:
 *   Core: firestore-collections, enterprise-id, domain-constants,
 *         addDoc-prohibition, intent-badge-utils
 *   Tier 1: tenant-company-id, soft-delete-config
 *   Tier 3: intl-formatting, date-local, notification-events
 *   Tier 5: storage-path-construction, entity-creation-manual
 *
 * Pattern SSoT: the regexes live ONLY in .ssot-registry.json. Tests load
 * them from there — never hardcode a pattern in this file.
 */

'use strict';

module.exports = {
  'firestore-collections': {
    shouldMatch: `// Scanner must catch raw literal collection / doc IDs:
db.collection('users');
docRef.doc('abc_xyz');
const ref = db.collection("projects");`,
    shouldSkip: `// Scanner must pass SSoT-routed access:
import { COLLECTIONS } from '@/config/firestore-collections';
db.collection(COLLECTIONS.USERS);
const ref = db.collection(\`\${dynamicName}\`);
docRef.doc(entityId);`,
  },

  'enterprise-id': {
    shouldMatch: `// Scanner must catch direct crypto.randomUUID usage:
const id = crypto.randomUUID();
export function makeRef() { return crypto.randomUUID(); }`,
    shouldSkip: `// Scanner must pass SSoT-routed ID generation:
import { enterpriseIdService } from '@/services/enterprise-id.service';
const id = enterpriseIdService.generateContactId();`,
  },

  'domain-constants': {
    shouldMatch: `// Scanner must catch hardcoded domain literals:
const m = { senderType: 'customer', body: 'hi' };
let entityType = 'lead';
event.entityType = 'property';`,
    shouldSkip: `// Scanner must pass SSoT-routed enums:
import { SENDER_TYPES, ENTITY_TYPES } from '@/config/domain-constants';
const m = { senderType: SENDER_TYPES.CUSTOMER };
let entityType = ENTITY_TYPES.LEAD;`,
  },

  'addDoc-prohibition': {
    shouldMatch: `// Scanner must catch all 3 enterprise-ID-bypass vectors:
import { addDoc, collection } from 'firebase/firestore';
await addDoc(colRef, data);
await ref.add({ name: 'x' });
const ref2 = db.collection(COLLECTIONS.USERS).doc();`,
    shouldSkip: `// Scanner must pass setDoc + enterprise-ID pattern:
import { setDoc, doc } from 'firebase/firestore';
import { enterpriseIdService } from '@/services/enterprise-id.service';
const id = enterpriseIdService.generateContactId();
await setDoc(doc(db, 'users', id), { name: 'x' });`,
  },

  'intent-badge-utils': {
    shouldMatch: `// Scanner must catch redeclarations of canonical badge helpers:
const getIntentBadge = (x) => ({ label: x });
export function getConfidenceBadge(c) { return c; }
const getConfidenceColor: (v: number) => string = (v) => v > 0.8 ? 'green' : 'red';`,
    shouldSkip: `// Scanner must pass SSoT imports + usage:
import { getIntentBadge, getConfidenceBadge } from '@/components/admin/shared/intent-badge-utils';
const b = getIntentBadge(intent);
const c = getConfidenceBadge(confidence);`,
  },

  'tenant-company-id': {
    shouldMatch: `// Scanner must catch hardcoded legacy tenant literals:
const companyId = 'comp_9c7c1a50';
const legacyCompanyId = "pzNUy8ksddGCtcQMqumR";`,
    shouldSkip: `// Scanner must pass SSoT resolver usage:
import { getCompanyId } from '@/config/tenant';
const companyId = getCompanyId();
const docId = docRef.id;`,
  },

  'soft-delete-config': {
    shouldMatch: `// Scanner must catch redeclarations of the canonical config shape:
export const SOFT_DELETE_CONFIG = { ttlDays: 30 };
type Entity: SoftDeleteEntityConfig = Record<string, number>;`,
    shouldSkip: `// Scanner must pass SSoT import + usage:
import { SOFT_DELETE_CONFIG } from '@/lib/firestore/soft-delete-config';
function check(entity: string) { return SOFT_DELETE_CONFIG[entity]; }`,
  },

  'intl-formatting': {
    shouldMatch: `// Scanner must catch redeclarations of canonical intl helpers:
export const formatDate = (d: Date) => d.toISOString();
export function formatCurrency(n: number) { return '€' + n; }
const formatNumber = (n: number) => n.toString();`,
    shouldSkip: `// Scanner must pass SSoT imports:
import { formatDate, formatCurrency, formatNumber } from '@/lib/intl-formatting';
const d = formatDate(date);
const p = formatCurrency(price);`,
  },

  'date-local': {
    shouldMatch: `// Scanner must catch all 3 date-local anti-patterns:
export const normalizeToDate = (x: unknown) => x as Date;
const timestamp = new Date().toISOString();
const firestoreTs = Timestamp.fromDate(new Date());`,
    shouldSkip: `// Scanner must pass SSoT imports + usage:
import { nowISO, nowTimestamp, normalizeToDate } from '@/lib/date-local';
const ts = nowISO();
const firestoreTime = nowTimestamp();
const d = normalizeToDate(raw);`,
  },

  'notification-events': {
    shouldMatch: `// Scanner must catch redeclarations of notification event SSoT:
export const NOTIFICATION_EVENT_TYPES = { CREATED: 'created' };
const NOTIFICATION_CHANNELS: Record<string, string> = { EMAIL: 'email' };
const NOTIFICATION_SEVERITIES = { INFO: 'info', WARN: 'warn' };`,
    shouldSkip: `// Scanner must pass SSoT imports + enum-style access:
import { NOTIFICATION_EVENT_TYPES } from '@/config/notification-events';
if (e.type === NOTIFICATION_EVENT_TYPES.CREATED) {
  console.log('created');
}`,
  },

  'storage-path-construction': {
    shouldMatch: `// Scanner must catch hardcoded Storage path literals:
const avatarPath = \`companies/\${companyId}/avatars/\${userId}.jpg\`;
const filePath = \`companies/\${tenantId}/files/\${fileId}\`;`,
    shouldSkip: `// Scanner must pass SSoT path builder:
import { buildStoragePath } from '@/services/upload/utils/storage-path';
const avatarPath = buildStoragePath(companyId, 'avatars', \`\${userId}.jpg\`);`,
  },

  'entity-creation-manual': {
    shouldMatch: `// Scanner must catch manual createdBy assembly:
const entity = { createdBy: user.uid, name: 'x' };
const record = { createdBy: authContext.uid, ts: nowISO() };
const doc = { createdBy: userId };`,
    shouldSkip: `// Scanner must pass SSoT factory usage:
import { createEntity } from '@/lib/firestore/entity-creation.service';
const entity = await createEntity({ name: 'x' });`,
  },
};
