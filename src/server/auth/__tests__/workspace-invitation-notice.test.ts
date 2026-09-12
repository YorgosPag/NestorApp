/**
 * @jest-environment node
 *
 * @fileoverview **Ο ΑΠΟΣΤΟΛΕΑΣ ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ** (ADR-853 Φ5) — άγκυρες.
 * @related server/auth/workspace-invitation-notice.ts
 *
 * - **Γ** — η γλώσσα: κλίμακα τριών, με τον παρονομαστή κάθε σκαλοπατιού.
 * - **Α** — η έκβαση: ονομασμένη, και **ποτέ** εξαίρεση προς τα πάνω.
 * - **Σ** — το μυστικό: το ωμό token **δεν** φτάνει ποτέ στα αρχεία καταγραφής.
 */

jest.mock('server-only', () => ({}));

const getUserByEmailMock = jest.fn();
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminAuth: () => ({ getUserByEmail: (...args: unknown[]) => getUserByEmailMock(...args) }),
}));

const declaredLanguageMock = jest.fn(async (_uid: string): Promise<string | null> => null);
jest.mock('@/server/notifications/user-notification-settings-store', () => ({
  loadDeclaredEmailLanguage: (uid: string) => declaredLanguageMock(uid),
}));

const sendMock = jest.fn(async (..._args: unknown[]) => ({ success: true as boolean, error: undefined as string | undefined }));
jest.mock('@/services/ai-pipeline/shared/mailgun-sender', () => ({
  sendReplyViaMailgun: (...args: unknown[]) => sendMock(...args),
}));

const readWorkspaceNameMock = jest.fn(async (_id: string): Promise<string> => 'Παγώνης Τεχνική');
jest.mock('@/lib/workspace/workspace-catalog', () => ({
  readWorkspaceName: (id: string) => readWorkspaceNameMock(id),
}));

/**
 * Τα ίχνη κρατιούνται **πραγματικά**, ώστε η άγκυρα Σ1 να έχει τι να ελέγξει.
 *
 * 🔴 **ΠΡΟΣΟΧΗ ΣΤΗΝ ΑΝΥΨΩΣΗ — Η ΠΡΩΤΗ ΓΡΑΦΗ ΕΣΠΑΣΕ ΕΔΩ** (2026-09-12):
 * το `jest.mock(...)` ανεβαίνει **πάνω** από τις δηλώσεις `const`, και ο κώδικας υπό
 * δοκιμή καλεί `createModuleLogger()` **στο σώμα του module** — δηλαδή το εργοστάσιο
 * εκτελείται **πριν** αρχικοποιηθεί οτιδήποτε εδώ (`ReferenceError: Cannot access
 * 'logSink' before initialization`).
 *
 * ⇒ Οι μέθοδοι είναι **συναρτήσεις που διαβάζουν τη δέσμευση ΟΤΑΝ κληθούν**, ποτέ τιμές
 * που διαβάζονται τη στιγμή της κατασκευής. Ίδιο ιδίωμα με τα υπόλοιπα mock αυτού του
 * φακέλου (`(...args) => sendMock(...args)`), για τον **ίδιο** λόγο.
 */
const logged: unknown[] = [];
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    info: (...args: unknown[]) => { logged.push(...args); },
    warn: (...args: unknown[]) => { logged.push(...args); },
    error: (...args: unknown[]) => { logged.push(...args); },
    debug: (...args: unknown[]) => { logged.push(...args); },
  }),
}));

import { notifyWorkspaceInvitation } from '../workspace-invitation-notice';
import type { WorkspaceInvitation } from '@/types/workspace-invitation';

const ORIGIN = 'https://nestorconstruct.gr';
const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

const NOW = '2026-09-12T10:00:00.000Z';
const TOKEN = 'tok_mystiko_123';

const INVITATION: WorkspaceInvitation = {
  id: 'winv_abc',
  companyId: 'comp_pagonis',
  inviteeEmail: 'nikos@example.com',
  role: 'internal_user',
  invitedByUid: 'uid_admin',
  nonceHash: 'f'.repeat(64),
  state: 'pending',
  createdAt: NOW,
  expiresAt: '2026-09-19T10:00:00.000Z',
  openedAt: null,
  resolvedAt: null,
  resolvedByUid: null,
};

function notify() {
  return notifyWorkspaceInvitation({ invitation: INVITATION, token: TOKEN, nowISOValue: NOW });
}

/** Το μήνυμα που δόθηκε στον πάροχο. */
function sentMail(): { to: string; subject: string; textBody: string; htmlBody: string } {
  return sendMock.mock.calls[0][0] as { to: string; subject: string; textBody: string; htmlBody: string };
}

beforeEach(() => {
  jest.clearAllMocks();
  logged.length = 0;
  process.env.NEXT_PUBLIC_APP_URL = ORIGIN;
  // Προεπιλογή: ο παραλήπτης **δεν** έχει λογαριασμό — η συνηθισμένη πρόσκληση (§6 #2).
  getUserByEmailMock.mockRejectedValue({ code: 'auth/user-not-found' });
  declaredLanguageMock.mockResolvedValue(null);
  readWorkspaceNameMock.mockResolvedValue('Παγώνης Τεχνική');
  sendMock.mockResolvedValue({ success: true, error: undefined });
});

