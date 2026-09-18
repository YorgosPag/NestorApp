/**
 * @jest-environment node
 *
 * =============================================================================
 * 📒 ΑΓΚΥΡΑ Α35 — Η ΔΡΑΣΤΗΡΙΟΤΗΤΑ ΤΟΥ ΠΡΟΣΩΠΙΚΟΥ ΑΡΧΕΙΟΥ (ADR-866 §2.6.11 · Φ0 βήμα 2β.4)
 * =============================================================================
 *
 * | #     | ερώτημα | μετάλλαξη που πιάνει |
 * |---|---|---|
 * | Α35.1 | οι πράξεις του κλειστού συνόλου = οι κλάδοι του κανόνα; | πράξη εδώ χωρίς κλάδο εκεί (ή αντίστροφα) |
 * | Α35.2 | τα κλειδιά κάδου/μετονομασίας είναι ΟΛΑ ζευγαρωμένα στον κανόνα; | αφαίρεση του `isDeleted` ⇒ κάδος χωρίς γραμμή |
 * | Α35.3 | προσωπικό ⇒ ΜΙΑ δέσμη: γραμμή στο ΠΡΟΣΩΠΙΚΟ βιβλίο + δείκτης στην ΙΔΙΑ γραμμή | `updateDoc` αντί δέσμης · λάθος βιβλίο · δείκτης σε άλλο id |
 * | Α35.4 | εταιρικό ⇒ ό,τι ίσχυε: ενημέρωση + προβολή με `companyId` | δέσμη και για εταιρεία (ο κανόνας του δεν ζευγαρώνει) |
 * | Α35.5 | ο κάδος είναι ιδεμπότητος | δεύτερος κάδος ⇒ νέα γραμμή + μετάθεση `purgeAt` |
 * | Α35.6 | το βιβλίο: ούτε super admin, αμετάβλητο | `isSuperAdminOnly()` στην ανάγνωση · `update: if true` |
 * | Α35.7 | το κουμπί «Δραστηριότητα» ΔΕΝ κρύβεται πίσω από το `officeActions` (σιωπή #4) | επαναφορά του φρουρού |
 *
 * ⚠️ Το ότι ο κάτοχος **διαβάζει** αυτό που γράφεται το αποδεικνύει ο emulator
 * (`tests/firestore-rules/suites/file-audit-log-personal.rules.test.ts` Δ1) — εδώ μόνο το σχήμα.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

type Op = { readonly kind: string; readonly path?: string; readonly data?: Record<string, unknown> };
const ops: Op[] = [];
let storedFile: Record<string, unknown> | null = null;

jest.mock('@/lib/firebase', () => ({ db: {} }));
jest.mock('@/services/realtime', () => ({ RealtimeService: { dispatch: jest.fn() } }));
jest.mock('@/services/enterprise-id.service', () => ({ generateAuditId: () => 'audit_pair_1' }));
jest.mock('firebase/firestore', () => {
  const actual = jest.requireActual('firebase/firestore');
  const ref = (_db: unknown, collection: string, id: string) => ({ path: `${collection}/${id}`, id });
  return {
    ...actual,
    doc: ref,
    serverTimestamp: () => 'SERVER_TS',
    getDoc: async () => ({ exists: () => storedFile !== null, data: () => storedFile }),
    updateDoc: async (target: { path: string }, data: Record<string, unknown>) => {
      ops.push({ kind: 'updateDoc', path: target.path, data });
    },
    writeBatch: () => ({
      set: (target: { path: string }, data: Record<string, unknown>) => ops.push({ kind: 'set', path: target.path, data }),
      update: (target: { path: string }, data: Record<string, unknown>) => ops.push({ kind: 'update', path: target.path, data }),
      commit: async () => {
        ops.push({ kind: 'commit' });
      },
    }),
  };
});

const { COLLECTIONS } = require('@/config/firestore-collections') as typeof import('@/config/firestore-collections');
const { FILE_ACTIVITY_PAIRED_ACTIONS, FILE_LAST_ACTIVITY_FIELD } = require('@/types/file-audit') as typeof import('@/types/file-audit');
const { FileAuditService } = require('@/services/file-audit.service') as typeof import('@/services/file-audit.service');
const { commitFileActivity } = require('../file-activity-commit') as typeof import('../file-activity-commit');
const { moveToTrash } = require('@/services/file-record-lifecycle') as typeof import('@/services/file-record-lifecycle');
const { rulesKeyListOf, parseFirestoreRules } = require('../../../../scripts/_shared/firestore-rules-parser.js') as {
  rulesKeyListOf: (rulesText: string, functionName: string) => string[];
  parseFirestoreRules: (rulesText: string) => { collection: string; lineStart: number; lineEnd: number }[];
};

const source = (file: string): string => readFileSync(join(process.cwd(), file), 'utf8');
// `FIRESTORE_RULES_FILE`: οι μεταλλάξεις κανόνων γίνονται ΠΑΝΤΑ σε αντίγραφο — ποτέ στο κοινό αρχείο.
const RULES = readFileSync(process.env.FIRESTORE_RULES_FILE ?? join(process.cwd(), 'firestore.rules'), 'utf8');

/** Το σώμα μιας συνάρτησης του κανόνα, ως την πρώτη `}` στην αρχή γραμμής της ίδιας εσοχής. */
function rulesFunctionBody(name: string): string {
  const start = RULES.indexOf(`function ${name}(`);
  expect(start).toBeGreaterThan(-1);
  return RULES.slice(start, RULES.indexOf('\n    }', start));
}

const fileRef = (collection: string) => ({ path: `${collection}/file_1`, id: 'file_1' }) as never;

beforeEach(() => {
  ops.length = 0;
  storedFile = null;
  jest.restoreAllMocks();
});

