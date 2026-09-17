/**
 * @jest-environment node
 *
 * @fileoverview 🔴 **Η ΑΓΚΥΡΑ Α23** — ο φράχτης ανάγνωσης ακολουθεί τη φάση (ADR-862 Φ0 Β11).
 * @related lib/auth/container-read-reach · lib/files/file-record-read ·
 *          services/iso19650/container-transitions · services/file-record/file-record-core
 *
 * Ο κανόνας `allow list` των `files` κρίνει από το `cdeReadReach`. Αν η τιμή **αποκλίνει**
 * από τη φάση, είτε το WIP ανοίγει σε όλο το γραφείο (διαρροή ημιτελούς μελέτης) είτε το
 * εγκεκριμένο σχέδιο **εξαφανίζεται** από κάθε λίστα. Η άγκυρα κλειδώνει τις ΤΡΕΙΣ πόρτες
 * από τις οποίες μπορεί να γεννηθεί απόκλιση — **και** τον θεματοφύλακα που την πιάνει:
 *
 *   Π — ο πίνακας (παραγωγή)       Γ — η γέννηση (builder)
 *   Γρ — ο γραφέας (ίδια update)   Θ — ο θεματοφύλακας (ξαναπαράγει και συγκρίνει)
 *
 * ⚠️ Όπως στην Α17: ο γνήσιος `readContainerState` **δεν** γίνεται mock — η διαφωνία
 * γραφέα/αναγνώστη είναι ακριβώς η βλάβη που ψάχνουμε.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { CDE_STATE_VALUES } from '@/config/iso19650-constants';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { readContainerState } from '@/lib/files/file-record-read';
import {
  BIRTH_READ_REACH,
  READ_REACH_BY_PHASE,
  readReachFor,
} from '@/lib/auth/container-read-reach';
import { CONTAINER_POLICY_TABLES } from '@/lib/auth/container-access';
import { buildPendingFileRecordData } from '@/services/file-record/file-record-core';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

let fake: FakeFirestore;

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: (): AdminFirestore => fake as unknown as AdminFirestore,
}));

jest.mock('@/services/file-audit-admin.service', () => ({
  recordFileAudit: jest.fn(async () => 'audit_test'),
}));

import { transitionContainer } from '../container-transitions';

const FILE_ID = 'file_reach_anchor';
const COMPANY = 'c_alpha';
const AUTHOR = 'u_author';
const author = { uid: AUTHOR, custody: { companyId: COMPANY }, globalRole: 'company_admin' as const };

function seedFile(extra: Record<string, unknown> = {}): void {
  fake.seed(COLLECTIONS.FILES, FILE_ID, {
    id: FILE_ID,
    companyId: COMPANY,
    // ADR-862 §5.3.7 — φάσεις CDE ΜΟΝΟ σε δοχείο έργου· χωρίς αυτό η άγκυρα θα ασκούσε το `versions-only`.
    projectId: 'proj_cde',
    createdBy: AUTHOR,
    status: 'ready',
    revision: 2,
    cdeReadReach: BIRTH_READ_REACH,
    ...extra,
  });
}

function storedFile(): Record<string, unknown> {
  return fake.all<Record<string, unknown>>(COLLECTIONS.FILES)[0] ?? {};
}

beforeEach(() => {
  fake = new FakeFirestore();
});

describe('Α23.Π — ο πίνακας', () => {
  it('κάθε κατάσταση του λεξιλογίου έχει φράχτη (παρονομαστής: 4)', () => {
    expect(CDE_STATE_VALUES).toHaveLength(4);
    for (const state of CDE_STATE_VALUES) {
      expect(readReachFor(state)).not.toBeNull();
    }
  });

  it('WIP ⇒ μόνο ο δημιουργός· pre-cde ⇒ όλο το γραφείο («όπως σήμερα»)· βλάβη ⇒ κανένας φράχτης', () => {
    expect(readReachFor('WIP')).toBe('author');
    expect(readReachFor('pre-cde')).toBe('tenant');
    expect(readReachFor('SHARED')).toBe('tenant');
    expect(readReachFor('PUBLISHED')).toBe('tenant');
    expect(readReachFor('SUPERSEDED')).toBe('tenant');
    expect(readReachFor('unreadable')).toBeNull();
  });

  it('ο κριτής εκθέτει τον ΙΔΙΟ πίνακα — όχι αντίγραφο', () => {
    expect(CONTAINER_POLICY_TABLES.READ_REACH_BY_PHASE).toBe(READ_REACH_BY_PHASE);
  });
});

describe('Α23.Γ — η γέννηση', () => {
  it('ο builder γράφει τον φράχτη της γέννησης, και ο θεματοφύλακας διαβάζει pre-cde', () => {
    const { recordBase } = buildPendingFileRecordData({
      companyId: COMPANY,
      createdBy: AUTHOR,
      entityType: 'project',
      entityId: 'p_1',
      domain: 'construction',
      category: 'drawings',
      originalFilename: 'plan.pdf',
      contentType: 'application/pdf',
    });
    expect(recordBase.cdeReadReach).toBe('tenant');
    expect(readContainerState({ ...recordBase })).toEqual({ phase: 'pre-cde' });
  });
});

describe('Α23.Γρ — ο γραφέας', () => {
  it('σφραγίδα από pre-cde ⇒ WIP ⇒ φράχτης «author», στην ΙΔΙΑ εγγραφή, και ο αναγνώστης συμφωνεί', async () => {
    seedFile();
    const before = fake.writes;

    await transitionContainer({ fileId: FILE_ID, act: 'seal', actor: author });

    const stored = storedFile();
    expect(fake.writes - before).toBe(1);
    expect(stored.cdeState).toBe('WIP');
    expect(stored.cdeReadReach).toBe('author');
    expect(readContainerState(stored).phase).toBe('WIP');
  });

  it('παράδοση ⇒ SHARED ⇒ ο φράχτης ξανανοίγει στο γραφείο', async () => {
    seedFile();
    await transitionContainer({ fileId: FILE_ID, act: 'seal', actor: author });
    await transitionContainer({ fileId: FILE_ID, act: 'share', actor: author });

    const stored = storedFile();
    expect(stored.cdeReadReach).toBe('tenant');
    expect(readContainerState(stored).phase).toBe('SHARED');
  });
});

describe('Α23.Θ — ο θεματοφύλακας', () => {
  it('🔴 WIP με φράχτη γραφείου (χειρόγραφη «διόρθωση») ⇒ unreadable, ποτέ ορατό σε όλους', () => {
    const state = readContainerState({
      cdeState: 'WIP',
      cdeSeal: { by: AUTHOR, at: '2026-09-17T10:00:00.000Z', revision: 2 },
      revision: 2,
      cdeReadReach: 'tenant',
    });
    expect(state).toEqual({ phase: 'unreadable', why: 'read-reach-mismatch' });
  });

  it('🔴 τιμή εκτός λεξιλογίου ⇒ unreadable', () => {
    expect(readContainerState({ cdeReadReach: 'everyone' })).toEqual({
      phase: 'unreadable',
      why: 'read-reach-outside-vocabulary',
    });
  });

  it('απών φράχτης (πριν τη μετανάστευση) ⇒ ανεκτός: pre-cde μένει pre-cde', () => {
    expect(readContainerState({})).toEqual({ phase: 'pre-cde' });
  });
});