afterAll(() => {
  if (ORIGINAL_APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
});

// =============================================================================
// Π — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ
// =============================================================================

describe('Π — ο παρονομαστής: η σωστή πρόσκληση φεύγει', () => {
  it('Π1 — στέλνεται ΣΤΟΝ παραλήπτη, με τον σύνδεσμό του, και η έκβαση είναι `accepted`', async () => {
    expect(await notify()).toBe('accepted');

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sentMail().to).toBe('nikos@example.com');
    expect(sentMail().htmlBody).toContain(`${ORIGIN}/invite/${TOKEN}`);
  });
});

// =============================================================================
// Γ — Η ΚΛΙΜΑΚΑ ΤΗΣ ΓΛΩΣΣΑΣ
// =============================================================================

describe('Γ — σε ποια γλώσσα μιλάμε', () => {
  it('🔴 Γ1 — η ΔΗΛΩΜΕΝΗ ΤΟΥ ΠΑΡΑΛΗΠΤΗ κερδίζει, όταν έχει ήδη λογαριασμό', async () => {
    getUserByEmailMock.mockResolvedValue({ uid: 'uid_nikos' });
    declaredLanguageMock.mockImplementation(async (uid: string) =>
      uid === 'uid_nikos' ? 'en' : 'el',
    );

    await notify();

    // Το Slack στέλνει στη γλώσσα ΤΟΥ ΧΩΡΟΥ· εδώ ρωτάμε πρώτα τον άνθρωπο.
    expect(sentMail().subject).toContain('invited you to collaborate');
  });

  it('🔑 Γ2 — ΧΩΡΙΣ λογαριασμό παραλήπτη ⇒ η γλώσσα του ΠΡΟΣΚΑΛΟΥΝΤΟΣ', async () => {
    declaredLanguageMock.mockImplementation(async (uid: string) =>
      uid === 'uid_admin' ? 'en' : null,
    );

    await notify();

    expect(sentMail().subject).toContain('invited you to collaborate');
  });

  it('Γ3 — κανείς δεν έχει δηλώσει ⇒ η προεπιλογή, ΠΟΤΕ κενό μήνυμα', async () => {
    await notify();

    expect(sentMail().subject).toContain('Πρόσκληση συνεργασίας');
  });

  it('🔑 Γ4 — αποτυχία ανάγνωσης γλώσσας ΔΕΝ ρίχνει το email', async () => {
    declaredLanguageMock.mockRejectedValue(new Error('firestore κάτω'));

    expect(await notify()).toBe('accepted');
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// Α — Η ΕΚΒΑΣΗ, ΟΝΟΜΑΣΤΙΚΑ
// =============================================================================

describe('Α — τι απέγινε το μήνυμα', () => {
  it('🔴 Α1 — ΧΩΡΙΣ δημόσια διεύθυνση ⇒ `unaddressable` και ΚΑΜΙΑ απόπειρα αποστολής', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    expect(await notify()).toBe('unaddressable');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('🔴 Α2 — ο πάροχος αρνείται ⇒ `failed`, ΠΟΤΕ εξαίρεση προς τα πάνω', async () => {
    sendMock.mockResolvedValue({ success: false, error: 'Mailgun API 401' });

    // Η πρόσκληση ΥΠΑΡΧΕΙ ήδη: εξαίρεση εδώ θα έλεγε «απέτυχε» για πράξη που πέτυχε.
    await expect(notify()).resolves.toBe('failed');
  });

  it('🔴 Α3 — ο πάροχος ΠΕΤΑ ⇒ `failed`, και πάλι καμία εξαίρεση προς τα πάνω', async () => {
    sendMock.mockRejectedValue(new Error('δίκτυο κάτω'));

    await expect(notify()).resolves.toBe('failed');
  });

  it('🔑 Α4 — το όνομα του χώρου δεν διαβάστηκε ⇒ το email ΦΕΥΓΕΙ, με την ετικέτα του', async () => {
    readWorkspaceNameMock.mockRejectedValue(new Error('firestore κάτω'));

    expect(await notify()).toBe('accepted');
    // Σιωπή θα ήταν χειρότερη από ατελές μήνυμα — και ποτέ ωμό `comp_*`.
    expect(sentMail().subject).toContain('ένα γραφείο');
    expect(sentMail().htmlBody).not.toContain('comp_pagonis');
  });
});

// =============================================================================
// Σ — ΤΟ ΜΥΣΤΙΚΟ ΔΕΝ ΓΡΑΦΕΤΑΙ ΠΟΥΘΕΝΑ
// =============================================================================

describe('Σ — το ωμό token', () => {
  it('🔒 Σ1 — ΔΕΝ εμφανίζεται στα ίχνη, ούτε σε επιτυχία ούτε σε αποτυχία', async () => {
    await notify();
    sendMock.mockResolvedValue({ success: false, error: 'Mailgun API 500' });
    await notify();

    // ΠΑΡΟΝΟΜΑΣΤΗΣ: τα ίχνη ΓΡΑΦΤΗΚΑΝ — αλλιώς το «δεν βρήκα token» δεν σημαίνει τίποτα.
    expect(logged.length).toBeGreaterThan(0);
    expect(JSON.stringify(logged)).not.toContain(TOKEN);
  });

  it('🔒 Σ2 — ταξιδεύει ΜΟΝΟ μέσα στο μήνυμα του παραλήπτη', async () => {
    await notify();

    expect(sentMail().htmlBody).toContain(TOKEN);
    expect(sentMail().textBody).toContain(TOKEN);
  });
});