describe('Α35 — κανόνας και κώδικας λένε το ΙΔΙΟ', () => {
  it('Α35.1 — οι πράξεις του `FILE_ACTIVITY_PAIRED_ACTIONS` = οι κλάδοι του `personalActivityMatchesChange`', () => {
    const branches = [...rulesFunctionBody('personalActivityMatchesChange').matchAll(/action == '([a-z_]+)'/g)].map((m) => m[1]);
    expect([...new Set(branches)].sort()).toEqual([...FILE_ACTIVITY_PAIRED_ACTIONS].sort());
  });

  it('Α35.2 — κάδος (`lifecycleState` ΚΑΙ `isDeleted`) και μετονομασία είναι ζευγαρωμένα στο `files_personal`', () => {
    expect(rulesKeyListOf(RULES, 'personalActivityKeys').sort()).toEqual(['displayName', 'isDeleted', 'lifecycleState']);
    const block = parseFirestoreRules(RULES).find((b) => b.collection === 'files_personal');
    expect(block).toBeDefined();
    const body = RULES.split('\n').slice(block!.lineStart - 1, block!.lineEnd).join('\n');
    expect(body).toContain('personalActivityPaired()');
  });

  it('Α35.6 — το βιβλίο: ανάγνωση ΜΟΝΟ του κατόχου (ούτε super admin) · αμετάβλητο', () => {
    const block = parseFirestoreRules(RULES).find((b) => b.collection === 'file_audit_log_personal');
    expect(block).toBeDefined();
    const body = RULES.split('\n').slice(block!.lineStart - 1, block!.lineEnd).join('\n');
    expect(body).not.toContain('isSuperAdminOnly');
    expect(body).toContain('resource.data.userId == request.auth.uid');
    expect(body).toMatch(/allow update, delete: if false;/);
    expect(body).toContain('request.resource.data.performedBy == request.auth.uid');
    expect(body).toContain('request.resource.data.timestamp == request.time');
  });
});

describe('Α35 — ο ΕΝΑΣ γραφέας (`commitFileActivity`)', () => {
  const act = { fileId: 'file_1', action: 'rename', performedBy: 'u_person', metadata: { newDisplayName: 'x' } } as const;

  it('📒 Α35.3 — προσωπικό ⇒ ΜΙΑ δέσμη: γραμμή στο ΠΡΟΣΩΠΙΚΟ βιβλίο, δείκτης στην ΙΔΙΑ γραμμή, καμία `updateDoc`', async () => {
    await commitFileActivity({
      docRef: fileRef(COLLECTIONS.FILES_PERSONAL),
      owner: { userId: 'u_person' },
      updates: { displayName: 'x' },
      act,
      context: 'test',
    });

    expect(ops.map((o) => o.kind)).toEqual(['set', 'update', 'commit']);
    const [row, change] = ops;
    expect(row.path).toBe(`${COLLECTIONS.FILE_AUDIT_LOG_PERSONAL}/audit_pair_1`);
    expect(row.data).toEqual({
      fileId: 'file_1', action: 'rename', performedBy: 'u_person', userId: 'u_person',
      timestamp: 'SERVER_TS', metadata: { newDisplayName: 'x' },
    });
    expect(change.data).toEqual({ displayName: 'x', [FILE_LAST_ACTIVITY_FIELD]: 'audit_pair_1' });
  });

  it('Α35.4 — εταιρικό ⇒ ό,τι ίσχυε: ενημέρωση ΚΑΙ προβολή με `companyId`, καμία δέσμη', async () => {
    const log = jest.spyOn(FileAuditService, 'log').mockResolvedValue('audit_c');

    await commitFileActivity({
      docRef: fileRef(COLLECTIONS.FILES),
      owner: { companyId: 'c_alpha' },
      updates: { displayName: 'x' },
      act,
      context: 'test',
    });

    expect(ops.map((o) => o.kind)).toEqual(['updateDoc']);
    expect(ops[0].data).toEqual({ displayName: 'x' });
    expect(log).toHaveBeenCalledWith('file_1', 'rename', 'u_person', 'c_alpha', { newDisplayName: 'x' });
  });
});

describe('Α35.5 — ο κάδος είναι ιδεμπότητος (§2.6.11 Β3)', () => {
  it('αρχείο ήδη στον κάδο ⇒ ΚΑΜΙΑ γραφή, καμία γραμμή', async () => {
    storedFile = { userId: 'u_person', lifecycleState: 'trashed', isDeleted: true, category: 'contracts' };
    await moveToTrash('file_1', 'personal', 'u_person');
    expect(ops).toEqual([]);
  });

  it('ενεργό αρχείο ⇒ ζευγαρωμένη δέσμη `delete`', async () => {
    storedFile = { userId: 'u_person', lifecycleState: 'active', category: 'contracts' };
    await moveToTrash('file_1', 'personal', 'u_person');
    expect(ops.map((o) => o.kind)).toEqual(['set', 'update', 'commit']);
    expect(ops[0].data).toMatchObject({ action: 'delete', userId: 'u_person' });
    expect(ops[1].data).toMatchObject({ lifecycleState: 'trashed', isDeleted: true, lastActivityId: 'audit_pair_1' });
  });
});

describe('Α35.7 — σιωπή #4: η Δραστηριότητα φαίνεται και στον ιδιώτη', () => {
  it('το `AuditLogPanel` ζητά ΚΑΤΟΧΟ, και ο γονιός του ΔΕΝ το κρύβει πίσω από το `officeActions`', () => {
    const panel = source('src/components/file-manager/FilePreviewPanel.tsx');
    expect(panel).toContain('<AuditLogPanel fileId={file.id} custody={owner}');
    expect(panel).not.toMatch(/officeActions && showAudit/);
  });
});
