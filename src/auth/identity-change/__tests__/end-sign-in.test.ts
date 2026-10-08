/**
 * @fileoverview ADR-908 §3.1 — ο ΕΝΑΣ κάτοχος της αποσύνδεσης: η **σειρά** είναι το συμβόλαιο.
 *
 * | Άγκυρα | Τι φυλά |
 * |---|---|
 * | Κ1 🔴 | συσκευή → Firebase → cookie → **πλοήγηση εγγράφου τελευταία** (η «αισιόδοξη» πλοήγηση ήταν το ελάττωμα) |
 * | Κ2 🔴 | φράχτης + εποχή **πριν** από το πρώτο αίτημα, και ο φράχτης **μένει** κλειστός ως το τέλος του εγγράφου |
 * | Κ3 | ιδεμποτικό: δύο κλήσεις = **μία** πράξη (διπλό κλικ · δύο σήματα ανάκλησης) |
 * | Κ4 🔴 | αποτυχία σκέλους ⇒ πλοηγεί **ούτως ή άλλως** (ο άνθρωπος δεν κολλά) |
 * | Κ5 | `stay` ⇒ καμία πλοήγηση, ο φράχτης ανοίγει, ο κάτοχος ελευθερώνεται |
 * | Κ6 | χωρίς συνδεδεμένο χρήστη ⇒ κανένα αίτημα εγγραφής συσκευής |
 * | Π1–Π4 | ο πίνακας προορισμών: `next` **ποτέ** στη ρητή αποσύνδεση, **πάντα** στην ανάκληση |
 */

const mockLog: string[] = [];
const mockFailing = new Set<string>();
const mockAuth: { currentUser: { uid: string } | null } = { currentUser: { uid: 'u1' } };
let mockProbe: (() => void) | null = null;

function mockStep(name: string): void {
  mockLog.push(name);
  if (mockFailing.has(name)) throw new Error(`${name} failed`);
}

jest.mock('firebase/auth', () => ({ signOut: async () => mockStep('firebase') }));
jest.mock('@/lib/firebase', () => ({ get auth() { return mockAuth; } }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/services/session', () => ({
  sessionService: {
    endCurrentSession: async (uid: string) => {
      mockProbe?.();
      mockStep(`device:${uid}`);
    },
  },
}));
jest.mock('@/lib/browser/document-navigation', () => ({
  navigateDocument: (url: string, options?: { replace?: boolean }) => mockStep(`navigate:${url}:${String(options?.replace)}`),
}));
jest.mock('../../contexts/auth-context/auth-context-session', () => ({
  clearServerSessionCookie: async () => mockStep('cookie'),
}));
jest.mock('@/lib/routes/return-path', () => ({ loginHrefForCurrentLocation: () => '/login?next=%2Fhere' }));

import { destinationAfterSignIn } from '../end-sign-in-destinations';

/** Φρέσκος κάτοχος ανά άγκυρα: το `navigate` αφήνει **επίτηδες** την πράξη ανοιχτή (το έγγραφο τελειώνει). */
async function load() {
  jest.resetModules();
  const owner = await import('../end-sign-in');
  const handover = await import('../../contexts/auth-context/session-handover');
  const epoch = await import('../../contexts/auth-context/identity-epoch');
  return { owner, handover, epoch };
}

const announce = () => mockLog.push('announce');

beforeEach(() => {
  mockLog.length = 0;
  mockFailing.clear();
  mockAuth.currentUser = { uid: 'u1' };
  mockProbe = null;
  window.addEventListener('auth:logout', announce);
});

afterEach(() => window.removeEventListener('auth:logout', announce));

