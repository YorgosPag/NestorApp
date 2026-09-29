/**
 * Tests — οι αποφάσεις του κύκλου ζωής μιας συνεδρίας (ADR-894).
 *
 * Κάθε άγκυρα φυλά μια απόφαση που, αν σπάσει, **αποσυνδέει λάθος συσκευή** ή **κρατά νεκρή** εγγραφή:
 * ποια ζει, ποια ανακαλείται στο όριο (η **παλαιότερη**, ποτέ η πιο πρόσφατη), πότε ξαναλύνεται η θέση.
 */

import {
  isSessionAlive,
  knownFingerprintOf,
  needsRelocation,
  planSessionCap,
  type SessionLifeFacts,
} from '../session-lifecycle';

const NOW = Date.UTC(2026, 8, 29, 12);
const HOUR = 60 * 60 * 1000;

const alive = (id: string): SessionLifeFacts => ({ id, status: 'active', expiresAtMs: NOW + HOUR });
const lapsed = (id: string): SessionLifeFacts => ({ id, status: 'active', expiresAtMs: NOW - HOUR });

describe('isSessionAlive', () => {
  it('active + μελλοντική λήξη ⇒ ζει', () => {
    expect(isSessionAlive(alive('a'), NOW)).toBe(true);
  });

  it.each([
    ['ληγμένη', lapsed('a')],
    ['ανακλημένη', { id: 'a', status: 'revoked', expiresAtMs: NOW + HOUR }],
    ['χωρίς λήξη (fail-closed)', { id: 'a', status: 'active', expiresAtMs: null }],
    ['λήξη ακριβώς τώρα', { id: 'a', status: 'active', expiresAtMs: NOW }],
  ])('%s ⇒ δεν ζει', (_label, facts) => {
    expect(isSessionAlive(facts, NOW)).toBe(false);
  });
});

describe('knownFingerprintOf / needsRelocation', () => {
  it('η τελευταία θέση υπερισχύει της θέσης σύνδεσης', () => {
    expect(knownFingerprintOf({ location: { ipFingerprint: 'login' }, lastLocation: { ipFingerprint: 'latest' } })).toBe('latest');
    expect(knownFingerprintOf({ location: { ipFingerprint: 'login' } })).toBe('login');
    expect(knownFingerprintOf(undefined)).toBeNull();
  });

  it('ίδιο δίκτυο ⇒ καμία νέα επίλυση· άλλο δίκτυο ⇒ νέα επίλυση', () => {
    expect(needsRelocation('f1', 'f1')).toBe(false);
    expect(needsRelocation('f1', 'f2')).toBe(true);
    expect(needsRelocation(null, 'f2')).toBe(true);
  });
});

describe('planSessionCap', () => {
  it('στο όριο ανακαλούνται οι ΠΑΛΑΙΟΤΕΡΕΣ, κρατώντας θέση για τη νέα', () => {
    const newestFirst = ['n1', 'n2', 'n3', 'n4', 'n5'].map(alive);
    const plan = planSessionCap(newestFirst, NOW, 3);
    expect(plan.revoke).toEqual(['n3', 'n4', 'n5']);
    expect(plan.expire).toEqual([]);
  });

  it('κάτω από το όριο ⇒ καμία ανάκληση', () => {
    expect(planSessionCap(['n1', 'n2'].map(alive), NOW, 3).revoke).toEqual([]);
  });

  it('οι ληγμένες σημαίνονται expired και ΔΕΝ πιάνουν θέση στο όριο', () => {
    const plan = planSessionCap([alive('n1'), lapsed('old1'), alive('n2'), lapsed('old2')], NOW, 3);
    expect(plan.expire).toEqual(['old1', 'old2']);
    expect(plan.revoke).toEqual([]);
  });
});
