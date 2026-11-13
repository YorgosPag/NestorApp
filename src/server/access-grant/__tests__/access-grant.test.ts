/**
 * @jest-environment node
 *
 * @fileoverview Ο πυρήνας του κουπονιού επίσκεψης — **ανανεώσιμα** είδη (ADR-315 Α6, 2026-11-13).
 * @related server/access-grant/access-grant.ts
 *
 * Πρότυπο OWASP Session Management: λήξη **αδράνειας** (15′) που ανανεώνεται + **απόλυτη** λήξη που δεν παρατείνεται.
 * Φυλάσσεται επίσης ότι το **μη** ανανεώσιμο είδος (θέαση περιήγησης) κρατά τη μορφή μίας λήξης και δεν ανανεώνεται.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

import {
  ACCESS_GRANT_TTL_SECONDS,
  issueAccessGrant,
  readAccessGrant,
  renewAccessGrant,
  type AccessGrantKind,
} from '../access-grant';

const SECRET_ENV = 'SHARE_ACCESS_SECRET';
const NOW = Date.UTC(2026, 10, 13, 12, 0, 0);
const MINUTE = 60_000;
const IDLE_MS = ACCESS_GRANT_TTL_SECONDS * 1000;

const RENEWABLE: AccessGrantKind = { purpose: 'visit-test', subjectFieldCount: 1, visitCeilingSeconds: 60 * 60 };
const SINGLE: AccessGrantKind = { purpose: 'visit-test', subjectFieldCount: 1 };

beforeEach(() => {
  process.env[SECRET_ENV] = 'test-secret-with-enough-entropy-0123456789abcdef';
});

describe('ανανεώσιμο είδος — αδράνεια', () => {
  it('ζει ως τη λήξη αδράνειας και όχι μετά', () => {
    const grant = issueAccessGrant(RENEWABLE, ['share_1'], NOW)!;
    expect(readAccessGrant(RENEWABLE, grant, NOW + IDLE_MS - 1000)).toEqual(['share_1']);
    expect(readAccessGrant(RENEWABLE, grant, NOW + IDLE_MS)).toBeNull();
  });

  it('η ανανέωση μεταθέτει τη λήξη αδράνειας από το «τώρα» της ανανέωσης', () => {
    const grant = issueAccessGrant(RENEWABLE, ['share_1'], NOW)!;
    const renewed = renewAccessGrant(RENEWABLE, grant, NOW + 10 * MINUTE)!;
    expect(readAccessGrant(RENEWABLE, renewed, NOW + 10 * MINUTE + IDLE_MS - 1000)).toEqual(['share_1']);
    expect(readAccessGrant(RENEWABLE, renewed, NOW + 10 * MINUTE + IDLE_MS)).toBeNull();
  });

  it('ληγμένο κουπόνι δεν ανανεώνεται (η αδράνεια είναι πραγματική)', () => {
    const grant = issueAccessGrant(RENEWABLE, ['share_1'], NOW)!;
    expect(renewAccessGrant(RENEWABLE, grant, NOW + IDLE_MS)).toBeNull();
  });
});

describe('ανανεώσιμο είδος — απόλυτη λήξη', () => {
  it('συνεχείς ανανεώσεις δεν περνούν ποτέ την απόλυτη λήξη', () => {
    let grant = issueAccessGrant(RENEWABLE, ['share_1'], NOW)!;
    for (let at = NOW + 10 * MINUTE; at < NOW + 60 * MINUTE; at += 10 * MINUTE) {
      grant = renewAccessGrant(RENEWABLE, grant, at)!;
      expect(grant).not.toBeNull();
    }
    expect(readAccessGrant(RENEWABLE, grant, NOW + 60 * MINUTE - 1000)).toEqual(['share_1']);
    expect(readAccessGrant(RENEWABLE, grant, NOW + 60 * MINUTE)).toBeNull();
    expect(renewAccessGrant(RENEWABLE, grant, NOW + 60 * MINUTE)).toBeNull();
  });

  it('η λήξη αδράνειας κόβεται στην απόλυτη λήξη (όχι now + 15′)', () => {
    // Ζωντανή σελίδα: ανανεώσεις ανά 10′ (πάντα πριν λήξει η αδράνεια), η τελευταία στο 55′.
    let late = issueAccessGrant(RENEWABLE, ['share_1'], NOW)!;
    for (const minute of [10, 20, 30, 40, 50, 55]) late = renewAccessGrant(RENEWABLE, late, NOW + minute * MINUTE)!;
    expect(readAccessGrant(RENEWABLE, late, NOW + 59 * MINUTE)).toEqual(['share_1']);
    expect(readAccessGrant(RENEWABLE, late, NOW + 61 * MINUTE)).toBeNull();
  });
});

describe('μη ανανεώσιμο είδος (θέαση περιήγησης) — αμετάβλητο', () => {
  it('μία λήξη 15′, καμία ανανέωση', () => {
    const grant = issueAccessGrant(SINGLE, ['tour_1'], NOW)!;
    expect(readAccessGrant(SINGLE, grant, NOW + IDLE_MS - 1000)).toEqual(['tour_1']);
    expect(readAccessGrant(SINGLE, grant, NOW + IDLE_MS)).toBeNull();
    expect(renewAccessGrant(SINGLE, grant, NOW + MINUTE)).toBeNull();
  });

  it('τα δύο σχήματα δεν διαβάζονται το ένα ως το άλλο', () => {
    const single = issueAccessGrant(SINGLE, ['share_1'], NOW)!;
    const renewable = issueAccessGrant(RENEWABLE, ['share_1'], NOW)!;
    expect(readAccessGrant(RENEWABLE, single, NOW)).toBeNull();
    expect(readAccessGrant(SINGLE, renewable, NOW)).toBeNull();
    expect(renewAccessGrant(RENEWABLE, single, NOW)).toBeNull();
  });
});

describe('σκοπός και μυστικό', () => {
  it('άλλος σκοπός ⇒ απόρριψη, και στην ανανέωση', () => {
    const foreign = issueAccessGrant({ ...RENEWABLE, purpose: 'other' }, ['share_1'], NOW)!;
    expect(readAccessGrant(RENEWABLE, foreign, NOW)).toBeNull();
    expect(renewAccessGrant(RENEWABLE, foreign, NOW)).toBeNull();
  });

  it('χωρίς μυστικό ⇒ ούτε έκδοση ούτε ανανέωση', () => {
    const grant = issueAccessGrant(RENEWABLE, ['share_1'], NOW)!;
    delete process.env[SECRET_ENV];
    expect(issueAccessGrant(RENEWABLE, ['share_1'], NOW)).toBeNull();
    expect(renewAccessGrant(RENEWABLE, grant, NOW)).toBeNull();
  });
});