describe('Κ — η πράξη', () => {
  it('Κ1 🔴 — συσκευή → Firebase → cookie → πλοήγηση εγγράφου ΤΕΛΕΥΤΑΙΑ, με replace', async () => {
    const { owner } = await load();
    await expect(owner.endSignIn({ reason: 'user-request' })).resolves.toBe('navigate');
    expect(mockLog).toEqual(['announce', 'device:u1', 'firebase', 'cookie', 'navigate:/login:true']);
  });

  it('Κ2 🔴 — φράχτης και εποχή ΠΡΙΝ το πρώτο αίτημα· ο φράχτης μένει ως το τέλος του εγγράφου', async () => {
    const { owner, handover, epoch } = await load();
    const before = epoch.currentIdentityEpoch();
    let fencedAtFirstRequest = false;
    let epochMovedAtFirstRequest = false;
    mockProbe = () => {
      fencedAtFirstRequest = handover.isSessionHandoverActive();
      epochMovedAtFirstRequest = epoch.identityChangedSince(before);
    };

    await owner.endSignIn({ reason: 'user-request' });

    expect(fencedAtFirstRequest).toBe(true);
    expect(epochMovedAtFirstRequest).toBe(true);
    expect(handover.isSessionHandoverActive()).toBe(true);
    expect(owner.isEndSignInActive()).toBe(true);
  });

  it('Κ3 — δύο κλήσεις = ΜΙΑ πράξη, και κερδίζει ο πρώτος λόγος', async () => {
    const { owner } = await load();
    const first = owner.endSignIn({ reason: 'user-request' });
    const second = owner.endSignIn({ reason: 'revoked' });
    expect(second).toBe(first);
    await first;
    expect(mockLog.filter((entry) => entry === 'firebase')).toHaveLength(1);
    expect(mockLog.filter((entry) => entry.startsWith('navigate:'))).toEqual(['navigate:/login:true']);
  });

  it('Κ4 🔴 — Firebase ΚΑΙ cookie αποτυγχάνουν ⇒ πλοηγεί ούτως ή άλλως', async () => {
    const { owner } = await load();
    mockFailing.add('firebase').add('cookie');
    await expect(owner.endSignIn({ reason: 'user-request' })).resolves.toBe('navigate');
    expect(mockLog.at(-1)).toBe('navigate:/login:true');
    expect(mockLog).toContain('cookie');
  });

  it('Κ5 — `stay`: καμία πλοήγηση, ο φράχτης ανοίγει, ο κάτοχος ελευθερώνεται', async () => {
    const { owner, handover } = await load();
    await expect(owner.endSignIn({ reason: 'credential-changed' })).resolves.toBe('stay');
    expect(mockLog).toEqual(['announce', 'device:u1', 'firebase', 'cookie']);
    expect(handover.isSessionHandoverActive()).toBe(false);
    expect(owner.isEndSignInActive()).toBe(false);
  });

  it('Κ6 — κανείς συνδεδεμένος ⇒ κανένα αίτημα εγγραφής συσκευής', async () => {
    const { owner } = await load();
    mockAuth.currentUser = null;
    await owner.endSignIn({ reason: 'user-request' });
    expect(mockLog.some((entry) => entry.startsWith('device:'))).toBe(false);
  });
});

describe('Π — ο πίνακας προορισμών', () => {
  it('Π1 🔴 — ρητή αποσύνδεση και αποχώρηση: σκέτο /login, ΠΟΤΕ `next`', () => {
    expect(destinationAfterSignIn({ reason: 'user-request' })).toEqual({ kind: 'navigate', href: '/login' });
    expect(destinationAfterSignIn({ reason: 'left-workspace' })).toEqual({ kind: 'navigate', href: '/login' });
  });

  it('Π2 — ανάκληση: σύνδεση ΜΕ επιστροφή εδώ (γυρνά ο ίδιος άνθρωπος)', () => {
    expect(destinationAfterSignIn({ reason: 'revoked' })).toEqual({ kind: 'navigate', href: '/login?next=%2Fhere' });
  });

  it('Π3 — αλλαγή λογαριασμού: ΑΚΡΙΒΩΣ το href του διακομιστή', () => {
    const href = '/login?next=%2Finvite%2Ftok';
    expect(destinationAfterSignIn({ reason: 'switch-account', href })).toEqual({ kind: 'navigate', href });
  });

  it('Π4 — αλλαγή email: η σελίδα μένει', () => {
    expect(destinationAfterSignIn({ reason: 'credential-changed' })).toEqual({ kind: 'stay' });
  });
});
